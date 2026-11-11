import type { BandwidthBucket, BandwidthPoint } from "@/lib/api";

export type BandwidthBar = { start: number; end: number; rx: number; tx: number; hasData: boolean };

function bucketStart(t: number, bucket: BandwidthBucket): number {
  const date = new Date(t);
  if (bucket === "day") date.setHours(0, 0, 0, 0);
  else if (bucket === "hour") date.setMinutes(0, 0, 0);
  else date.setMinutes(Math.floor(date.getMinutes() / 10) * 10, 0, 0);
  return date.getTime();
}

function nextBucket(t: number, bucket: BandwidthBucket): number {
  const date = new Date(t);
  if (bucket === "day") date.setDate(date.getDate() + 1);
  else if (bucket === "hour") date.setHours(date.getHours() + 1);
  else date.setMinutes(date.getMinutes() + 10);
  return date.getTime();
}

/** One entry per 10 minutes, hour or day in the range; `hasData` is false where no traffic sample was stored. */
export function buildBars(items: BandwidthPoint[], bucket: BandwidthBucket, from: number, to: number): BandwidthBar[] {
  const byStart = new Map(items.map((item) => [Date.parse(item.start), item]));
  const bars: BandwidthBar[] = [];
  for (let t = bucketStart(from, bucket); t <= to; t = nextBucket(t, bucket)) {
    const item = byStart.get(t);
    bars.push({ start: t, end: nextBucket(t, bucket), rx: item?.rx_bytes ?? 0, tx: item?.tx_bytes ?? 0, hasData: !!item });
  }
  return bars;
}

export function formatBucket(t: number, bucket: BandwidthBucket, long = false): string {
  const options: Intl.DateTimeFormatOptions =
    bucket === "day"
      ? { weekday: long ? "short" : undefined, day: "numeric", month: "short" }
      : {
          day: long ? "numeric" : undefined,
          month: long ? "short" : undefined,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        };
  return new Intl.DateTimeFormat(undefined, options).format(t);
}
