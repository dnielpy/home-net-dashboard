"use client";

import { useEffect, useState } from "react";

import { RefreshIcon } from "@/components/icons/refresh-icon";
import type { SpeedTestEvent } from "@/lib/api";
import { readNdjson } from "@/lib/ndjson";

type Result = Omit<Extract<SpeedTestEvent, { type: "result" }>, "type">;

type TestState = { kind: "measuring"; mbps: number | null } | { kind: "done"; result: Result } | { kind: "error" };

export function formatSpeed(mbps: number): string {
  return mbps >= 100 ? mbps.toFixed(0) : mbps.toFixed(1);
}

export function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-900 tabular-nums dark:text-zinc-50">{value}</dd>
    </div>
  );
}

/** A full screen download speed test laid out like fast.com: it measures as soon as it mounts, with one big number that climbs. */
export function SpeedTestCard() {
  const [run, setRun] = useState(0);
  const [state, setState] = useState<TestState>({ kind: "measuring", mbps: null });
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function measure() {
      const response = await fetch("/api/speed-test", { method: "POST", signal: controller.signal, cache: "no-store" });
      if (!response.ok || !response.body) throw new Error(`Speed test responded with ${response.status}`);

      let finished = false;
      await readNdjson<SpeedTestEvent>(response, (event) => {
        if (event.type === "progress") setState({ kind: "measuring", mbps: event.mbps });
        else if (event.type === "result") {
          finished = true;
          setState({ kind: "done", result: event });
        } else {
          finished = true;
          setState({ kind: "error" });
        }
      });
      if (!finished) throw new Error("The speed test ended without a result");
    }

    measure().catch(() => {
      if (!controller.signal.aborted) setState({ kind: "error" });
    });
    return () => controller.abort();
  }, [run]);

  function runAgain() {
    setState({ kind: "measuring", mbps: null });
    setRun((current) => current + 1);
  }

  const measuring = state.kind === "measuring";
  const mbps = state.kind === "done" ? state.result.download_mbps : state.kind === "measuring" ? state.mbps : null;
  const result = state.kind === "done" ? state.result : null;

  return (
    <section
      aria-labelledby="speed-test-title"
      className="w-full text-center"
    >
      <h2 id="speed-test-title" className="text-xl text-zinc-500 sm:text-2xl dark:text-zinc-400">
        {state.kind === "error" ? "Could not measure your internet speed" : "Your internet speed is"}
      </h2>

      <div className="mt-2 flex items-center justify-center gap-4 sm:gap-6">
        <p
          aria-live="polite"
          aria-label={mbps !== null ? `${formatSpeed(mbps)} megabits per second${measuring ? ", measuring" : ""}` : "Measuring"}
          className="flex items-baseline gap-2"
        >
          <span
            className={`text-8xl font-extralight tabular-nums transition-colors duration-500 sm:text-9xl lg:text-[12rem] lg:leading-none ${
              measuring ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-900 dark:text-zinc-50"
            }`}
          >
            {mbps !== null ? formatSpeed(mbps) : "0"}
          </span>
          <span className="text-2xl font-light text-zinc-500 sm:text-3xl lg:text-4xl dark:text-zinc-400">Mbps</span>
        </p>

        <button
          type="button"
          onClick={runAgain}
          disabled={measuring}
          aria-label={measuring ? "Measuring" : "Run the speed test again"}
          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-zinc-300 text-zinc-500 transition-colors enabled:hover:border-zinc-900 enabled:hover:text-zinc-900 disabled:cursor-default sm:h-16 sm:w-16 dark:border-zinc-700 dark:text-zinc-400 dark:enabled:hover:border-zinc-50 dark:enabled:hover:text-zinc-50"
        >
          {measuring ? (
            <span
              aria-hidden
              className="absolute -inset-0.5 animate-spin rounded-full border-2 border-transparent border-t-zinc-900 dark:border-t-zinc-50"
            />
          ) : (
            <RefreshIcon className="h-6 w-6" />
          )}
        </button>
      </div>

      <p className="mt-3 text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
        {measuring
          ? "Measuring with fast.com…"
          : result
            ? "Just measured"
            : "\u00a0"}
      </p>

      <button
        type="button"
        onClick={() => setShowInfo((current) => !current)}
        aria-expanded={showInfo}
        className="mt-4 text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        {showInfo ? "Hide info" : "Show more info"}
      </button>

      {showInfo && (
        <dl className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-4 text-left sm:grid-cols-3">
          <InfoItem label="Latency" value={result?.ping_ms != null ? `${Math.round(result.ping_ms)} ms` : "—"} />
          <InfoItem label="Server" value={result?.server_location ?? "—"} />
          <InfoItem label="Client" value={result?.client_location ?? "—"} />
          <InfoItem
            label="Measured in"
            value={result?.duration_ms != null ? `${Math.round(result.duration_ms / 1000)} s` : "—"}
          />
          <InfoItem label="Source" value="fast.com" />
        </dl>
      )}
    </section>
  );
}
