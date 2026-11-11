
const TICK_STEPS = [0.25, 0.5, 1, 2, 4, 6, 12, 24, 48];
const MAX_TICKS = 6;

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  return `${hours.toFixed(1)} h`;
}

export function formatDateTime(value: string): string {
  return dateTimeFormat.format(new Date(value));
}

export function hourTicks(maxHours: number): number[] {
  const step = TICK_STEPS.find((candidate) => maxHours / candidate <= MAX_TICKS - 1) ?? TICK_STEPS.at(-1)!;
  const top = Math.max(step, Math.ceil(maxHours / step) * step);
  const ticks: number[] = [];
  for (let tick = 0; tick <= top + 1e-9; tick += step) ticks.push(Math.round(tick * 100) / 100);
  return ticks;
}

export function formatTick(hours: number): string {
  return hours < 1 && hours > 0 ? `${hours * 60} min` : `${hours} h`;
}

export function formatElapsed(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days} d ${hours % 24} h` : `${days} d`;
}
