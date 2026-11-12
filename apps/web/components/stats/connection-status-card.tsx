import { ChartCard } from "@/components/stats/chart-card";
import { StatusTile } from "@/components/stats/status-tile";
import { StatusMessage } from "@/components/status-message";
import { ApiUnavailableError, type ConnectionStatusResult, getConnectionStatus } from "@/lib/api";
import { hopLabel } from "@/lib/hops";
import { formatElapsed } from "@/lib/outage-format";

const HOUR_MS = 3_600_000;

const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

function hoursValue(hours: number): string {
  return hours > 0 ? formatElapsed(hours * HOUR_MS) : "None";
}

function share(part: number, whole: number): string {
  return `${whole > 0 ? Math.round((part / whole) * 100) : 0}% of the time`;
}

/** A moment shown as its time, with the day and any notes under it. */
function moment(label: string, value: string | null, ...notes: (string | false)[]) {
  if (!value) return undefined;
  const date = new Date(value);
  return {
    label,
    value: timeFormat.format(date),
    detail: [dayFormat.format(date), ...notes.filter(Boolean)].join(" · "),
  };
}

/** Hours online and offline in the last 24 hours, with when the connection last went out and came back. */
export async function ConnectionStatusCard() {
  let result: ConnectionStatusResult;
  try {
    result = await getConnectionStatus();
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return <StatusMessage title="API unavailable" body="Could not load data from the API. Make sure it is running." />;
    }
    throw error;
  }

  const { status } = result;

  if (status.online === null || status.current_since === null) {
    return (
      <ChartCard id="connection-status-title" title="Connection status" subtitle="No checks yet">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">The status will appear once the API stores a check.</p>
      </ChartCard>
    );
  }

  const recorded = status.online_hours + status.offline_hours;
  const wentOut = status.online
    ? moment(
        "Went out",
        status.last_outage?.start ?? null,
        status.last_outage?.break_at ? `cut at ${hopLabel(status.last_outage.break_at)}` : false,
      )
    : moment("Went out", status.current_since, `cut at ${hopLabel(status.break_at)}`, "still out");
  const cameBack = status.online
    ? moment("Came back", status.current_since)
    : moment("Came back", status.last_online_period?.start ?? null);

  return (
    <ChartCard
      id="connection-status-title"
      title="Connection status"
      subtitle={`${status.online ? "Internet is answering" : `Cut at ${hopLabel(status.break_at)}`} · last 24 hours`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <StatusTile
          tone="green"
          label="Hours online"
          value={hoursValue(status.online_hours)}
          detail={share(status.online_hours, recorded)}
          aside={cameBack}
          live={status.online}
        />
        <StatusTile
          tone="red"
          label="Hours offline"
          value={hoursValue(status.offline_hours)}
          detail={share(status.offline_hours, recorded)}
          aside={wentOut}
          live={!status.online}
        />
      </div>
    </ChartCard>
  );
}
