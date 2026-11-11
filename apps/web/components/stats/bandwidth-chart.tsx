"use client";

import { type KeyboardEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";

import { ChartLegend } from "@/components/stats/chart-legend";
import type { BandwidthBucket } from "@/lib/api";
import { type BandwidthBar, formatBucket } from "@/lib/bandwidth-series";
import { byteTicks, formatBytes } from "@/lib/bytes-format";
import { SERIES_COLORS } from "@/lib/chart-colors";
import { formatTimeTick, timeTicks } from "@/lib/chart-time";

const HEIGHT = 280;
const MARGIN = { top: 16, right: 72, bottom: 28, left: 64 };
const MIN_LABEL_GAP = 14;

const SERIES = [
  { key: "rx", label: "Download", color: SERIES_COLORS.download },
  { key: "tx", label: "Upload", color: SERIES_COLORS.upload },
] as const;

type Point = { t: number; value: number };

/** Splits a series where buckets have no traffic samples, so the line does not pretend there was no traffic. */
function segmentsOf(bars: BandwidthBar[], key: "rx" | "tx"): Point[][] {
  const segments: Point[][] = [];
  let current: Point[] | null = null;
  for (const bar of bars) {
    if (!bar.hasData) {
      current = null;
      continue;
    }
    if (!current) {
      current = [];
      segments.push(current);
    }
    current.push({ t: (bar.start + bar.end) / 2, value: bar[key] });
  }
  return segments;
}

export function BandwidthChart({ bars, bucket, to }: { bars: BandwidthBar[]; bucket: BandwidthBucket; to: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const from = bars[0].start;
  const rangeMs = to - from;
  const yTicks = useMemo(() => byteTicks(Math.max(0, ...bars.map((bar) => Math.max(bar.rx, bar.tx)))), [bars]);
  const top = yTicks.at(-1) || 1;
  const innerWidth = Math.max(0, (width ?? 0) - MARGIN.left - MARGIN.right);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  const x = (t: number) => MARGIN.left + ((Math.min(t, to) - from) / rangeMs) * innerWidth;
  const y = (value: number) => MARGIN.top + (1 - value / top) * innerHeight;

  const series = useMemo(() => SERIES.map((item) => ({ ...item, segments: segmentsOf(bars, item.key) })), [bars]);
  const dataIndexes = useMemo(() => bars.flatMap((bar, index) => (bar.hasData ? [index] : [])), [bars]);
  const active = activeIndex === null ? null : bars[activeIndex];

  const linePath = (segment: Point[]) =>
    segment.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join("");

  // Direct labels at the end of each line, pushed apart when they would overlap
  const endLabels = series
    .map((item) => ({ ...item, last: item.segments.at(-1)?.at(-1) }))
    .filter((item): item is typeof item & { last: Point } => !!item.last)
    .map((item) => ({ ...item, labelY: y(item.last.value) }));
  if (endLabels.length === 2 && Math.abs(endLabels[0].labelY - endLabels[1].labelY) < MIN_LABEL_GAP) {
    const [upper, lower] = endLabels[0].labelY <= endLabels[1].labelY ? endLabels : [endLabels[1], endLabels[0]];
    const middle = (upper.labelY + lower.labelY) / 2;
    upper.labelY = middle - MIN_LABEL_GAP / 2;
    lower.labelY = middle + MIN_LABEL_GAP / 2;
  }

  function nearestDataIndex(t: number): number | null {
    let best: number | null = null;
    for (const index of dataIndexes) {
      const center = (bars[index].start + bars[index].end) / 2;
      if (best === null || Math.abs(center - t) < Math.abs((bars[best].start + bars[best].end) / 2 - t)) best = index;
    }
    return best;
  }

  function handlePointerMove(event: PointerEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    setActiveIndex(nearestDataIndex(from + ((event.clientX - bounds.left) / bounds.width) * rangeMs));
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (dataIndexes.length === 0 || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    const position = activeIndex === null ? dataIndexes.length : dataIndexes.indexOf(activeIndex);
    const next = Math.min(dataIndexes.length - 1, Math.max(0, position + (event.key === "ArrowLeft" ? -1 : 1)));
    setActiveIndex(dataIndexes[next]);
  }

  const activeX = active ? x((active.start + active.end) / 2) : 0;

  return (
    <div className="flex flex-col gap-3">
      <ChartLegend items={SERIES.map(({ label, color }) => ({ label, color }))} />
      <div ref={containerRef} className="relative w-full" style={{ height: HEIGHT }}>
        {width !== null && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label="Bytes downloaded and uploaded over time. Use the left and right arrow keys to read values."
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onFocus={() => setActiveIndex((index) => index ?? dataIndexes.at(-1) ?? null)}
            onBlur={() => setActiveIndex(null)}
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40"
          >
            {yTicks.map((tick) => (
              <g key={tick}>
                <line
                  x1={MARGIN.left}
                  x2={MARGIN.left + innerWidth}
                  y1={y(tick)}
                  y2={y(tick)}
                  strokeWidth={1}
                  className="stroke-zinc-200 dark:stroke-zinc-800"
                />
                <text
                  x={MARGIN.left - 8}
                  y={y(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-zinc-500 text-[11px] tabular-nums dark:fill-zinc-400"
                >
                  {formatBytes(tick)}
                </text>
              </g>
            ))}

            {timeTicks(from, to, innerWidth).map((tick) => (
              <text
                key={tick}
                x={x(tick)}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-zinc-500 text-[11px] tabular-nums dark:fill-zinc-400"
              >
                {formatTimeTick(tick, rangeMs)}
              </text>
            ))}

            {series.map((item) =>
              item.segments.map((segment, index) =>
                segment.length === 1 ? (
                  <circle
                    key={`${item.key}-${index}`}
                    cx={x(segment[0].t)}
                    cy={y(segment[0].value)}
                    r={3}
                    fill={item.color}
                  />
                ) : (
                  <path
                    key={`${item.key}-${index}`}
                    d={linePath(segment)}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ),
              ),
            )}

            {endLabels.map((item) => (
              <g key={item.key}>
                <circle
                  cx={x(item.last.t)}
                  cy={y(item.last.value)}
                  r={4}
                  strokeWidth={2}
                  fill={item.color}
                  className="stroke-white dark:stroke-zinc-900"
                />
                <text
                  x={x(item.last.t) + 10}
                  y={item.labelY}
                  dominantBaseline="middle"
                  className="fill-zinc-900 text-xs font-semibold tabular-nums dark:fill-zinc-50"
                >
                  {formatBytes(item.last.value)}
                </text>
              </g>
            ))}

            {active && (
              <>
                <line
                  x1={activeX}
                  x2={activeX}
                  y1={MARGIN.top}
                  y2={MARGIN.top + innerHeight}
                  strokeWidth={1}
                  className="stroke-zinc-400 dark:stroke-zinc-500"
                />
                {SERIES.map((item) => (
                  <circle
                    key={item.key}
                    cx={activeX}
                    cy={y(active[item.key])}
                    r={4}
                    strokeWidth={2}
                    fill={item.color}
                    className="stroke-white dark:stroke-zinc-900"
                  />
                ))}
              </>
            )}

            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setActiveIndex(null)}
            />
          </svg>
        )}

        {active && width !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
            style={{ left: Math.min(Math.max(activeX, 90), width - 90) }}
          >
            <p className="whitespace-nowrap font-medium text-zinc-900 dark:text-zinc-50">
              {formatBucket(active.start, bucket, true)}
            </p>
            {SERIES.map((item) => (
              <p key={item.key} className="mt-0.5 flex items-center gap-2 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                <span className="h-0.5 w-3 rounded-full" style={{ background: item.color }} />
                {item.label}
                <span className="ml-auto pl-3 font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {formatBytes(active[item.key])}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
