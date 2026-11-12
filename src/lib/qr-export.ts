import { QRCodeSVG } from "qrcode.react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createZipBytes, type ZipEntryInput } from "@/lib/zip";

/** Output width in pixels for exported QR card images. */
export const QR_EXPORT_WIDTH = 1024;
/** Output height in pixels, leaving space below the QR quiet zone for the tracking ID. */
export const QR_EXPORT_HEIGHT = 1076;
/** Muted grey color for the printed tracking label beneath each QR code. */
export const QR_EXPORT_TRACKING_COLOR = "#9CA3AF";
/** Monospace font size in pixels for the exported tracking ID label. */
export const QR_EXPORT_TRACKING_FONT_SIZE = 22;

/** Vector geometry metrics derived from `qrcode.react` for crisp integer-aligned rendering. */
export interface QrSvgGeometry {
  numCells: number;
  fgPath: string;
  modulePx: number;
  offsetX: number;
  offsetY: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Uses qrcode.react's built-in QR matrix generator via static markup to obtain
 * the exact module count (including 4-module quiet zone) and crisp vector path.
 */
export function extractQrSvgGeometry(
  url: string,
  level: "L" | "M" | "Q" | "H" = "Q",
): QrSvgGeometry {
  const markup = renderToStaticMarkup(
    createElement(QRCodeSVG, {
      value: url,
      size: QR_EXPORT_WIDTH,
      level,
      marginSize: 4,
    }),
  );

  const viewBoxMatch = /viewBox="0 0 (\d+) (\d+)"/.exec(markup);
  const numCells = viewBoxMatch?.[1] ? Number.parseInt(viewBoxMatch[1], 10) : 37;

  // The second <path> rendered by QRCodeSVG is always the foreground module path
  const pathMatches = [...markup.matchAll(/<path[^>]*\sd="([^"]+)"[^>]*>/g)];
  const fgPath = pathMatches[1]?.[1] ?? pathMatches[0]?.[1] ?? "";

  if (!fgPath) {
    throw new Error("Could not generate QR code vector geometry.");
  }

  // Integer pixel size per QR module guarantees zero subpixel blur or seams
  const modulePx = Math.max(1, Math.floor(QR_EXPORT_WIDTH / numCells));
  const drawnSize = modulePx * numCells;
  const offsetX = Math.floor((QR_EXPORT_WIDTH - drawnSize) / 2);
  const offsetY = offsetX;

  return {
    numCells,
    fgPath,
    modulePx,
    offsetX,
    offsetY,
  };
}

/**
 * Generates a standalone, print-ready minimal SVG:
 * - Pure white background (#FFFFFF)
 * - Crisp integer-aligned black QR modules with full 4-module quiet zone
 * - Subtle small light-grey tracking ID positioned cleanly outside the QR code area
 */
export function buildQrCardSvg(url: string, trackingId: string): string {
  const { fgPath, modulePx, offsetX, offsetY } = extractQrSvgGeometry(url, "Q");
  const textX = QR_EXPORT_WIDTH / 2;
  const textY = 1036;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${QR_EXPORT_WIDTH}" height="${QR_EXPORT_HEIGHT}" viewBox="0 0 ${QR_EXPORT_WIDTH} ${QR_EXPORT_HEIGHT}" role="img" aria-label="${escapeXml(trackingId)}">`,
    `  <rect width="${QR_EXPORT_WIDTH}" height="${QR_EXPORT_HEIGHT}" fill="#FFFFFF" />`,
    `  <g transform="translate(${offsetX}, ${offsetY}) scale(${modulePx})">`,
    `    <path fill="#000000" d="${fgPath}" shape-rendering="crispEdges" />`,
    `  </g>`,
    `  <text x="${textX}" y="${textY}" text-anchor="middle" fill="${QR_EXPORT_TRACKING_COLOR}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="${QR_EXPORT_TRACKING_FONT_SIZE}" font-weight="500" letter-spacing="1.5">${escapeXml(trackingId)}</text>`,
    `</svg>`,
  ].join("\n");
}

