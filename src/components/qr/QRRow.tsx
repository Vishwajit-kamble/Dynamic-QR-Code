import { Check, ExternalLink, Link2, Pencil, Printer, Trash2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { isUnlinkedDestination } from "@/lib/qr-workspace";
import type { QRRecord } from "@/components/qr/types";

interface QRRowProps {
  code: QRRecord;
  url: string;
  scans: number;
  onPreview: () => void;
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
  onEdit,
  onToggle,
  onPrint,
  onDelete,
}: QRRowProps) {
  const isUnlinked = isUnlinkedDestination(code.destination_url);

  return (
    <article className="flex flex-col gap-3 border-b border-border px-3 py-3.5 last:border-0 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_105px_156px] lg:items-center lg:gap-3 lg:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onPreview}
          aria-label={`Preview QR code for ${code.name}`}
          title="Click to enlarge & download PNG/SVG"
          className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-white p-0.5 transition-shadow hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <QRCodeSVG value={url || "https://example.com"} size={42} level="M" includeMargin />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{code.name}</span>
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
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
            ID: {code.code}
            <span className="lg:hidden">
              {" "}
              · {scans.toLocaleString()} {scans === 1 ? "scan" : "scans"} · 30d
            </span>
          </p>
        </div>
      </div>

      {isUnlinked ? (
        <button
          type="button"
          onClick={onEdit}
          className="flex min-w-0 items-center gap-1.5 pl-[60px] text-left text-xs font-medium text-primary hover:underline lg:pl-0"
        >
          <Link2 className="size-3.5 shrink-0" />
          <span className="truncate">Awaiting customer link — assign URL</span>
        </button>
      ) : (
        <a
          href={code.destination_url}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 items-center gap-1 pl-[60px] text-xs text-muted-foreground hover:text-primary lg:pl-0"
          title={code.destination_url}
        >
          <span className="truncate">{code.destination_url}</span>
          <ExternalLink className="size-3 shrink-0" />
        </a>
      )}

      <span className="hidden text-sm tabular-nums lg:block">
        {scans.toLocaleString()}{" "}
        <span className="text-xs text-muted-foreground">{scans === 1 ? "scan" : "scans"}</span>
      </span>

      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          onClick={onEdit}
          aria-label={`Edit ${code.name}`}
          title="Edit"
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          onClick={onPrint}
          aria-label={`Print ${code.name}`}
          title="Print"
        >
          <Printer />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
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
          className="size-9 text-destructive hover:text-destructive"
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
