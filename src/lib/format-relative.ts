/** Formats an ISO timestamp into a compact relative label (`Just now`, `5m ago`, `2h ago`, `3d ago`). */
export function formatRelative(value: string) {
  const difference = Date.now() - new Date(value).getTime();
  if (difference < 60_000) return "Just now";
  if (difference < 3_600_000) return `${Math.floor(difference / 60_000)}m ago`;
  if (difference < 86_400_000) return `${Math.floor(difference / 3_600_000)}h ago`;
  return `${Math.floor(difference / 86_400_000)}d ago`;
}
