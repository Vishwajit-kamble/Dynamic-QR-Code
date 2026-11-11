import { describe, expect, it } from "vitest";
import {
  canCreateQrCode,
  formatBatchCardName,
  formatTrackingId,
  formatTrackingNumber,
  isPrivateOrLocalOrigin,
  isUnlinkedDestination,
  MAX_QR_CODES,
  UNLINKED_DESTINATION_URL,
} from "@/lib/qr-workspace";
import { formatRelative } from "@/lib/format-relative";
import {
  batchCreateLocalQrCodes,
  createLocalQrCode,
  deleteLocalQrCode,
  listQrWorkspace,
  resolveLocalQrScan,
  resolveLocalQrScanDetailed,
  toggleLocalQrCode,
  updateLocalQrCode,
} from "@/lib/local-qr-store.server";

describe("QR workspace capacity & helpers", () => {
  it("allows creation below the 1000-code workspace limit", () => {
    expect(MAX_QR_CODES).toBe(1000);
    expect(canCreateQrCode(0)).toBe(true);
    expect(canCreateQrCode(999)).toBe(true);
    expect(canCreateQrCode(990, 10)).toBe(true);
  });

  it("blocks creation above the 1000-code workspace limit", () => {
    expect(canCreateQrCode(1000)).toBe(false);
    expect(canCreateQrCode(995, 10)).toBe(false);
  });

  it("identifies private/local origins vs public HTTPS domains", () => {
    expect(isPrivateOrLocalOrigin("http://localhost:8080")).toBe(true);
    expect(isPrivateOrLocalOrigin("http://10.224.253.245:8081")).toBe(true);
    expect(isPrivateOrLocalOrigin("http://192.168.1.50:8080")).toBe(true);
    expect(isPrivateOrLocalOrigin("https://review-cards.vercel.app")).toBe(false);
  });

  it("formats permanent sequential tracking IDs and continuous batch names", () => {
    expect(formatTrackingNumber(1)).toBe("0001");
    expect(formatTrackingNumber(42)).toBe("0042");
    expect(formatTrackingNumber(1250)).toBe("1250");
    expect(formatTrackingId(5)).toBe("QR-0005");
    expect(formatBatchCardName("Google Review Card", 5)).toBe("Google Review Card #0005");
  });
});

describe("Relative time formatting", () => {
  it("returns 'Just now' for timestamps less than a minute ago", () => {
    const now = new Date().toISOString();
    expect(formatRelative(now)).toBe("Just now");
  });

  it("returns minutes ago for timestamps under an hour ago", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelative(fiveMinutesAgo)).toBe("5m ago");
  });

  it("returns hours ago for timestamps under a day ago", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(formatRelative(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days ago for older timestamps", () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 86400 * 1000).toISOString();
    expect(formatRelative(fourDaysAgo)).toBe("4d ago");
  });
});

describe("Pagination calculations", () => {
  it("computes page boundaries correctly", () => {
    const totalItems = 25;
    const pageSize = 10;
    const totalPages = Math.ceil(totalItems / pageSize);
    expect(totalPages).toBe(3);

    const getSlice = (page: number) => {
      const start = (page - 1) * pageSize;
      const end = page * pageSize;
      return [start, end];
    };

    expect(getSlice(1)).toEqual([0, 10]);
    expect(getSlice(2)).toEqual([10, 20]);
    expect(getSlice(3)).toEqual([20, 30]);
  });
});

