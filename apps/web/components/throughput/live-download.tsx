"use client";

import { useEffect, useState, type PointerEvent } from "react";

import type { ThroughputEvent } from "@/lib/api";
import { SERIES_COLORS } from "@/lib/chart-colors";
import { readNdjson } from "@/lib/ndjson";

// One sample a second, so the line covers the last minute
const HISTORY_SAMPLES = 60;
const RECONNECT_MS = 3_000;
const CHART_WIDTH = 300;
const CHART_HEIGHT = 56;

type StreamState = "connecting" | "live" | "error";

/** Bits per second, the unit internet plans and speed tests use. */
function formatBitsPerSecond(bytesPerSecond: number): { value: string; unit: string } {
  const mbps = (bytesPerSecond * 8) / 1_000_000;
  if (mbps < 1) return { value: ((bytesPerSecond * 8) / 1_000).toFixed(0), unit: "kbps" };
  return { value: mbps.toFixed(mbps >= 10 ? 0 : 1), unit: "Mbps" };
}

function formatShort(bytesPerSecond: number): string {
  const { value, unit } = formatBitsPerSecond(bytesPerSecond);
  return `${value} ${unit}`;
}

function linePoints(samples: number[], max: number): string {
  const step = CHART_WIDTH / (HISTORY_SAMPLES - 1);
  // The newest sample sits on the right edge, so the line fills in from the right while the first minute arrives
  const offset = HISTORY_SAMPLES - samples.length;
  return samples
    .map((sample, index) => {
      const x = (offset + index) * step;
      const y = CHART_HEIGHT - 2 - (sample / max) * (CHART_HEIGHT - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** The download speed the Nano is carrying right now, read every second, with a line of the last minute. */
export function LiveDownload() {
  const [samples, setSamples] = useState<number[]>([]);
  const [state, setState] = useState<StreamState>("connecting");
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;

    async function listen() {
      const response = await fetch("/api/throughput", { signal: controller.signal, cache: "no-store" });
      if (!response.ok || !response.body) throw new Error(`Throughput responded with ${response.status}`);
      await readNdjson<ThroughputEvent>(response, (event) => {
        if (event.type === "rate") {
          setState("live");
          setSamples((current) => [...current, event.rx_bytes_per_second].slice(-HISTORY_SAMPLES));
        } else {
          setState("error");
        }
      });
      throw new Error("The throughput stream ended");
    }

    function connect() {
      listen().catch(() => {
        if (controller.signal.aborted) return;
        setState("error");
        retry = setTimeout(connect, RECONNECT_MS);
      });
    }

    connect();
    return () => {
      controller.abort();
      clearTimeout(retry);
    };
  }, []);

  const current = samples.at(-1);
  const max = Math.max(...samples, 125_000); // at least 1 Mbps tall, so an idle link stays a flat line at the bottom
  const peak = samples.length > 0 ? Math.max(...samples) : null;
  const speed = current !== undefined ? formatBitsPerSecond(current) : null;
  const stale = state === "error";

  const hoveredIndex = hovered !== null && hovered < samples.length ? hovered : null;
  const step = CHART_WIDTH / (HISTORY_SAMPLES - 1);
  const hoveredX = hoveredIndex !== null ? (HISTORY_SAMPLES - samples.length + hoveredIndex) * step : null;

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const slot = Math.round(((event.clientX - box.left) / box.width) * (HISTORY_SAMPLES - 1));
    const index = slot - (HISTORY_SAMPLES - samples.length);
    setHovered(index >= 0 ? index : null);
  }

  return (
    <section
      aria-labelledby="live-download-title"
      className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 id="live-download-title" className="text-sm text-zinc-500 dark:text-zinc-400">
          Download now
        </h2>
        <span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full ${
              state === "live" ? "animate-pulse bg-[#0ca30c]" : state === "error" ? "bg-[#d03b3b]" : "bg-zinc-400"
            }`}
          />
          {state === "live" ? "Live" : state === "error" ? "Nano unreachable" : "Connecting…"}
        </span>
      </header>

      <p className={`mt-1 tabular-nums ${stale ? "opacity-50" : ""}`}>
        <span className="text-4xl font-semibold text-zinc-900 dark:text-zinc-50">{speed?.value ?? "–"}</span>
        <span className="ml-1.5 text-base text-zinc-500 dark:text-zinc-400">{speed?.unit ?? "Mbps"}</span>
      </p>

      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Download speed over the last minute${peak !== null ? `, peak ${formatShort(peak)}` : ""}`}
          className="block h-14 w-full touch-none overflow-visible"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHovered(null)}
        >
          <line
            x1={0}
            x2={CHART_WIDTH}
            y1={CHART_HEIGHT - 1}
            y2={CHART_HEIGHT - 1}
            className="stroke-zinc-200 dark:stroke-zinc-800"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {samples.length > 1 && (
            <>
              <polygon
                points={`${(HISTORY_SAMPLES - samples.length) * step},${CHART_HEIGHT - 1} ${linePoints(samples, max)} ${CHART_WIDTH},${CHART_HEIGHT - 1}`}
                fill={SERIES_COLORS.download}
                fillOpacity={0.12}
              />
              <polyline
                points={linePoints(samples, max)}
                fill="none"
                stroke={SERIES_COLORS.download}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
          {hoveredX !== null && (
            <line
              x1={hoveredX}
              x2={hoveredX}
              y1={0}
              y2={CHART_HEIGHT}
              className="stroke-zinc-400 dark:stroke-zinc-500"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {hoveredIndex !== null && hoveredX !== null && (
          <div
            className="pointer-events-none absolute -top-9 -translate-x-1/2 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 tabular-nums shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            style={{ left: `${Math.min(90, Math.max(10, (hoveredX / CHART_WIDTH) * 100))}%` }}
          >
            {formatShort(samples[hoveredIndex])}
            <span className="text-zinc-500 dark:text-zinc-400">
              {" "}
              · {samples.length - 1 - hoveredIndex === 0 ? "now" : `${samples.length - 1 - hoveredIndex} s ago`}
            </span>
          </div>
        )}
      </div>

      <p className="mt-2 flex justify-between text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
        <span>Last minute</span>
        <span>{peak !== null ? `Peak ${formatShort(peak)}` : "Read from the Nano every second"}</span>
      </p>
    </section>
  );
}
