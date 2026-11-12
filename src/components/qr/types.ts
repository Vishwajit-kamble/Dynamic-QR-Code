import type { getQrWorkspace } from "@/lib/qr-workspace.functions";

/** Full workspace payload returned by the `getQrWorkspace` server function. */
export type WorkspaceData = Awaited<ReturnType<typeof getQrWorkspace>>;
/** Single dynamic QR card entry stored in the workspace. */
export type QRRecord = WorkspaceData["codes"][number];
/** Individual scan analytics event recorded by `/r/$code`. */
export type ScanRecord = WorkspaceData["scans"][number];
/** Supported analytics lookback window in days. */
export type Period = 7 | 30 | 90;
/** Primary dashboard tab selection. */
export type View = "overview" | "codes";
/** Inventory table status filter options. */
export type StatusFilter = "all" | "active" | "paused" | "unlinked";
