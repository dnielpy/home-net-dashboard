import Link from "next/link";

import { ChartCard } from "@/components/stats/chart-card";
import { ChartLegend } from "@/components/stats/chart-legend";
import { DeviceKindIcon, KIND_LABELS } from "@/components/stats/device-kind-icon";
import { RangeFilter } from "@/components/stats/range-filter";
import { StatusMessage } from "@/components/status-message";
import { ApiUnavailableError, type DeviceUsage, getDeviceUsage } from "@/lib/api";
import { formatBytes } from "@/lib/bytes-format";
import { SERIES_COLORS } from "@/lib/chart-colors";
import { deviceKind } from "@/lib/device-kind";
import { TIME_RANGES, parseTimeRange } from "@/lib/time-ranges";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// The heaviest devices shown
const TOP_COUNT = 10;

/** The devices that used the most bandwidth, as bars split into download and upload. */
export async function DeviceUsageStats({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const range = parseTimeRange(params.deviceHours, TIME_RANGES);

  let usage: DeviceUsage[];
  try {
    usage = await getDeviceUsage(range.hours);
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return (
        <StatusMessage title="API unavailable" body="Could not load data from the API. Make sure it is running." />
      );
    }
    throw error;
  }

  const top = usage.slice(0, TOP_COUNT);
  const max = Math.max(1, ...top.map((device) => device.down_bytes + device.up_bytes));
  const percent = (bytes: number) => `${(bytes / max) * 100}%`;
  const count = `${usage.length} ${usage.length === 1 ? "device" : "devices"} used data`;

  return (
    <ChartCard
      id="device-usage-title"
      title="Top devices"
      subtitle={`${range.description} · ${count}${usage.length > TOP_COUNT ? ` · top ${TOP_COUNT}` : ""}`}
      actions={
        <RangeFilter
          label="Top devices time range"
          param="deviceHours"
          ranges={TIME_RANGES}
          selected={range}
          searchParams={params}
        />
      }
    >
      {top.length === 0 ? (
        <p className="flex h-32 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
          No device used data in this period.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <ChartLegend
            items={[
              { label: "Download", color: SERIES_COLORS.download },
              { label: "Upload", color: SERIES_COLORS.upload },
            ]}
          />
          <ol aria-label="Devices by bandwidth used" className="flex flex-col text-xs">
            {top.map((device) => {
              const kind = deviceKind(device.name);
              const total = device.down_bytes + device.up_bytes;
              return (
                <li key={device.mac} className="flex h-9 items-center">
                  <Link
                    href={`/devices/${encodeURIComponent(device.mac)}`}
                    className="flex w-32 shrink-0 items-center gap-2 pr-3 text-sm text-zinc-700 hover:text-zinc-900 sm:w-44 dark:text-zinc-300 dark:hover:text-zinc-50"
                  >
                    <DeviceKindIcon kind={kind} className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                    <span className="sr-only">{KIND_LABELS[kind]}:</span>
                    <span className={`truncate ${device.name ? "" : "font-mono text-xs"}`}>
                      {device.name || device.mac}
                    </span>
                  </Link>
                  <div
                    tabIndex={0}
                    aria-label={`${formatBytes(total)}: ${formatBytes(device.down_bytes)} down, ${formatBytes(device.up_bytes)} up`}
                    className="group relative mr-28 flex min-w-0 flex-1 items-center outline-none"
                  >
                    <span className="flex h-5 min-w-0.5 overflow-hidden rounded-r" style={{ width: percent(total) }}>
                      <span
                        className="h-full"
                        style={{ width: `${(device.down_bytes / total) * 100}%`, background: SERIES_COLORS.download }}
                      />
                      <span className="h-full flex-1" style={{ background: SERIES_COLORS.upload }} />
                    </span>
                    <span
                      className="absolute pl-1.5 font-medium whitespace-nowrap tabular-nums text-zinc-900 dark:text-zinc-50"
                      style={{ left: percent(total) }}
                    >
                      {formatBytes(total)}
                    </span>
                    <span className="pointer-events-none invisible absolute bottom-full left-0 z-10 mb-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 whitespace-nowrap shadow-sm group-hover:visible group-focus-visible:visible dark:border-zinc-700 dark:bg-zinc-800">
                      <span className="block text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                        {formatBytes(total)}
                      </span>
                      <span className="mt-0.5 block text-zinc-500 tabular-nums dark:text-zinc-400">
                        ↓ {formatBytes(device.down_bytes)} · ↑ {formatBytes(device.up_bytes)}
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </ChartCard>
  );
}
