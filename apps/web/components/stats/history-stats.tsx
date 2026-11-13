import { ChartCard } from "@/components/stats/chart-card";
import { buildSpans, ConnectionTimeline, type TimelineSpan, TimelineLegend } from "@/components/stats/connection-timeline";
import { RangeFilter } from "@/components/stats/range-filter";
import { StatusMessage } from "@/components/status-message";
import { ApiUnavailableError, type DailyHistory, getDailyHistory } from "@/lib/api";
import { DAY_RANGES, parseTimeRange } from "@/lib/time-ranges";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function onlineShare(spans: TimelineSpan[]): { measuredMs: number; onlineMs: number } {
  const measured = spans.filter((span) => span.online !== null);
  return {
    measuredMs: measured.reduce((sum, span) => sum + span.end - span.start, 0),
    onlineMs: measured.filter((span) => span.online).reduce((sum, span) => sum + span.end - span.start, 0),
  };
}

function formatUptime({ measuredMs, onlineMs }: { measuredMs: number; onlineMs: number }): string {
  return measuredMs > 0 ? `${((onlineMs / measuredMs) * 100).toFixed(1)}% online` : "No checks";
}

function formatDay(dayStart: number, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(dayStart);
}

/** Online and offline periods per day, today first: each bar runs from 00:00 to midnight, whatever the time is now. */
export async function HistoryStats({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const range = parseTimeRange(params.historyHours, DAY_RANGES, DAY_RANGES[0]);
  const dayCount = range.hours / 24;

  let history: DailyHistory;
  try {
    history = await getDailyHistory(dayCount);
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return <StatusMessage title="API unavailable" body="Could not load data from the API. Make sure it is running." />;
    }
    throw error;
  }

  // The rest of today has not happened yet, so its spans stop at the moment of the fetch
  const days = history.days.map((day) => {
    const spans = buildSpans(day.segments, day.dayStart, Math.min(day.dayEnd, history.fetchedAt));
    return { ...day, spans, share: onlineShare(spans) };
  });
  const total = days.reduce(
    (sum, day) => ({ measuredMs: sum.measuredMs + day.share.measuredMs, onlineMs: sum.onlineMs + day.share.onlineMs }),
    { measuredMs: 0, onlineMs: 0 },
  );
  const subtitle = dayCount === 1 ? "Today, 00:00 to 23:59" : `Last ${dayCount} days`;

  return (
    <ChartCard
      id="history-chart-title"
      title="Online / offline"
      subtitle={`${subtitle} · ${formatUptime(total)}`}
      actions={
        <RangeFilter
          label="Online / offline days"
          param="historyHours"
          ranges={DAY_RANGES}
          selected={range}
          searchParams={params}
        />
      }
    >
      {dayCount === 1 ? (
        days[0].segments.length === 0 ? (
          <p className="flex h-20 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
            No checks today yet.
          </p>
        ) : (
          <ConnectionTimeline spans={days[0].spans} from={days[0].dayStart} to={days[0].dayEnd} />
        )
      ) : (
        <div className="flex flex-col gap-4">
          <TimelineLegend />
          {days.map((day, index) => (
            <div key={day.dayStart} className="flex flex-col gap-1">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatDay(day.dayStart, index)}</span>
                {" · "}
                {formatUptime(day.share)}
              </p>
              {day.segments.length === 0 ? (
                <p className="flex h-10 items-center justify-center rounded-md bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  No checks this day.
                </p>
              ) : (
                <ConnectionTimeline spans={day.spans} from={day.dayStart} to={day.dayEnd} legend={false} />
              )}
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}
