import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  Smartphone,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isPrivateOrLocalOrigin, isUnlinkedDestination } from "@/lib/qr-workspace";
import type { QRRecord } from "@/components/qr/types";

interface QRPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: QRRecord | null;
  origin: string;
  lanOrigin: string | null;
  useLanOrigin: boolean;
  onUseLanOriginChange: (value: boolean) => void;
  customOrigin?: string;
  onTestedScan?: () => void;
}

export function QRPreviewDialog({
  open,
  onOpenChange,
  code,
  origin,
  lanOrigin,
  useLanOrigin,
  onUseLanOriginChange,
  customOrigin = "",
  onTestedScan,
}: QRPreviewDialogProps) {
  const [copied, setCopied] = useState(false);
  const svgWrapperRef = useRef<HTMLDivElement>(null);

  if (!code) return null;

  const activeOrigin = customOrigin || (useLanOrigin && lanOrigin ? lanOrigin : origin);
  const qrUrl = activeOrigin ? `${activeOrigin}/r/${code.code}` : `/r/${code.code}`;
  const hasLanOption = Boolean(!customOrigin && lanOrigin && lanOrigin !== origin);
  const isUnlinked = isUnlinkedDestination(code.destination_url);
  const isLocalPrintRisk = activeOrigin ? isPrivateOrLocalOrigin(activeOrigin) : true;
  const safeFileSlug =
    code.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "qr-code";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      toast.success("QR short link copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy link to clipboard.");
    }
  };

  const handleDownloadSvg = () => {
    const svg = svgWrapperRef.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${safeFileSlug}.svg`;
    link.href = url;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadPng = async () => {
    const svg = svgWrapperRef.current?.querySelector("svg");
    if (!svg) return;
    try {
      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = blobUrl;
      });
      const size = 1024;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(blobUrl);

      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `${safeFileSlug}.png`;
      link.href = pngUrl;
      link.click();
    } catch {
      toast.error("Could not export PNG.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader className="min-w-0 text-left">
          <DialogTitle className="flex min-w-0 flex-wrap items-center gap-2 pr-9 leading-snug">
            <span className="min-w-0 break-words py-0.5 sm:truncate">{code.name}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                isUnlinked
                  ? "bg-amber-500/15 text-amber-700"
                  : code.is_active
                    ? "bg-chart-2/15 text-chart-2"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isUnlinked ? "Unlinked" : code.is_active ? "Active" : "Paused"}
            </span>
          </DialogTitle>
          <DialogDescription
            className="min-w-0 line-clamp-2 [overflow-wrap:anywhere] sm:line-clamp-none sm:truncate"
            title={isUnlinked ? "Unlinked inventory card" : code.destination_url}
          >
            {isUnlinked
              ? `Card ID: ${code.code} · Assign customer Google Review link when sold`
              : `Redirects to ${code.destination_url}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex w-full min-w-0 flex-col items-center gap-3 py-0.5 sm:gap-3.5 sm:py-1">
          <div
            ref={svgWrapperRef}
            className="rounded-xl border border-border bg-white p-2.5 shadow-xs sm:p-3"
          >
            <QRCodeSVG
              value={qrUrl}
              size={220}
              level="M"
              includeMargin
              className="h-44 w-44 sm:h-[212px] sm:w-[212px]"
            />
          </div>

          <span className="max-w-full truncate rounded-md bg-muted px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
            Card ID: {code.code}
          </span>

          {isLocalPrintRisk && (
            <div className="flex w-full min-w-0 items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <p className="min-w-0 text-muted-foreground">
                <strong className="font-medium text-foreground">Local test URL:</strong> Only works
                while this PC is on. Deploy or set a public{" "}
                <strong className="font-medium text-foreground">Custom URL</strong> before bulk
                printing cards to sell.
              </p>
            </div>
          )}

          {!code.is_active && (
            <p className="w-full min-w-0 rounded-md border border-border bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
              {isUnlinked
                ? "This pre-printed card is ready to sell. Edit it to attach the customer's Google Review link and activate."
                : "This QR code is currently paused. Scanning it will show an unavailable page until activated."}
            </p>
          )}

          {hasLanOption && (
            <div className="flex w-full min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-secondary px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-2 text-muted-foreground">
                <Smartphone className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">Scan from your phone camera</p>
                  <p className="mt-0.5">
                    {useLanOrigin
                      ? "Using your Wi-Fi IP so phones on the same Wi-Fi connect directly."
                      : "Switch from localhost to your Wi-Fi IP so phones can connect."}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant={useLanOrigin ? "outline" : "default"}
                className="h-9 w-full shrink-0 bg-background text-xs sm:h-8 sm:w-auto"
                onClick={() => onUseLanOriginChange(!useLanOrigin)}
              >
                {useLanOrigin ? "Use localhost" : "Use Wi-Fi URL"}
              </Button>
            </div>
          )}

          <div className="flex w-full min-w-0 items-center gap-2 rounded-md border border-border bg-muted/60 py-1.5 pl-3 pr-1.5 sm:py-2 sm:pr-2">
            <code className="min-w-0 flex-1 truncate text-xs text-foreground">{qrUrl}</code>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-9 shrink-0 sm:size-7"
              onClick={() => void handleCopy()}
              aria-label="Copy short link"
              title="Copy short link"
            >
              {copied ? (
                <Check className="size-4 text-chart-2 sm:size-3.5" />
              ) : (
                <Copy className="size-4 sm:size-3.5" />
              )}
            </Button>
          </div>
        </div>

        <DialogFooter className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full sm:h-9 sm:w-auto"
            onClick={() => void handleDownloadPng()}
          >
            <Download /> Download PNG
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full sm:h-9 sm:w-auto"
            aria-label="Download SVG"
            onClick={handleDownloadSvg}
          >
            <FileCode2 /> SVG
          </Button>
          <Button asChild className="col-span-2 h-10 w-full sm:ml-auto sm:h-9 sm:w-auto">
            <a
              href={qrUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                if (onTestedScan) {
                  window.setTimeout(onTestedScan, 700);
                }
              }}
            >
              <ExternalLink /> Test scan link
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
