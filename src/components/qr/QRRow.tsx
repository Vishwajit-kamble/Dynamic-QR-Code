import { Check, Download, ExternalLink, Link2, Pencil, Printer, Trash2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { isUnlinkedDestination } from "@/lib/qr-workspace";
import type { QRRecord } from "@/components/qr/types";

interface QRRowProps {
  code: QRRecord;
  url: string;
  scans: number;
  onPreview: () => void;
  onDownload?: (() => void) | undefined;
  onEdit: () => void;
  onToggle: () => void;
  onPrint: () => void;
  onDelete: () => void;
}

export function QRRow({
  code,
  url,
  scans,
  onPreview,
  onDownload,
  onEdit,
  onToggle,
  onPrint,
  onDelete,
}: QRRowProps) {
  const isUnlinked = isUnlinkedDestination(code.destination_url);

  return (
    <article className="flex flex-col gap-2.5 border-b border-border px-3 py-3.5 last:border-0 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_105px_196px] lg:items-center lg:gap-3 lg:px-4">
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <button
          type="button"
          onClick={onPreview}
          aria-label={`Preview QR code for ${code.name}`}
          title={`Click to enlarge & download ${code.tracking_id}`}
          className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-white p-0.5 transition-shadow hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <QRCodeSVG value={url || "https://example.com"} size={42} level="Q" includeMargin />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex shrink-0 items-center rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-foreground">
              {code.tracking_id}
            </span>
            <span className="min-w-0 break-words text-sm font-medium leading-snug lg:truncate">
              {code.name}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                isUnlinked
                  ? "bg-amber-500/15 text-amber-700"
                  : code.is_active
                    ? "bg-chart-2/15 text-chart-2"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isUnlinked ? "Unlinked" : code.is_active ? "Active" : "Paused"}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span className="max-w-full truncate font-mono">ID: {code.code}</span>
            <span className="inline-flex shrink-0 items-center rounded bg-muted px-1.5 py-0.5 font-medium tabular-nums text-foreground lg:hidden">
              {scans.toLocaleString()} {scans === 1 ? "scan" : "scans"} · 30d
            </span>
          </div>
        </div>
      </div>

      {isUnlinked ? (
        <button
          type="button"
          onClick={onEdit}
          className="flex min-h-9 w-full min-w-0 items-center gap-1.5 rounded-md bg-primary/5 px-2.5 py-1.5 text-left text-xs font-medium leading-snug text-primary hover:bg-primary/10 lg:min-h-0 lg:w-auto lg:bg-transparent lg:px-0 lg:py-0 lg:hover:bg-transparent lg:hover:underline"
        >
          <Link2 className="size-3.5 shrink-0" />
          <span className="min-w-0">Awaiting customer link — assign URL</span>
        </button>
      ) : (
        <a
          href={code.destination_url}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-9 min-w-0 items-center gap-1.5 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-primary lg:min-h-0 lg:bg-transparent lg:px-0 lg:py-0"
          title={code.destination_url}
        >
          <span className="min-w-0 flex-1 truncate">{code.destination_url}</span>
          <ExternalLink className="size-3 shrink-0" />
        </a>
      )}

      <span className="hidden text-sm tabular-nums lg:block">
        {scans.toLocaleString()}{" "}
        <span className="text-xs text-muted-foreground">{scans === 1 ? "scan" : "scans"}</span>
      </span>

      <div
        className={`grid ${onDownload ? "grid-cols-5" : "grid-cols-4"} gap-1.5 border-t border-border/60 pt-2 lg:flex lg:items-center lg:justify-end lg:gap-1 lg:border-t-0 lg:pt-0`}
      >
        {onDownload && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-full lg:size-9"
            onClick={onDownload}
            aria-label={`Download ${code.tracking_id}`}
            title={`Download ${code.tracking_id}.png`}
          >
            <Download />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-full lg:size-9"
          onClick={onEdit}
          aria-label={`Edit ${code.name}`}
          title="Edit"
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-full lg:size-9"
          onClick={onPrint}
          aria-label={`Print ${code.name}`}
          title="Print"
        >
          <Printer />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-full lg:size-9"
          onClick={isUnlinked ? onEdit : onToggle}
          aria-label={
            isUnlinked
              ? `Assign link to ${code.name}`
              : code.is_active
                ? `Pause ${code.name}`
                : `Activate ${code.name}`
          }
          title={isUnlinked ? "Assign customer link" : code.is_active ? "Pause" : "Activate"}
        >
          {code.is_active ? <X /> : <Check />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-full text-destructive hover:text-destructive lg:size-9"
          onClick={onDelete}
          aria-label={`Delete ${code.name}`}
          title="Delete"
        >
          <Trash2 />
        </Button>
      </div>
    </article>
  );
}
