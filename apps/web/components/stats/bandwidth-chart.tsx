import { ChartLegend } from "@/components/stats/chart-legend";
import type { BandwidthBucket, BandwidthPoint } from "@/lib/api";
import { byteTicks, formatBytes } from "@/lib/bytes-format";
import { SERIES_COLORS } from "@/lib/chart-colors";

const MAX_X_LABELS = 8;

export type BandwidthBar = { start: number; rx: number; tx: number };

function bucketStart(t: number, bucket: BandwidthBucket): number {
  const date = new Date(t);
  if (bucket === "day") date.setHours(0, 0, 0, 0);
  else date.setMinutes(0, 0, 0);
  return date.getTime();
}

function nextBucket(t: number, bucket: BandwidthBucket): number {
  const date = new Date(t);
  if (bucket === "day") date.setDate(date.getDate() + 1);
  else date.setHours(date.getHours() + 1);
  return date.getTime();
}

/** One bar per hour or day in the range, including the ones without traffic. */
export function buildBars(items: BandwidthPoint[], bucket: BandwidthBucket, from: number, to: number): BandwidthBar[] {
  const byStart = new Map(items.map((item) => [Date.parse(item.start), item]));
  const bars: BandwidthBar[] = [];
  for (let t = bucketStart(from, bucket); t <= to; t = nextBucket(t, bucket)) {
    const item = byStart.get(t);
    bars.push({ start: t, rx: item?.rx_bytes ?? 0, tx: item?.tx_bytes ?? 0 });
  }
  return bars;
}

function formatBucket(t: number, bucket: BandwidthBucket, long = false): string {
  const options: Intl.DateTimeFormatOptions =
    bucket === "day"
      ? { weekday: long ? "short" : undefined, day: "numeric", month: "short" }
      : { day: long ? "numeric" : undefined, month: long ? "short" : undefined, hour: "2-digit", minute: "2-digit", hour12: false };
  return new Intl.DateTimeFormat(undefined, options).format(t);
}

export function BandwidthChart({ bars, bucket }: { bars: BandwidthBar[]; bucket: BandwidthBucket }) {
  const ticks = byteTicks(Math.max(...bars.map((bar) => bar.rx + bar.tx)));
  const top = ticks.at(-1)!;
  const percent = (bytes: number) => `${(bytes / top) * 100}%`;
  const labelEvery = Math.ceil(bars.length / MAX_X_LABELS);

  return (
    <div className="flex flex-col gap-3 text-xs">
      <ChartLegend
        items={[
          { label: "Download", color: SERIES_COLORS.download },
          { label: "Upload", color: SERIES_COLORS.upload },
        ]}
      />
      <div className="flex">
        <div aria-hidden className="relative h-56 w-16 shrink-0">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-2 translate-y-1/2 tabular-nums text-zinc-500 dark:text-zinc-400"
              style={{ bottom: percent(tick) }}
            >
              {formatBytes(tick)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-56">
            {ticks.map((tick) => (
              <span
                key={tick}
                aria-hidden
                className="absolute inset-x-0 h-px bg-zinc-200 dark:bg-zinc-800"
                style={{ bottom: percent(tick) }}
              />
            ))}

            <ul aria-label="Traffic per period" className="absolute inset-0 flex items-end gap-[2px]">
              {bars.map((bar) => (
                <li
                  key={bar.start}
                  tabIndex={0}
                  aria-label={`${formatBucket(bar.start, bucket, true)}: ${formatBytes(bar.rx)} downloaded, ${formatBytes(bar.tx)} uploaded`}
                  className="group relative flex h-full min-w-0 flex-1 flex-col justify-end outline-none"
                >
                  <span
                    className="flex flex-col justify-end gap-[2px] transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                    style={{ height: percent(bar.rx + bar.tx) }}
                  >
                    {bar.tx > 0 && (
                      <span
                        className="block min-h-px rounded-t-[4px]"
                        style={{ background: SERIES_COLORS.upload, flexBasis: `${(bar.tx / (bar.rx + bar.tx)) * 100}%` }}
                      />
                    )}
                    {bar.rx > 0 && (
                      <span
                        className={`block min-h-px ${bar.tx > 0 ? "" : "rounded-t-[4px]"}`}
                        style={{ background: SERIES_COLORS.download, flexBasis: `${(bar.rx / (bar.rx + bar.tx)) * 100}%` }}
                      />
                    )}
                  </span>

                  <span className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm group-hover:visible group-focus-visible:visible dark:border-zinc-700 dark:bg-zinc-800">
                    <span className="block whitespace-nowrap font-medium text-zinc-900 dark:text-zinc-50">
                      {formatBucket(bar.start, bucket, true)}
                    </span>
                    {[
                      { label: "Download", value: bar.rx, color: SERIES_COLORS.download },
                      { label: "Upload", value: bar.tx, color: SERIES_COLORS.upload },
                    ].map((row) => (
                      <span key={row.label} className="mt-0.5 flex items-center gap-2 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: row.color }} />
                        {row.label}
                        <span className="ml-auto pl-3 font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                          {formatBytes(row.value)}
                        </span>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div aria-hidden className="mt-1 flex gap-[2px]">
            {bars.map((bar, index) => (
              <span key={bar.start} className="relative h-5 min-w-0 flex-1">
                {index % labelEvery === 0 && (
                  <span className="absolute left-0 whitespace-nowrap tabular-nums text-zinc-500 dark:text-zinc-400">
                    {formatBucket(bar.start, bucket)}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
