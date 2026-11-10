import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Globe,
  Layers,
  MoreHorizontal,
  Plus,
  Printer,
  QrCode,
  Search,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MiniStat } from "@/components/qr/MiniStat";
import { QRRow } from "@/components/qr/QRRow";
import { Pagination } from "@/components/qr/Pagination";
import {
  isPrivateOrLocalOrigin,
  isUnlinkedDestination,
  MAX_QR_CODES,
  type StorageMode,
} from "@/lib/qr-workspace";
import type { QRRecord, ScanRecord, StatusFilter } from "@/components/qr/types";

const CODES_PAGE_SIZE = 10;

interface CodesViewProps {
  records: QRRecord[];
  scans: ScanRecord[];
  origin: string;
  browserOrigin?: string;
  lanOrigin?: string | null;
  useLanOrigin?: boolean;
  onUseLanOriginChange?: (value: boolean) => void;
  customOrigin?: string;
  onCustomOriginChange?: (value: string) => void;
  storageMode?: StorageMode;
  onPreview: (code: QRRecord) => void;
  onEdit: (code: QRRecord) => void;
  onToggle: (code: QRRecord) => void;
  onDelete: (code: QRRecord) => void;
  onPrint: (code?: QRRecord) => void;
  onBatchCreate?: () => void;
  onCreateCode: () => void;
}

