import { Download, Layers, LoaderCircle, Lock, Plus, Printer, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canCreateQrCode } from "@/lib/qr-workspace";
import type { View } from "@/components/qr/types";

interface HeaderProps {
  view: View;
  codesCount: number;
  authEnabled?: boolean;
  isExportingZip?: boolean | undefined;
  zipProgressText?: string | undefined;
  onDownloadZip?: (() => void) | undefined;
  onPrintAll: () => void;
  onBatchCreate: () => void;
  onCreateCode: () => void;
  onLockWorkspace?: () => void;
}

export function Header({
  view,
  codesCount,
  authEnabled = false,
  isExportingZip = false,
  zipProgressText,
  onDownloadZip,
  onPrintAll,
  onBatchCreate,
  onCreateCode,
  onLockWorkspace,
}: HeaderProps) {
  return (
    <header className="flex min-h-16 items-center justify-between gap-2.5 border-b border-border bg-card px-3.5 sm:min-h-[76px] sm:gap-3 sm:px-8">
      <div className="flex min-w-0 items-center gap-2 md:hidden">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <QrCode className="size-4" />
        </span>
        <span className="truncate text-sm font-semibold">
          qr<span className="text-primary">studio</span>
        </span>
      </div>
      <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
        <span>Workspace</span>
        <span>/</span>
        <span className="font-medium text-foreground">
          {view === "overview" ? "Overview" : "My QR codes"}
        </span>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        {authEnabled && onLockWorkspace && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onLockWorkspace}
            aria-label="Lock workspace"
            title="Lock workspace"
            className="size-9 text-muted-foreground"
          >
            <Lock />
          </Button>
        )}
        {onDownloadZip && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadZip}
            disabled={!codesCount || isExportingZip}
            title="Download all QR codes as individual PNGs in a ZIP archive"
            className="hidden h-9 sm:inline-flex"
          >
            {isExportingZip ? <LoaderCircle className="animate-spin" /> : <Download />}
            <span>{isExportingZip ? zipProgressText || "Zipping…" : "Download ZIP"}</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onPrintAll}
          disabled={!codesCount}
          title="Open printable sheet (optional)"
          className="hidden h-9 sm:inline-flex"
        >
          <Printer /> Print all
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onBatchCreate}
          disabled={!canCreateQrCode(codesCount)}
          className="hidden h-9 sm:inline-flex"
        >
          <Layers /> Batch cards
        </Button>
        <Button
          onClick={onCreateCode}
          disabled={!canCreateQrCode(codesCount)}
          className="h-9 px-3 sm:px-4"
        >
          <Plus /> <span className="hidden sm:inline">Create QR code</span>
          <span className="sm:hidden">Create</span>
        </Button>
      </div>
    </header>
  );
}
