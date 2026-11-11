import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { QRRecord } from "@/components/qr/types";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: QRRecord | null;
  onConfirm: (id: string) => Promise<void>;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  code,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!code) return;
    setDeleting(true);
    try {
      await onConfirm(code.id);
      onOpenChange(false);
    } catch {
      // Error handled by parent
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <DialogTitle className="text-center">Delete QR code</DialogTitle>
          <DialogDescription className="text-center">
            Are you sure you want to delete{" "}
            {code?.tracking_id && (
              <span className="mr-1 inline-block rounded bg-secondary px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
                {code.tracking_id}
              </span>
            )}
            <strong className="break-words text-foreground">{code?.name}</strong>? This will
            permanently remove the QR code and all its scan history. Tracking ID{" "}
            <span className="font-mono">{code?.tracking_id}</span> will remain retired and never be
            reassigned.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-center">
          <Button
            type="button"
            variant="outline"
            className="h-10 sm:h-9"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-10 sm:h-9"
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