export function CodesView({
  records,
  scans,
  origin,
  browserOrigin = "",
  lanOrigin = null,
  useLanOrigin = true,
  onUseLanOriginChange,
  customOrigin = "",
  onCustomOriginChange,
  storageMode = "local-file",
  onPreview,
  onEdit,
  onToggle,
  onDelete,
  onPrint,
  onBatchCreate,
  onCreateCode,
}: CodesViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortNewest, setSortNewest] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingBaseUrl, setEditingBaseUrl] = useState(false);
  const [baseUrlDraft, setBaseUrlDraft] = useState(customOrigin);
  const [baseUrlError, setBaseUrlError] = useState("");

  const activeCount = records.filter((code) => code.is_active).length;
  const thirtyDayScans = scans.filter(
    (scan) => new Date(scan.scanned_at).getTime() >= Date.now() - 30 * 86400000,
  ).length;

  const filteredRecords = useMemo(
    () =>
      records
        .filter((code) => {
          const unlinked = isUnlinkedDestination(code.destination_url);
          if (statusFilter === "all") return true;
          if (statusFilter === "active") return code.is_active;
          if (statusFilter === "unlinked") return unlinked;
          return !code.is_active && !unlinked;
        })
        .filter((code) =>
          `${code.name} ${code.code} ${code.destination_url}`
            .toLowerCase()
            .includes(search.toLowerCase().trim()),
        )
        .sort((a, b) =>
          sortNewest ? b.created_at.localeCompare(a.created_at) : a.name.localeCompare(b.name),
        ),
    [records, search, sortNewest, statusFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / CODES_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRecords = filteredRecords.slice(
    (safePage - 1) * CODES_PAGE_SIZE,
    safePage * CODES_PAGE_SIZE,
  );

  // Reset page when filters change
  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };
  const handleStatusFilter = (value: StatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };
  const handleSort = () => {
    setSortNewest((current) => !current);
    setCurrentPage(1);
  };

  const isLocalOrPrivate = isPrivateOrLocalOrigin(origin);
  const isCloudDb = storageMode === "postgres" || storageMode === "supabase";
  const showScanOriginBar = Boolean(
    origin || (lanOrigin && lanOrigin !== browserOrigin) || customOrigin,
  );

  const saveBaseUrl = () => {
    setBaseUrlError("");
    const trimmed = baseUrlDraft.trim();
    if (!trimmed) {
      onCustomOriginChange?.("");
      setEditingBaseUrl(false);
      return;
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setBaseUrlError("Use an address starting with http:// or https://");
        return;
      }
      onCustomOriginChange?.(parsed.origin);
      setBaseUrlDraft(parsed.origin);
      setEditingBaseUrl(false);
    } catch {
      setBaseUrlError("Enter a valid base URL like https://your-domain.com");
    }
  };

  return (
    <section>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MiniStat label="All codes" value={`${records.length} / ${MAX_QR_CODES}`} />
        <MiniStat label="Active" value={`${activeCount}`} />
        <MiniStat
          label="Scans · 30 days"
          value={`${thirtyDayScans}`}
          className="col-span-2 sm:col-span-1"
        />
      </div>
      {showScanOriginBar && (
        <div
          className={`mb-4 rounded-lg border px-3.5 py-2.5 text-xs ${
            !isLocalOrPrivate && isCloudDb
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-border bg-card"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
              {!isLocalOrPrivate && isCloudDb ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              ) : isLocalOrPrivate ? (
                <Smartphone className="size-4 shrink-0 text-primary" />
              ) : (
                <Globe className="size-4 shrink-0 text-primary" />
              )}
              <span className="truncate">
                {isLocalOrPrivate ? "Phone scan address: " : "Production scan URL: "}
                <strong className="font-medium text-foreground">{origin}</strong>
                {!customOrigin && !isLocalOrPrivate && isCloudDb
                  ? " (Cloud live — scans work 24/7 worldwide)"
                  : !customOrigin && useLanOrigin && lanOrigin
                    ? " (Wi-Fi LAN active · deploy to Vercel before selling physical cards)"
                    : !customOrigin && isLocalOrPrivate
                      ? " (localhost only works on this PC)"
                      : " (custom public URL)"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {!customOrigin && lanOrigin && onUseLanOriginChange && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => onUseLanOriginChange(!useLanOrigin)}
                >
                  {useLanOrigin ? "Use localhost" : "Use Wi-Fi IP"}
                </Button>
              )}
              {customOrigin && onCustomOriginChange && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => {
                    onCustomOriginChange("");
                    setBaseUrlDraft("");
                  }}
                >
                  {lanOrigin ? "Reset to Wi-Fi IP" : "Use current URL"}
                </Button>
              )}
              {onCustomOriginChange && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => {
                    setBaseUrlDraft(customOrigin);
                    setBaseUrlError("");
                    setEditingBaseUrl((v) => !v);
                  }}
                >
                  {editingBaseUrl ? "Cancel" : "Custom URL"}
                </Button>
              )}
            </div>
          </div>
          {editingBaseUrl && (
            <div className="mt-2.5 flex flex-col gap-2 border-t border-border pt-2.5 sm:flex-row sm:items-center">
              <Input
                value={baseUrlDraft}
                onChange={(e) => setBaseUrlDraft(e.target.value)}
                placeholder="https://your-vercel-app.vercel.app"
                aria-label="Custom QR base URL"
                className="h-8 flex-1 text-xs"
              />
              <Button type="button" size="sm" className="h-8 text-xs" onClick={saveBaseUrl}>
                Save base URL
              </Button>
              {baseUrlError && (
                <span role="alert" className="text-xs text-destructive">
                  {baseUrlError}
                </span>
              )}
            </div>
          )}
        </div>
      )}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
            placeholder="Search by name, Card ID, or link"
            aria-label="Search QR codes"
            className="h-10 pl-9"
          />
        </div>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="status-filter">
            Filter by status
          </label>
          <div className="relative">
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(event) => handleStatusFilter(event.target.value as StatusFilter)}
              className="h-10 min-w-32 appearance-none rounded-md border border-input bg-card pl-3 pr-9 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="unlinked">Unlinked</option>
              <option value="paused">Paused</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Button
            variant="outline"
            className="h-10"
            onClick={handleSort}
            aria-label={sortNewest ? "Sorted by newest" : "Sorted by name"}
            title={sortNewest ? "Sorted by newest" : "Sorted by name"}
          >
            <MoreHorizontal />{" "}
            <span className="hidden sm:inline">{sortNewest ? "Newest" : "Name"}</span>
            <ChevronDown />
          </Button>
          {onBatchCreate && (
            <Button
              variant="outline"
              className="h-10 sm:hidden"
              onClick={onBatchCreate}
              aria-label="Batch generate review cards"
            >
              <Layers />
            </Button>
          )}
          <Button
            variant="outline"
            className="h-10 sm:hidden"
            onClick={() => onPrint()}
            disabled={!records.length}
            aria-label="Print all QR codes"
          >
            <Printer />
          </Button>
        </div>
      </div>
      {filteredRecords.length ? (
        <>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_105px_156px] items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid">
              <span>QR code</span>
              <span>Destination</span>
              <span>Scans · 30d</span>
              <span className="text-right">Actions</span>
            </div>
            {paginatedRecords.map((code) => (
              <QRRow
                key={code.id}
                code={code}
                url={origin ? `${origin}/r/${code.code}` : ""}
                scans={
                  scans.filter(
                    (scan) =>
                      scan.qr_code_id === code.id &&
                      new Date(scan.scanned_at).getTime() >= Date.now() - 30 * 86400000,
                  ).length
                }
                onPreview={() => onPreview(code)}
                onEdit={() => onEdit(code)}
                onToggle={() => onToggle(code)}
                onPrint={() => onPrint(code)}
                onDelete={() => onDelete(code)}
              />
            ))}
          </div>
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredRecords.length}
            pageSize={CODES_PAGE_SIZE}
          />
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card py-16 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <QrCode className="size-6" />
          </div>
          <h2 className="mt-4 text-base font-semibold">
            {search || statusFilter !== "all" ? "No matching QR codes" : "No QR codes yet"}
          </h2>
          <p className="mx-auto mt-1 max-w-sm px-3 text-sm text-muted-foreground">
            {search || statusFilter !== "all"
              ? "Try a different search or filter."
              : "Create your first dynamic Google Review link or batch-generate inventory cards."}
          </p>
          {!search && statusFilter === "all" && (
            <Button onClick={onCreateCode} className="mt-5">
              <Plus /> Create your first code
            </Button>
          )}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {filteredRecords.length} {filteredRecords.length === 1 ? "code" : "codes"}
        </span>
        <span>{MAX_QR_CODES - records.length} remaining</span>
      </div>
    </section>
  );
}
