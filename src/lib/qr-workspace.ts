export const MAX_QR_CODES = 1000;
export const MAX_BATCH_CREATE = 50;
export const UNLINKED_DESTINATION_URL = "https://unlinked.qrstudio.invalid/assign-customer";

export type StorageMode = "postgres" | "supabase" | "local-file" | "unconfigured-serverless";

export function formatTrackingNumber(sequenceNumber: number): string {
  const safe = Number.isFinite(sequenceNumber) ? Math.max(1, Math.floor(sequenceNumber)) : 1;
  return String(safe).padStart(4, "0");
}

export function formatTrackingId(sequenceNumber: number): string {
  return `QR-${formatTrackingNumber(sequenceNumber)}`;
}

export function formatBatchCardName(prefix: string, sequenceNumber: number): string {
  const cleanPrefix = prefix.trim() || "Google Review Card";
  const suffix = ` #${formatTrackingNumber(sequenceNumber)}`;
  const maxPrefixLen = Math.max(1, 100 - suffix.length);
  return `${cleanPrefix.slice(0, maxPrefixLen)}${suffix}`;
}

export function extractTrailingSequenceNumber(name: string): number | null {
  const match = /#(\d+)\s*$/.exec(name.trim());
  if (!match?.[1]) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function canCreateQrCode(currentCount: number, addCount = 1): boolean {
  return currentCount + addCount <= MAX_QR_CODES;
}

export function isUnlinkedDestination(url: string): boolean {
  return url === UNLINKED_DESTINATION_URL;
}

export function isPrivateOrLocalOrigin(origin: string): boolean {
  if (!origin) return true;
  try {
    const { hostname } = new URL(origin);
    const cleanHost = hostname.toLowerCase();
    return (
      cleanHost === "localhost" ||
      cleanHost === "127.0.0.1" ||
      cleanHost === "::1" ||
      cleanHost === "[::1]" ||
      cleanHost.startsWith("10.") ||
      cleanHost.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(cleanHost) ||
      cleanHost.endsWith(".local")
    );
  } catch {
    return true;
  }
}
