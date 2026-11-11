const HOUR_MS = 3_600_000;
const MIN_TICK_SPACING = 56;

function tickStepMs(rangeMs: number): number {
  if (rangeMs <= HOUR_MS) return 10 * 60_000;
  if (rangeMs <= 6 * HOUR_MS) return HOUR_MS;
  if (rangeMs <= 24 * HOUR_MS) return 4 * HOUR_MS;
  return 24 * HOUR_MS;
}

export function timeTicks(from: number, to: number, innerWidth: number): number[] {
  const step = tickStepMs(to - from);
  const start = new Date(from);
  if (step >= 24 * HOUR_MS) start.setHours(0, 0, 0, 0);
  else if (step >= HOUR_MS) start.setMinutes(0, 0, 0);
  else start.setMinutes(Math.floor(start.getMinutes() / 10) * 10, 0, 0);

  const ticks: number[] = [];
  for (let t = start.getTime(); t <= to; t += step) {
    if (t >= from) ticks.push(t);
  }
  const spacing = (innerWidth * step) / (to - from);
  const every = Math.max(1, Math.ceil(MIN_TICK_SPACING / Math.max(spacing, 1)));
  return ticks.filter((_, index) => index % every === 0);
}

export function formatTimeTick(t: number, rangeMs: number): string {
  const options: Intl.DateTimeFormatOptions =
    rangeMs > 24 * HOUR_MS ? { day: "numeric", month: "short" } : { hour: "2-digit", minute: "2-digit", hour12: false };
  return new Intl.DateTimeFormat(undefined, options).format(t);
}

export function formatTooltipTime(t: number): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(t);
}
