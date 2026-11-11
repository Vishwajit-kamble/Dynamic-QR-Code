import { AlertTriangle, Download, Layers, LoaderCircle, Printer } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  canCreateQrCode,
  formatBatchCardName,
  formatTrackingId,
  formatTrackingNumber,
  isPrivateOrLocalOrigin,
  MAX_BATCH_CREATE,
  MAX_QR_CODES,
  UNLINKED_DESTINATION_URL,
} from "@/lib/qr-workspace";

interface BatchCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  codesCount: number;
  nextTrackingNumber?: number | undefined;
  activeOrigin: string;
  onBatchCreate: (params: {
    prefix: string;
    count: number;
    destinationUrl: string;
    isActive: boolean;
  }) => Promise<string[]>;
  onDownloadBatchZip?: ((ids: string[]) => void) | undefined;
  onPrintBatch: (ids: string[]) => void;
}

const PRESET_COUNTS = [5, 10, 20, 50];

export function BatchCreateDialog({
  open,
  onOpenChange,
  codesCount,
  nextTrackingNumber = 1,
  activeOrigin,
  onBatchCreate,
  onDownloadBatchZip,
  onPrintBatch,
}: BatchCreateDialogProps) {
  const [prefix, setPrefix] = useState("Google Review Card");
  const [count, setCount] = useState(10);
  const [unlinkedMode, setUnlinkedMode] = useState(true);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [downloadZipAfter, setDownloadZipAfter] = useState(false);
  const [printAfter, setPrintAfter] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPrefix("Google Review Card");
      setCount(10);
      setUnlinkedMode(true);
      setDestinationUrl("");
      setDownloadZipAfter(false);
      setPrintAfter(false);
      setError("");
    }
  }, [open]);

  const remaining = Math.max(0, MAX_QR_CODES - codesCount);
  const isLocalPrintRisk = isPrivateOrLocalOrigin(activeOrigin);
  const startSeq = Math.max(1, nextTrackingNumber);
  const endSeq = startSeq + Math.max(1, count) - 1;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const trimmedPrefix = prefix.trim();
    if (!trimmedPrefix || trimmedPrefix.length > 80) {
      setError("Enter a batch prefix between 1 and 80 characters.");
      return;
    }
    if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH_CREATE) {
      setError(`Choose between 1 and ${MAX_BATCH_CREATE} cards per batch.`);
      return;
    }
    if (!canCreateQrCode(codesCount, count)) {
      setError(`Only ${remaining} slot(s) remaining in this workspace (max ${MAX_QR_CODES}).`);
      return;
    }

    let finalUrl = UNLINKED_DESTINATION_URL;
    if (!unlinkedMode) {
      const trimmedUrl = destinationUrl.trim();
      try {
        const parsed = new URL(trimmedUrl);
        if (
          (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
          trimmedUrl.length > 2048
        ) {
          throw new Error("invalid");
        }
        finalUrl = trimmedUrl;
      } catch {
        setError("Enter a complete web address starting with https://.");
        return;
      }
    }

    setSaving(true);
    try {
      const createdIds = await onBatchCreate({
        prefix: trimmedPrefix,
        count,
        destinationUrl: finalUrl,
        isActive: !unlinkedMode,
      });
      onOpenChange(false);
      if (downloadZipAfter && onDownloadBatchZip && createdIds.length > 0) {
        window.setTimeout(() => onDownloadBatchZip(createdIds), 120);
      } else if (printAfter && createdIds.length > 0) {
        window.setTimeout(() => onPrintBatch(createdIds), 120);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create card batch.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-2.5 sm:max-w-[500px] sm:gap-4">
        <DialogHeader className="min-w-0 text-left">
          <DialogTitle className="pr-9">Batch generate review cards</DialogTitle>
          <DialogDescription>
            Pre-print blank dynamic QR cards for inventory first, then link each card to a buyer’s
            Google Review link after you sell it.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
          className="space-y-2.5 sm:space-y-4"
        >
          {isLocalPrintRisk && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-foreground sm:p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">Local scan URL detected ({activeOrigin || "local"})</p>
                <p className="mt-0.5 text-muted-foreground">
                  Before sending physical cards to print, deploy this app (or set your Vercel/domain{" "}
                  <strong>Custom URL</strong>) so sold cards scan 24/7 when your PC is off.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="batch-prefix" className="text-sm font-medium">
              Card label prefix
            </label>
            <Input
              id="batch-prefix"
              value={prefix}
              maxLength={80}
              onChange={(event) => {
                setPrefix(event.target.value);
                if (error) setError("");
              }}
              placeholder="e.g. Google Review Card"
            />
            <p className="text-xs text-muted-foreground">
              {count === 1
                ? `Creates ${formatBatchCardName(prefix, startSeq)} (${formatTrackingId(startSeq)})`
                : `Creates ${formatBatchCardName(prefix, startSeq)} … #${formatTrackingNumber(endSeq)} (${formatTrackingId(startSeq)} … ${formatTrackingId(endSeq)})`}
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="batch-count" className="text-sm font-medium">
              Number of cards
            </label>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {PRESET_COUNTS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={count === preset ? "secondary" : "outline"}
                  className="h-9 min-w-10 px-2.5 text-xs sm:h-8 sm:min-w-0 sm:px-3"
                  disabled={preset > remaining}
                  onClick={() => setCount(preset)}
                >
                  <span>{preset}</span>
                  <span className="hidden sm:inline">cards</span>
                </Button>
              ))}
              <Input
                id="batch-count"
                type="number"
                min={1}
                max={Math.min(MAX_BATCH_CREATE, remaining || 1)}
                value={count}
                onChange={(event) => setCount(Math.max(1, Number(event.target.value) || 1))}
                aria-label="Number of cards"
                className="h-9 w-16 text-base sm:h-8 sm:w-20 sm:text-xs"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-2.5 sm:p-3">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={unlinkedMode}
                onChange={(event) => setUnlinkedMode(event.target.checked)}
                className="mt-0.5 size-4 rounded border-input accent-primary"
              />
              <span>
                <span className="font-medium">Pre-print blank inventory (link after sale)</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Cards stay marked <strong>Unlinked</strong> until you paste a buyer’s Google
                  Review link.
                </span>
              </span>
            </label>

            {!unlinkedMode && (
              <div className="pt-2">
                <label htmlFor="batch-url" className="mb-1 block text-xs font-medium">
                  Shared destination URL
                </label>
                <Input
                  id="batch-url"
                  type="url"
                  value={destinationUrl}
                  onChange={(event) => {
                    setDestinationUrl(event.target.value);
                    if (error) setError("");
                  }}
                  placeholder="https://g.page/r/..."
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            {onDownloadBatchZip && (
              <label className="flex min-h-9 cursor-pointer items-center gap-2 py-0.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={downloadZipAfter}
                  onChange={(event) => {
                    setDownloadZipAfter(event.target.checked);
                    if (event.target.checked) setPrintAfter(false);
                  }}
                  className="size-4 shrink-0 rounded border-input accent-primary"
                />
                <Download className="size-3.5 shrink-0" />
                <span>Download individual QR images as ZIP right after generating</span>
              </label>
            )}

            <label className="flex min-h-9 cursor-pointer items-center gap-2 py-0.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={printAfter}
                onChange={(event) => {
                  setPrintAfter(event.target.checked);
                  if (event.target.checked) setDownloadZipAfter(false);
                }}
                className="size-4 shrink-0 rounded border-input accent-primary"
              />
              <Printer className="size-3.5 shrink-0" />
              <span>Open printable label sheet right after generating</span>
            </label>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full sm:h-9 sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 w-full px-3 sm:h-9 sm:w-auto sm:px-4"
              disabled={saving || remaining === 0}
            >
              {saving ? <LoaderCircle className="animate-spin" /> : <Layers />}
              <span>
                {saving ? "Generating…" : `Generate ${count}`}
                {!saving && <span className="hidden sm:inline"> cards</span>}
              </span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