function drawQrCardToCanvas(
  canvas: HTMLCanvasElement,
  geometry: QrSvgGeometry,
  trackingId: string,
): Promise<Blob> {
  canvas.width = QR_EXPORT_WIDTH;
  canvas.height = QR_EXPORT_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new Error("Canvas 2D context is not available."));
  }

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, QR_EXPORT_WIDTH, QR_EXPORT_HEIGHT);

  ctx.save();
  ctx.translate(geometry.offsetX, geometry.offsetY);
  ctx.scale(geometry.modulePx, geometry.modulePx);
  ctx.fillStyle = "#000000";

  if (typeof Path2D !== "undefined") {
    ctx.fill(new Path2D(geometry.fgPath));
  } else {
    // Fallback if Path2D is unavailable in an environment
    ctx.restore();
    return renderSvgFallbackToPngBlob(canvas, geometry, trackingId);
  }
  ctx.restore();

  ctx.fillStyle = QR_EXPORT_TRACKING_COLOR;
  ctx.font = `500 ${QR_EXPORT_TRACKING_FONT_SIZE}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(trackingId, QR_EXPORT_WIDTH / 2, 1030);

  return new Promise<Blob>((resolve, reject) => {
    if (typeof canvas.toBlob === "function") {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Could not encode QR PNG image."));
      }, "image/png");
      return;
    }

    try {
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];
      if (!base64) throw new Error("Invalid data URL");
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      resolve(new Blob([bytes], { type: "image/png" }));
    } catch (err) {
      reject(err instanceof Error ? err : new Error("Could not encode QR PNG image."));
    }
  });
}

async function renderSvgFallbackToPngBlob(
  canvas: HTMLCanvasElement,
  geometry: QrSvgGeometry,
  trackingId: string,
): Promise<Blob> {
  const svgMarkup = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${QR_EXPORT_WIDTH}" height="${QR_EXPORT_HEIGHT}" viewBox="0 0 ${QR_EXPORT_WIDTH} ${QR_EXPORT_HEIGHT}">`,
    `  <rect width="${QR_EXPORT_WIDTH}" height="${QR_EXPORT_HEIGHT}" fill="#FFFFFF" />`,
    `  <g transform="translate(${geometry.offsetX}, ${geometry.offsetY}) scale(${geometry.modulePx})">`,
    `    <path fill="#000000" d="${geometry.fgPath}" />`,
    `  </g>`,
    `</svg>`,
  ].join("\n");

  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const blobUrl = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not load QR SVG image."));
      img.src = blobUrl;
    });

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context is not available.");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, QR_EXPORT_WIDTH, QR_EXPORT_HEIGHT);
    ctx.drawImage(img, 0, 0, QR_EXPORT_WIDTH, QR_EXPORT_HEIGHT);
    ctx.fillStyle = QR_EXPORT_TRACKING_COLOR;
    ctx.font = `500 ${QR_EXPORT_TRACKING_FONT_SIZE}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(trackingId, QR_EXPORT_WIDTH / 2, 1030);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not encode QR PNG image."));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Renders a single QR card onto a canvas and encodes it as a PNG `Blob`.
 * Optionally accepts a reusable `sharedCanvas` to avoid repeated allocations during batch exports.
 */
export async function renderQrCardPngBlob(
  url: string,
  trackingId: string,
  sharedCanvas?: HTMLCanvasElement,
): Promise<Blob> {
  const geometry = extractQrSvgGeometry(url, "Q");
  const canvas = sharedCanvas ?? document.createElement("canvas");
  return drawQrCardToCanvas(canvas, geometry, trackingId);
}

/** Triggers a browser file download for the given `Blob` and schedules object URL cleanup. */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Normalizes a tracking ID or label into a safe archive/download filename segment. */
export function sanitizeArchiveFilenameSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "QR";
}

/** Renders and downloads an individual `1024x1076` print-ready PNG for a single QR card. */
export async function downloadIndividualQrPng(url: string, trackingId: string): Promise<void> {
  const blob = await renderQrCardPngBlob(url, trackingId);
  triggerBlobDownload(blob, `${sanitizeArchiveFilenameSegment(trackingId)}.png`);
}

/** Generates and downloads a standalone crisp vector SVG for a single QR card. */
export function downloadIndividualQrSvg(url: string, trackingId: string): void {
  const svg = buildQrCardSvg(url, trackingId);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  triggerBlobDownload(blob, `${sanitizeArchiveFilenameSegment(trackingId)}.svg`);
}

/** Input descriptor for an individual QR card included in a batch ZIP export. */
export interface BatchZipItem {
  url: string;
  trackingId: string;
  trackingNumber?: number | undefined;
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error("Could not read binary blob."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read binary blob."));
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Renders all requested QR cards into PNGs sorted by tracking number and packages
 * them into an uncompressed ZIP byte array, reporting per-item progress.
 */
export async function buildQrBatchZipBytes(
  items: BatchZipItem[],
  onProgress?: (completed: number, total: number) => void,
): Promise<Uint8Array> {
  if (items.length === 0) {
    throw new Error("No QR codes to export.");
  }

  const ordered = [...items].sort((a, b) => {
    if (a.trackingNumber != null && b.trackingNumber != null) {
      return a.trackingNumber - b.trackingNumber;
    }
    return a.trackingId.localeCompare(b.trackingId, undefined, { numeric: true });
  });

  const canvas = document.createElement("canvas");
  const entries: ZipEntryInput[] = [];
  const usedNames = new Set<string>();
  const now = new Date();

  for (let i = 0; i < ordered.length; i += 1) {
    const item = ordered[i]!;
    const pngBlob = await renderQrCardPngBlob(item.url, item.trackingId, canvas);
    const pngBytes = await blobToUint8Array(pngBlob);

    const baseName = sanitizeArchiveFilenameSegment(item.trackingId);
    let filename = `${baseName}.png`;
    let suffix = 2;
    while (usedNames.has(filename)) {
      filename = `${baseName}-${suffix}.png`;
      suffix += 1;
    }
    usedNames.add(filename);

    entries.push({
      name: filename,
      data: pngBytes,
      modifiedAt: now,
    });

    onProgress?.(i + 1, ordered.length);

    // Yield periodically to keep browser UI responsive on large batches (100-1000 codes)
    if ((i + 1) % 20 === 0 && i + 1 < ordered.length) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });
    }
  }

  return createZipBytes(entries);
}

/** Wraps `buildQrBatchZipBytes` output into an `application/zip` `Blob`. */
export async function buildQrBatchZipBlob(
  items: BatchZipItem[],
  onProgress?: (completed: number, total: number) => void,
): Promise<Blob> {
  const bytes = await buildQrBatchZipBytes(items, onProgress);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Blob([buffer as ArrayBuffer], { type: "application/zip" });
}

/** Builds a batch ZIP archive of QR PNGs and initiates a browser download. */
export async function downloadQrBatchZip(
  items: BatchZipItem[],
  options?: {
    filename?: string;
    onProgress?: (completed: number, total: number) => void;
  },
): Promise<{ count: number; filename: string }> {
  const filename = options?.filename ?? "QR-Studio-Cards.zip";
  const zipBlob = await buildQrBatchZipBlob(items, options?.onProgress);
  triggerBlobDownload(zipBlob, filename);
  return { count: items.length, filename };
}
