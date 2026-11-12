const KB = 1024;

/** A speed in the router's KB/s, shown like the router's own page: MB/s above 1024 KB/s. */
export function formatKbs(kbs: number): string {
  if (kbs >= KB) return `${(kbs / KB).toFixed(kbs >= 10 * KB ? 0 : 1)} MB/s`;
  return `${Math.round(kbs)} KB/s`;
}

export function formatBytesPerSecond(bytes: number): string {
  return formatKbs(bytes / KB);
}
