import { AlertTriangle, Layers, LoaderCircle, Printer } from "lucide-react";
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
  isPrivateOrLocalOrigin,
  MAX_BATCH_CREATE,
  MAX_QR_CODES,
  UNLINKED_DESTINATION_URL,
} from "@/lib/qr-workspace";

interface BatchCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  codesCount: number;
  activeOrigin: string;
  onBatchCreate: (params: {
    prefix: string;
    count: number;
    destinationUrl: string;
    isActive: boolean;
  }) => Promise<string[]>;
  onPrintBatch: (ids: string[]) => void;
}

const PRESET_COUNTS = [5, 10, 20, 50];

export function BatchCreateDialog({
  open,
  onOpenChange,
  codesCount,
  activeOrigin,
  onBatchCreate,
  onPrintBatch,
}: BatchCreateDialogProps) {
  const [prefix, setPrefix] = useState("Google Review Card");
  const [count, setCount] = useState(10);
  const [unlinkedMode, setUnlinkedMode] = useState(true);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [printAfter, setPrintAfter] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPrefix("Google Review Card");
      setCount(10);
      setUnlinkedMode(true);
      setDestinationUrl("");
      setPrintAfter(false);
      setError("");
    }
  }, [open]);

  const remaining = Math.max(0, MAX_QR_CODES - codesCount);
  const isLocalPrintRisk = isPrivateOrLocalOrigin(activeOrigin);

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
      if (printAfter && createdIds.length > 0) {
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Batch generate review cards</DialogTitle>
          <DialogDescription>
            Pre-print blank dynamic QR cards for inventory first, then link each card to a buyer’s
            Google Review link after you sell it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-4">
          {isLocalPrintRisk && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-foreground">
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
              Creates {prefix.trim() || "Card"} #01 … #{String(count).padStart(2, "0")}
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="batch-count" className="text-sm font-medium">
              Number of cards
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COUNTS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={count === preset ? "secondary" : "outline"}
                  className="h-8 px-3 text-xs"
                  disabled={preset > remaining}
                  onClick={() => setCount(preset)}
                >
                  {preset} cards
                </Button>
              ))}
              <Input
                id="batch-count"
                type="number"
                min={1}
                max={Math.min(MAX_BATCH_CREATE, remaining || 1)}
                value={count}
                onChange={(event) => setCount(Math.max(1, Number(event.target.value) || 1))}
                className="h-8 w-20 text-xs"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
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

          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={printAfter}
              onChange={(event) => setPrintAfter(event.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            <Printer className="size-3.5" />
            Open printable label sheet right after generating
          </label>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || remaining === 0}>
              {saving ? <LoaderCircle className="animate-spin" /> : <Layers />}
              {saving ? "Generating…" : `Generate ${count} cards`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
