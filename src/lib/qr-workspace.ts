/** Maximum number of QR codes allowed in a single workspace. */
export const MAX_QR_CODES = 1000;
/** Maximum number of QR cards that can be created in a single batch operation. */
export const MAX_BATCH_CREATE = 50;
/** Placeholder destination assigned to newly generated unlinked cards prior to sale. */
export const UNLINKED_DESTINATION_URL = "https://unlinked.qrstudio.invalid/assign-customer";

/** Active persistence backend detected by the server runtime. */
export type StorageMode = "postgres" | "supabase" | "local-file" | "unconfigured-serverless";

/** Formats a 1-based card sequence number as a zero-padded 4-digit string (e.g. `0001`). */
export function formatTrackingNumber(sequenceNumber: number): string {
  const safe = Number.isFinite(sequenceNumber) ? Math.max(1, Math.floor(sequenceNumber)) : 1;
  return String(safe).padStart(4, "0");
}

/** Builds a human-readable permanent tracking identifier (e.g. `QR-0001`). */
export function formatTrackingId(sequenceNumber: number): string {
  return `QR-${formatTrackingNumber(sequenceNumber)}`;
}

/** Constructs a truncated batch card label ending with `#0001`-style numbering. */
export function formatBatchCardName(prefix: string, sequenceNumber: number): string {
  const cleanPrefix = prefix.trim() || "Google Review Card";
  const suffix = ` #${formatTrackingNumber(sequenceNumber)}`;
  const maxPrefixLen = Math.max(1, 100 - suffix.length);
  return `${cleanPrefix.slice(0, maxPrefixLen)}${suffix}`;
}

/** Extracts the trailing `#<number>` sequence from a card name, or `null` if absent. */
export function extractTrailingSequenceNumber(name: string): number | null {
  const match = /#(\d+)\s*$/.exec(name.trim());
  if (!match?.[1]) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Checks whether adding `addCount` codes stays within `MAX_QR_CODES`. */
export function canCreateQrCode(currentCount: number, addCount = 1): boolean {
  return currentCount + addCount <= MAX_QR_CODES;
}

/** Returns `true` when the URL matches the unlinked placeholder destination. */
export function isUnlinkedDestination(url: string): boolean {
  return url === UNLINKED_DESTINATION_URL;
}

/** Returns `true` when an origin points to localhost, LAN, or an invalid URL. */
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