describe("Local QR workspace CRUD and scan resolution", () => {
  it("creates, updates, toggles, scans, and deletes a QR code", async () => {
    const created = await createLocalQrCode("Summer Menu", "https://example.com/menu");
    expect(created.ok).toBe(true);

    let ws = await listQrWorkspace();
    expect(ws.codes).toHaveLength(1);
    const qr = ws.codes[0]!;
    expect(qr.name).toBe("Summer Menu");
    expect(qr.destination_url).toBe("https://example.com/menu");
    expect(qr.is_active).toBe(true);

    // Update destination
    await updateLocalQrCode(qr.id, "Autumn Menu", "https://example.com/autumn");
    ws = await listQrWorkspace();
    expect(ws.codes[0]?.name).toBe("Autumn Menu");
    expect(ws.codes[0]?.destination_url).toBe("https://example.com/autumn");

    // Scan active QR code
    const destination = await resolveLocalQrScan(qr.code, "mobile", "instagram.com");
    expect(destination).toBe("https://example.com/autumn");
    ws = await listQrWorkspace();
    expect(ws.scans).toHaveLength(1);
    expect(ws.scans[0]?.device_type).toBe("mobile");
    expect(ws.scans[0]?.referrer_host).toBe("instagram.com");

    // Pause QR code and verify scan returns paused/null
    await toggleLocalQrCode(qr.id);
    const pausedDetailed = await resolveLocalQrScanDetailed(qr.code, "desktop", null);
    expect(pausedDetailed.status).toBe("paused");
    const pausedDest = await resolveLocalQrScan(qr.code, "desktop", null);
    expect(pausedDest).toBeNull();

    // Delete QR code and verify scans are cleaned up
    await deleteLocalQrCode(qr.id);
    ws = await listQrWorkspace();
    expect(ws.codes).toHaveLength(0);
    expect(ws.scans).toHaveLength(0);
  });

  it("batch generates blank inventory cards and auto-activates upon customer assignment", async () => {
    const batch = await batchCreateLocalQrCodes(
      "Google Review Card",
      3,
      UNLINKED_DESTINATION_URL,
      false,
    );
    expect(batch.ok).toBe(true);
    expect(batch.count).toBe(3);

    let ws = await listQrWorkspace();
    expect(ws.codes).toHaveLength(3);
    expect(ws.codes.every((item) => isUnlinkedDestination(item.destination_url))).toBe(true);
    expect(ws.codes.every((item) => !item.is_active)).toBe(true);

    const card = ws.codes[0]!;
    await expect(toggleLocalQrCode(card.id)).rejects.toThrow(/Google Review link/);

    // Assign real Google Review link -> auto-activates card!
    await updateLocalQrCode(card.id, "Cafe Bella Review", "https://g.page/r/cafe-bella/review");
    ws = await listQrWorkspace();
    const updated = ws.codes.find((item) => item.id === card.id)!;
    expect(updated.is_active).toBe(true);

    const resolved = await resolveLocalQrScan(updated.code, "mobile", null);
    expect(resolved).toBe("https://g.page/r/cafe-bella/review");

    for (const item of ws.codes) {
      await deleteLocalQrCode(item.id);
    }
  });

  it("keeps batch and single tracking IDs continuous and never reuses deleted IDs", async () => {
    const startWs = await listQrWorkspace();
    const expectedStart = startWs.nextTrackingNumber;

    // Batch 1 of 5
    const batch1 = await batchCreateLocalQrCodes(
      "Google Review Card",
      5,
      UNLINKED_DESTINATION_URL,
      false,
    );
    expect(batch1.trackingIds).toEqual([
      formatTrackingId(expectedStart),
      formatTrackingId(expectedStart + 1),
      formatTrackingId(expectedStart + 2),
      formatTrackingId(expectedStart + 3),
      formatTrackingId(expectedStart + 4),
    ]);

    let ws = await listQrWorkspace();
    const batch1Names = batch1.createdIds.map((id) => ws.codes.find((c) => c.id === id)?.name);
    expect(batch1Names).toEqual([
      formatBatchCardName("Google Review Card", expectedStart),
      formatBatchCardName("Google Review Card", expectedStart + 1),
      formatBatchCardName("Google Review Card", expectedStart + 2),
      formatBatchCardName("Google Review Card", expectedStart + 3),
      formatBatchCardName("Google Review Card", expectedStart + 4),
    ]);

    // Delete the highest tracking ID in Batch 1 (e.g. QR-0005)
    const lastBatch1Id = batch1.createdIds[4]!;
    await deleteLocalQrCode(lastBatch1Id);

    // Next batch of 5 MUST start at expectedStart + 5, never reusing deleted ID
    const batch2 = await batchCreateLocalQrCodes(
      "Google Review Card",
      5,
      UNLINKED_DESTINATION_URL,
      false,
    );
    expect(batch2.trackingIds).toEqual([
      formatTrackingId(expectedStart + 5),
      formatTrackingId(expectedStart + 6),
      formatTrackingId(expectedStart + 7),
      formatTrackingId(expectedStart + 8),
      formatTrackingId(expectedStart + 9),
    ]);

    // Individual creation continues seamlessly
    const single = await createLocalQrCode("VIP Hotel Card", "https://g.page/r/vip/review");
    expect(single.tracking_id).toBe(formatTrackingId(expectedStart + 10));

    // Delete everything and confirm nextTrackingNumber still never resets
    ws = await listQrWorkspace();
    for (const item of ws.codes) {
      await deleteLocalQrCode(item.id);
    }
    const afterClear = await listQrWorkspace();
    expect(afterClear.nextTrackingNumber).toBe(expectedStart + 11);

    const afterDeleteAll = await createLocalQrCode("Fresh Card", "https://g.page/r/fresh/review");
    expect(afterDeleteAll.tracking_id).toBe(formatTrackingId(expectedStart + 11));
    await deleteLocalQrCode(afterDeleteAll.id);
  });
});
