import { Check, Link2, LoaderCircle, Plus } from "lucide-react";
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
import type { QRRecord } from "@/components/qr/types";
import {
  canCreateQrCode,
  formatBatchCardName,
  formatTrackingId,
  isUnlinkedDestination,
  MAX_QR_CODES,
  UNLINKED_DESTINATION_URL,
} from "@/lib/qr-workspace";

interface QRCodeEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: QRRecord | null;
  codesCount: number;
  nextTrackingNumber?: number;
  onSubmit: (name: string, url: string, isActive?: boolean) => Promise<void>;
}

export function QRCodeEditor({
  open,
  onOpenChange,
  editing,
  codesCount,
  nextTrackingNumber = 1,
  onSubmit,
}: QRCodeEditorProps) {
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [leaveUnlinked, setLeaveUnlinked] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const editingWasUnlinked = Boolean(editing && isUnlinkedDestination(editing.destination_url));
  const upcomingTrackingId = formatTrackingId(nextTrackingNumber);

  useEffect(() => {
    if (open) {
      if (editing) {
        setFormName(editing.name);
        setFormUrl(isUnlinkedDestination(editing.destination_url) ? "" : editing.destination_url);
        setLeaveUnlinked(false);
      } else {
        setFormName("");
        setFormUrl("");
        setLeaveUnlinked(false);
      }
      setFormError("");
    }
  }, [open, editing]);

  const submitCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    const trimmedName = formName.trim();
    if (!trimmedName || trimmedName.length > 100) {
      setFormError("Add a name of 1 to 100 characters.");
      return;
    }

    let finalUrl = UNLINKED_DESTINATION_URL;
    if (!leaveUnlinked) {
      const trimmedUrl = formUrl.trim();
      try {
        const url = new URL(trimmedUrl);
        if ((url.protocol !== "https:" && url.protocol !== "http:") || trimmedUrl.length > 2048) {
          throw new Error("Use a web address beginning with http:// or https://.");
        }
        finalUrl = trimmedUrl;
      } catch (cause) {
        setFormError(
          cause instanceof Error && cause.message.startsWith("Use")
            ? cause.message
            : "Enter a complete web address starting with https://.",
        );
        return;
      }
    }

    if (!editing && !canCreateQrCode(codesCount)) {
      setFormError(`Your workspace is at the ${MAX_QR_CODES}-code limit.`);
      return;
    }
    setSaving(true);
    try {
      await onSubmit(trimmedName, finalUrl, !leaveUnlinked);
      onOpenChange(false);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not save your QR code.";
      setFormError(
        message.includes("QR codes") && message.includes(`${MAX_QR_CODES}`)
          ? `Your workspace is at the ${MAX_QR_CODES}-code limit.`
          : message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[470px]">
        <DialogHeader className="min-w-0 text-left">
          <DialogTitle className="pr-9">
            {editing
              ? editingWasUnlinked
                ? "Assign customer link"
                : "Edit QR code"
              : "Create a QR code"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? editingWasUnlinked
                ? `${editing.tracking_id} (Card ID: ${editing.code}) — paste the buyer’s Google Review link to activate this pre-printed card.`
                : `${editing.tracking_id} · Update the name or destination. The printed code won't change.`
              : `Assigns permanent Tracking ID ${upcomingTrackingId}. Give your card a name and paste the Google Review or destination URL.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submitCode(event)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="qr-name">
              Name
            </label>
            <Input
              id="qr-name"
              value={formName}
              maxLength={100}
              aria-invalid={Boolean(formError && !formName.trim())}
              onChange={(event) => {
                setFormName(event.target.value);
                if (formError) setFormError("");
              }}
              placeholder="e.g. Arambh Hotel — Review Card"
              autoFocus
            />
          </div>

          {!editing && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs leading-snug text-muted-foreground">
              <input
                type="checkbox"
                checked={leaveUnlinked}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setLeaveUnlinked(checked);
                  if (checked && !formName.trim()) {
                    setFormName(formatBatchCardName("Google Review Card", nextTrackingNumber));
                  }
                  if (formError) setFormError("");
                }}
                className="size-4 shrink-0 rounded border-input accent-primary"
              />
              <span>Pre-print blank card now (assign customer’s Google Review link later)</span>
            </label>
          )}

          {!leaveUnlinked && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="qr-url">
                Destination address
              </label>
              <Input
                id="qr-url"
                type="url"
                value={formUrl}
                maxLength={2048}
                aria-invalid={Boolean(formError)}
                onChange={(event) => {
                  setFormUrl(event.target.value);
                  if (formError) setFormError("");
                }}
                placeholder="https://g.page/r/..."
              />
              <p className="text-[11px] text-muted-foreground">
                Supports Google Review links (g.page/r/..., search.google.com/local/writereview) or
                any website.
              </p>
            </div>
          )}

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          <p className="flex items-center gap-2 rounded-md bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">
            <Link2 className="size-4 shrink-0 text-primary" />
            {editingWasUnlinked
              ? "Saving a valid link will automatically activate this card for customer scans."
              : "You can change the destination later without reprinting your QR card."}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-10 sm:h-9"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-10 sm:h-9" disabled={saving}>
              {saving ? <LoaderCircle className="animate-spin" /> : editing ? <Check /> : <Plus />}
              {saving ? "Saving…" : editing ? "Save changes" : "Create code"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
