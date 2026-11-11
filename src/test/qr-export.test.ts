import { describe, expect, it, vi } from "vitest";
import {
  buildQrCardSvg,
  buildQrBatchZipBytes,
  extractQrSvgGeometry,
  QR_EXPORT_HEIGHT,
  QR_EXPORT_TRACKING_COLOR,
  QR_EXPORT_WIDTH,
  renderQrCardPngBlob,
} from "@/lib/qr-export";
import { crc32, createZipBytes } from "@/lib/zip";

function parseZipEntries(zipBytes: Uint8Array) {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  const decoder = new TextDecoder();

  // Locate End of Central Directory (EOCD)
  const eocdOffset = zipBytes.length - 22;
  expect(view.getUint32(eocdOffset, true)).toBe(0x06054b50);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);

  const entries: { name: string; data: Uint8Array; crc: number }[] = [];
  let ptr = centralOffset;
  for (let i = 0; i < totalEntries; i += 1) {
    expect(view.getUint32(ptr, true)).toBe(0x02014b50);
    const crc = view.getUint32(ptr + 16, true);
    const size = view.getUint32(ptr + 24, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(zipBytes.subarray(ptr + 46, ptr + 46 + nameLen));

    expect(view.getUint32(localHeaderOffset, true)).toBe(0x04034b50);
    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const data = zipBytes.subarray(dataStart, dataStart + size);

    expect(crc32(data)).toBe(crc);
    entries.push({ name, data, crc });

    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

describe("ZIP archive builder", () => {
  it("creates a valid PKZIP archive with CRC-32 checksums and preserves filenames & bytes", () => {
    const fileA = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
    const fileB = new TextEncoder().encode("QR-0002 payload");

    const zipBytes = createZipBytes([
      { name: "QR-0001.png", data: fileA },
      { name: "QR-0002.png", data: fileB },
    ]);

    const extracted = parseZipEntries(zipBytes);
    expect(extracted).toHaveLength(2);
    expect(extracted[0]?.name).toBe("QR-0001.png");
    expect(Array.from(extracted[0]!.data)).toEqual(Array.from(fileA));
    expect(extracted[1]?.name).toBe("QR-0002.png");
    expect(Array.from(extracted[1]!.data)).toEqual(Array.from(fileB));
  });
});

describe("Minimal QR card SVG & PNG export", () => {
  it("renders minimal SVG with white background, full 4-module quiet zone, and subtle grey tracking ID only", () => {
    const url = "https://cards.example.com/r/9e7fee96c63be78c5b79677d";
    const geometry = extractQrSvgGeometry(url, "Q");
    expect(geometry.numCells).toBeGreaterThanOrEqual(29);
    expect(geometry.modulePx).toBeGreaterThanOrEqual(16);

    const svg = buildQrCardSvg(url, "QR-0005");
    expect(svg).toContain(`width="${QR_EXPORT_WIDTH}"`);
    expect(svg).toContain(`height="${QR_EXPORT_HEIGHT}"`);
    expect(svg).toContain('fill="#FFFFFF"');
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain(`fill="${QR_EXPORT_TRACKING_COLOR}"`);
    expect(svg).toContain(">QR-0005</text>");
    // Ensures no extra business/card metadata leaks into the minimal card export
    expect(svg).not.toContain("Google Review Card");
    expect(svg).not.toContain("cards.example.com");

    // Verify tracking ID sits strictly below the QR quiet zone
    const qrBottomWithQuietZone = geometry.offsetY + geometry.numCells * geometry.modulePx;
    expect(1036).toBeGreaterThan(qrBottomWithQuietZone);
  });

  it("renders PNG and multi-card ZIP archive preserving tracking ID order and filename mapping", async () => {
    const fillTextCalls: string[] = [];
    const fakePngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const origCreateElement = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === "canvas") {
        const fakeCtx = {
          imageSmoothingEnabled: true,
          fillStyle: "",
          font: "",
          textAlign: "left",
          textBaseline: "alphabetic",
          fillRect: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          translate: vi.fn(),
          scale: vi.fn(),
          fill: vi.fn(),
          fillText: vi.fn((text: string) => {
            fillTextCalls.push(text);
          }),
        };
        return {
          width: 0,
          height: 0,
          getContext: () => fakeCtx,
          toBlob: (cb: (blob: Blob | null) => void) => {
            const label = fillTextCalls.at(-1) ?? "QR";
            const labelBytes = new TextEncoder().encode(label);
            const payload = new Uint8Array(fakePngHeader.length + labelBytes.length);
            payload.set(fakePngHeader, 0);
            payload.set(labelBytes, fakePngHeader.length);
            cb(new Blob([payload], { type: "image/png" }));
          },
        } as unknown as HTMLCanvasElement;
      }
      return origCreateElement(tagName);
    });

    const origPath2D = globalThis.Path2D;
    globalThis.Path2D = class MockPath2D {
      constructor(_d?: string) {}
    } as unknown as typeof Path2D;

    try {
      const singleBlob = await renderQrCardPngBlob(
        "https://cards.example.com/r/abc12345",
        "QR-0005",
      );
      expect(singleBlob.type).toBe("image/png");
      expect(fillTextCalls).toEqual(["QR-0005"]);

      fillTextCalls.length = 0;
      const zipBytes = await buildQrBatchZipBytes([
        {
          url: "https://cards.example.com/r/code0003",
          trackingId: "QR-0003",
          trackingNumber: 3,
        },
        {
          url: "https://cards.example.com/r/code0001",
          trackingId: "QR-0001",
          trackingNumber: 1,
        },
        {
          url: "https://cards.example.com/r/code0002",
          trackingId: "QR-0002",
          trackingNumber: 2,
        },
      ]);

      const extracted = parseZipEntries(zipBytes);

      expect(extracted.map((e) => e.name)).toEqual(["QR-0001.png", "QR-0002.png", "QR-0003.png"]);
      expect(fillTextCalls).toEqual(["QR-0001", "QR-0002", "QR-0003"]);
      expect(new TextDecoder().decode(extracted[0]!.data)).toContain("QR-0001");
      expect(new TextDecoder().decode(extracted[1]!.data)).toContain("QR-0002");
      expect(new TextDecoder().decode(extracted[2]!.data)).toContain("QR-0003");
    } finally {
      createSpy.mockRestore();
      globalThis.Path2D = origPath2D;
    }
  });
});
