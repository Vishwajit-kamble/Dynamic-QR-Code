import type { getQrWorkspace } from "@/lib/qr-workspace.functions";

export type WorkspaceData = Awaited<ReturnType<typeof getQrWorkspace>>;
export type QRRecord = WorkspaceData["codes"][number];
export type ScanRecord = WorkspaceData["scans"][number];
export type Period = 7 | 30 | 90;
export type View = "overview" | "codes";
export type StatusFilter = "all" | "active" | "paused" | "unlinked";
