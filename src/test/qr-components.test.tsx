import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BatchCreateDialog } from "@/components/qr/BatchCreateDialog";
import { CodesView } from "@/components/qr/CodesView";
import { EmptyMini } from "@/components/qr/EmptyMini";
import { MiniStat } from "@/components/qr/MiniStat";
import { Pagination } from "@/components/qr/Pagination";
import { PrintSheet } from "@/components/qr/PrintSheet";
import { QRCodeEditor } from "@/components/qr/QRCodeEditor";
import { QRPreviewDialog } from "@/components/qr/QRPreviewDialog";
import { QRRow } from "@/components/qr/QRRow";
import { StatCard } from "@/components/qr/StatCard";
import { MAX_QR_CODES, UNLINKED_DESTINATION_URL } from "@/lib/qr-workspace";
import type { QRRecord } from "@/components/qr/types";

describe("StatCard Component", () => {
  it("renders label, value, and note properly", () => {
    render(
      <StatCard
        label="Total Scans"
        value="1,250"
        note="Past 30 days"
        icon={<span data-testid="icon">📊</span>}
        accent="green"
      />,
    );

    expect(screen.getByText("Total Scans")).toBeDefined();
    expect(screen.getByText("1,250")).toBeDefined();
    expect(screen.getByText("Past 30 days")).toBeDefined();
    expect(screen.getByTestId("icon")).toBeDefined();
  });
});

describe("MiniStat Component", () => {
  it("renders label and value", () => {
    render(<MiniStat label="Active Codes" value="12" />);
    expect(screen.getByText("Active Codes")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
  });
});

describe("Pagination Component", () => {
  it("does not render when totalPages is 1", () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={1}
        totalItems={5}
        pageSize={10}
        onPageChange={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders pagination controls when totalPages > 1", () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={3}
        totalItems={25}
        pageSize={10}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByText("Showing 1–10 of 25")).toBeDefined();
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
  });

  it("renders windowed ellipses when totalPages exceeds 7", () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={12}
        totalItems={120}
        pageSize={10}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByText("Showing 41–50 of 120")).toBeDefined();
    expect(screen.getAllByText("…").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
  });
});

describe("EmptyMini Component", () => {
  it("renders empty state title, description and button", () => {
    render(
      <EmptyMini title="No codes yet" description="Create your first QR code" action={() => {}} />,
    );
    expect(screen.getByText("No codes yet")).toBeDefined();
    expect(screen.getByText("Create your first QR code")).toBeDefined();
    expect(screen.getByText("Create code")).toBeDefined();
  });
});

