import { ChartLegend } from "@/components/stats/chart-legend";
import type { Segment } from "@/lib/api";
import { STATUS_COLORS } from "@/lib/chart-colors";
import { formatTimeTick, formatTooltipTime, timeTicks } from "@/lib/chart-time";
import { hopLabel } from "@/lib/hops";
import { formatElapsed } from "@/lib/outage-format";

// Ticks are laid out for a typical card width; every other one hides on small screens
const ASSUMED_WIDTH_PX = 720;
// The latest check counts as the current state for this long after it
const MAX_CHECK_GAP_MS = 5 * 60_000;

export type TimelineSpan = { start: number; end: number; online: boolean | null; break_at: string | null };

export function buildSpans(segments: Segment[], from: number, to: number): TimelineSpan[] {
  const spans: TimelineSpan[] = segments
    .map((segment) => ({
      start: Math.max(from, Date.parse(segment.start)),
      end: Math.min(to, Date.parse(segment.end)),
      online: segment.online,
      break_at: segment.break_at,
    }))
    .filter((span) => span.end >= span.start);

  const last = spans.at(-1);
  if (last && to - last.end <= MAX_CHECK_GAP_MS) last.end = to;
  else if (last) spans.push({ start: last.end, end: to, online: null, break_at: null });
  return spans;
}

export function TimelineLegend() {
  return (
    <ChartLegend
      items={[
        { label: "Online", color: STATUS_COLORS.online },
        { label: "Offline", color: STATUS_COLORS.offline },
        { label: "No data", color: STATUS_COLORS.noData },
      ]}
    />
  );
}

function spanLabel(span: TimelineSpan): string {
  if (span.online === null) return "No data";
  return span.online ? "Online" : `Offline · cut at ${hopLabel(span.break_at)}`;
}

function spanColor(span: TimelineSpan): string {
  if (span.online === null) return STATUS_COLORS.noData;
  return span.online ? STATUS_COLORS.online : STATUS_COLORS.offline;
}

type ConnectionTimelineProps = {
  spans: TimelineSpan[];
  from: number;
  to: number;
  /** Hidden when several timelines stack and share one legend. */
  legend?: boolean;
};

export function ConnectionTimeline({ spans, from, to, legend = true }: ConnectionTimelineProps) {
  const range = to - from;
  const percent = (t: number) => `${((t - from) / range) * 100}%`;
  const ticks = timeTicks(from, to, ASSUMED_WIDTH_PX);

  return (
    <div className="flex flex-col gap-3">
      {legend && <TimelineLegend />}
      <div className="relative">
        <ul aria-label="Connection timeline" className="relative h-10 overflow-visible rounded-md bg-zinc-100 dark:bg-zinc-800">
          {spans.map((span, index) => (
            <li
              key={index}
              tabIndex={0}
              aria-label={`${spanLabel(span)} from ${formatTooltipTime(span.start)} to ${formatTooltipTime(span.end)}`}
              className="group absolute inset-y-0 outline-none"
              style={{ left: percent(span.start), width: `max(2px, ${((span.end - span.start) / range) * 100}%)` }}
            >
              <span
                className="block h-full border-x border-white transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80 dark:border-zinc-900"
                style={{ background: spanColor(span) }}
              />
              <span className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm group-hover:visible group-focus-visible:visible dark:border-zinc-700 dark:bg-zinc-800">
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: spanColor(span) }} />
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{spanLabel(span)}</span>
                </span>
                <span className="mt-0.5 block whitespace-nowrap text-zinc-500 tabular-nums dark:text-zinc-400">
                  {formatTooltipTime(span.start)} → {formatTooltipTime(span.end)} · {formatElapsed(span.end - span.start)}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <div aria-hidden className="relative mt-1 h-5 text-xs">
          {ticks.map((tick, index) => (
            <span
              key={tick}
              className={`absolute -translate-x-1/2 whitespace-nowrap tabular-nums text-zinc-500 dark:text-zinc-400 ${
                index % 2 === 1 ? "hidden sm:inline" : ""
              }`}
              style={{ left: percent(tick) }}
            >
              {formatTimeTick(tick, range)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
