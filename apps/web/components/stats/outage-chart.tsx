"use client";

import { useState } from "react";

import type { Outage } from "@/lib/api";
import { STATUS_COLORS } from "@/lib/chart-colors";
import { hopLabel } from "@/lib/hops";
import { formatDateTime, formatDuration, formatTick, hourTicks } from "@/lib/outage-format";

// Rows shown until "Show more" is pressed
const COLLAPSED_COUNT = 5;

const ONGOING_TEXTURE = `repeating-linear-gradient(45deg, ${STATUS_COLORS.offline} 0 6px, color-mix(in srgb, ${STATUS_COLORS.offline} 70%, white) 6px 9px)`;

export function OutageChart({ outages: all }: { outages: Outage[] }) {
  const [expanded, setExpanded] = useState(false);
  const outages = expanded ? all : all.slice(0, COLLAPSED_COUNT);
  const hidden = all.length - outages.length;
  // The scale fits every outage, so it does not jump when the list expands
  const ticks = hourTicks(Math.max(...all.map((outage) => outage.duration_hours)));
  const top = ticks.at(-1)!;
  const percent = (hours: number) => `${(hours / top) * 100}%`;

  return (
    <div>
      <div className="flex text-xs">
        <ul className="w-24 shrink-0 sm:w-32" aria-hidden>
          {outages.map((outage) => (
            <li key={outage.start} className="flex h-9 items-center pr-3 tabular-nums text-zinc-600 dark:text-zinc-400">
              {formatDateTime(outage.start)}
            </li>
          ))}
        </ul>

        <div className="relative min-w-0 flex-1">
          <div className="relative mr-14 sm:mr-28">
            {ticks.map((tick) => (
              <span
                key={tick}
                aria-hidden
                className="absolute top-0 w-px bg-zinc-200 dark:bg-zinc-800"
                style={{
                  left: percent(tick),
                  height: `${outages.length * 2.25}rem`,
                }}
              />
            ))}

            <ul aria-label="Outages">
              {outages.map((outage) => (
                <li
                  key={outage.start}
                  tabIndex={0}
                  aria-label={`Outage from ${formatDateTime(outage.start)} ${
                    outage.ongoing ? "still ongoing" : `to ${formatDateTime(outage.end)}`
                  }, ${formatDuration(outage.duration_hours)}, cut at ${hopLabel(outage.break_at)}`}
                  className="group relative flex h-9 items-center outline-none"
                >
                  <span
                    className="block h-5 min-w-0.5 rounded-r transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                    style={{
                      width: percent(outage.duration_hours),
                      background: outage.ongoing ? ONGOING_TEXTURE : STATUS_COLORS.offline,
                    }}
                  />
                  <span
                    className="absolute pl-1.5 font-medium whitespace-nowrap tabular-nums text-zinc-900 dark:text-zinc-50"
                    style={{ left: percent(outage.duration_hours) }}
                  >
                    {formatDuration(outage.duration_hours)}
                    {/* Phones keep only the duration beside the bar; the hop stays in the tooltip */}
                    <span className="hidden font-normal text-zinc-500 sm:inline dark:text-zinc-400">
                      {" "}
                      · {hopLabel(outage.break_at)}
                    </span>
                    {outage.ongoing && <span className="font-normal text-zinc-500 dark:text-zinc-400"> · ongoing</span>}
                  </span>

                  <span className="pointer-events-none invisible absolute bottom-full left-0 z-10 mb-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm group-hover:visible group-focus-visible:visible dark:border-zinc-700 dark:bg-zinc-800">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLORS.offline }} />
                      <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                        {formatDuration(outage.duration_hours)}
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400">
                        Cut at {hopLabel(outage.break_at)}
                        {outage.ongoing && " · ongoing"}
                      </span>
                    </span>
                    <span className="mt-0.5 block whitespace-nowrap text-zinc-500 tabular-nums dark:text-zinc-400">
                      {formatDateTime(outage.start)} → {outage.ongoing ? "now" : formatDateTime(outage.end)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div aria-hidden className="relative mt-1 h-5">
              {ticks.map((tick, index) => (
                <span
                  key={tick}
                  className={`absolute -translate-x-1/2 whitespace-nowrap tabular-nums text-zinc-500 dark:text-zinc-400 ${
                    index % 2 === 1 ? "hidden sm:inline" : ""
                  }`}
                  style={{ left: percent(tick) }}
                >
                  {formatTick(tick)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      {all.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="mt-3 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {expanded ? "Show less" : `Show ${hidden} more`}
        </button>
      )}
    </div>
  );
}