describe("QRCodeEditor Component", () => {
  it("renders accessible validation alert instead of relying solely on browser popups", async () => {
    render(
      <QRCodeEditor
        open
        onOpenChange={() => {}}
        editing={null}
        codesCount={0}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Menu" } });
    fireEvent.change(screen.getByLabelText("Destination address"), {
      target: { value: "not-a-valid-url" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /Create code/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("https://");
    });
  });
});

describe("QRRow and PrintSheet Components", () => {
  const sampleRecord: QRRecord = {
    id: "11111111-1111-4111-8111-111111111111",
    code: "abcdef123456",
    tracking_number: 1,
    tracking_id: "QR-0001",
    name: "Cafe Menu",
    destination_url: "https://example.com/menu",
    is_active: true,
    created_at: "2026-11-10T10:00:00.000Z",
    updated_at: "2026-11-10T10:00:00.000Z",
  };

  it("wires preview, download, edit, print, toggle, and delete callbacks", () => {
    const onPreview = vi.fn();
    const onDownload = vi.fn();
    const onEdit = vi.fn();
    const onPrint = vi.fn();
    const onToggle = vi.fn();
    const onDelete = vi.fn();

    render(
      <QRRow
        code={sampleRecord}
        url="http://localhost:8080/r/abcdef123456"
        scans={7}
        onPreview={onPreview}
        onDownload={onDownload}
        onEdit={onEdit}
        onPrint={onPrint}
        onToggle={onToggle}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("QR-0001")).toBeDefined();
    fireEvent.click(screen.getByLabelText("Preview QR code for Cafe Menu"));
    fireEvent.click(screen.getByLabelText("Download QR-0001"));
    fireEvent.click(screen.getByLabelText("Edit Cafe Menu"));
    fireEvent.click(screen.getByLabelText("Print Cafe Menu"));
    fireEvent.click(screen.getByLabelText("Pause Cafe Menu"));
    fireEvent.click(screen.getByLabelText("Delete Cafe Menu"));

    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onPrint).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("filters PrintSheet to a specific QR code when printTargetId is set", () => {
    const second: QRRecord = {
      ...sampleRecord,
      id: "22222222-2222-4222-8222-222222222222",
      code: "fedcba654321",
      tracking_number: 2,
      tracking_id: "QR-0002",
      name: "Wifi Access",
    };

    const { rerender } = render(
      <PrintSheet
        records={[sampleRecord, second]}
        origin="http://localhost:8080"
        printTargetId={second.id}
      />,
    );
    expect(screen.queryByText("Cafe Menu")).toBeNull();
    expect(screen.getByText("Wifi Access")).toBeDefined();

    rerender(
      <PrintSheet
        records={[sampleRecord, second]}
        origin="http://localhost:8080"
        printTargetId="all"
      />,
    );
    expect(screen.getByText("Cafe Menu")).toBeDefined();
    expect(screen.getByText("Wifi Access")).toBeDefined();
  });

  it("uses LAN origin by default in QRPreviewDialog instead of localhost", () => {
    render(
      <QRPreviewDialog
        open
        onOpenChange={() => {}}
        code={{
          ...sampleRecord,
          name: "Google Review Card #01",
          destination_url:
            "https://github.com/Vishwajit-kamble/scan-sprout-dynamic-codes-very-long-url",
        }}
        origin="http://localhost:8081"
        lanOrigin="http://10.224.253.245:8081"
        useLanOrigin
        onUseLanOriginChange={() => {}}
      />,
    );

    expect(screen.getByText("Google Review Card #01")).toBeDefined();
    expect(screen.getAllByText(/QR-0001/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Redirects to https:\/\/github\.com/)).toBeDefined();
    expect(screen.getByText("http://10.224.253.245:8081/r/abcdef123456")).toBeDefined();
    expect(screen.getByText(/Card ID: abcdef123456/)).toBeDefined();
    expect(screen.getByRole("button", { name: /Download SVG/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /Test scan link/i }).getAttribute("href")).toBe(
      "http://10.224.253.245:8081/r/abcdef123456",
    );
  });

  it("searches QR codes by tracking ID in CodesView and previews continuous batch numbering", () => {
    const first: QRRecord = { ...sampleRecord, tracking_number: 1, tracking_id: "QR-0001" };
    const fifth: QRRecord = {
      ...sampleRecord,
      id: "55555555-5555-4555-8555-555555555555",
      code: "555555abcdef",
      tracking_number: 5,
      tracking_id: "QR-0005",
      name: "Google Review Card #0005",
      destination_url: UNLINKED_DESTINATION_URL,
      is_active: false,
    };

    render(
      <CodesView
        records={[first, fifth]}
        scans={[]}
        origin="https://cards.example.com"
        onPreview={() => {}}
        onDownloadQr={() => {}}
        onDownloadZip={() => {}}
        onEdit={() => {}}
        onToggle={() => {}}
        onDelete={() => {}}
        onPrint={() => {}}
        onCreateCode={() => {}}
      />,
    );

    const searchInput = screen.getByLabelText("Search QR codes");
    fireEvent.change(searchInput, { target: { value: "QR-0005" } });
    expect(screen.getByText("Google Review Card #0005")).toBeDefined();
    expect(screen.queryByText("Cafe Menu")).toBeNull();

    render(
      <BatchCreateDialog
        open
        onOpenChange={() => {}}
        codesCount={5}
        nextTrackingNumber={6}
        activeOrigin="https://cards.example.com"
        onBatchCreate={async () => []}
        onPrintBatch={() => {}}
      />,
    );
    expect(
      screen.getByText(/Google Review Card #0006 … #0015 \(QR-0006 … QR-0015\)/),
    ).toBeDefined();
  });

  it("renders unlinked inventory state cleanly in QRRow and QRCodeEditor limit text", () => {
    const unlinked: QRRecord = {
      ...sampleRecord,
      destination_url: UNLINKED_DESTINATION_URL,
      is_active: false,
    };
    const onEdit = vi.fn();

    render(
      <QRRow
        code={unlinked}
        url="https://reviews.example.com/r/abcdef123456"
        scans={0}
        onPreview={() => {}}
        onEdit={onEdit}
        onPrint={() => {}}
        onToggle={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByText("Unlinked")).toBeDefined();
    fireEvent.click(screen.getByText(/Awaiting customer link/i));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(MAX_QR_CODES).toBe(1000);
  });
});
