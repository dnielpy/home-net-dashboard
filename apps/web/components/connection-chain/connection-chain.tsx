"use client";

import { Fragment } from "react";

import { HopLink } from "@/components/connection-chain/hop-link";
import { HopNode } from "@/components/connection-chain/hop-node";
import { buildHopViews, linkState, sweepResult } from "@/components/connection-chain/hop-state";
import { useChainSweep } from "@/components/connection-chain/use-chain-sweep";
import { RefreshIcon } from "@/components/icons/refresh-icon";
import type { HopInfo } from "@/lib/api";

export function ConnectionChain({ hops }: { hops: HopInfo[] }) {
  const { probes, phase, sweep, apiError, restart } = useChainSweep(hops);
  const views = buildHopViews(hops, probes);
  const done = phase.kind === "done";
  const { online, breakAt } = sweepResult(views);
  const internet = views.at(-1);

  let headline;
  if (!done) {
    headline = <span className="text-zinc-900 dark:text-zinc-50">Checking {views[phase.index]?.label}…</span>;
  } else if (apiError) {
    headline = <span className="text-zinc-900 dark:text-zinc-50">API unavailable</span>;
  } else if (online) {
    headline = (
      <span className="text-zinc-900 dark:text-zinc-50">
        <span key={sweep} className="text-flash">
          Online
        </span>
        {internet?.latency_ms != null && (
          <span className="font-normal text-zinc-500 dark:text-zinc-400"> · {internet.latency_ms.toFixed(0)} ms to internet</span>
        )}
      </span>
    );
  } else {
    headline = <span className="text-[#d03b3b]">Cut at {breakAt?.label}</span>;
  }

  return (
    <section aria-labelledby="connection-chain-title" className="flex w-full max-w-4xl flex-col items-center gap-10">
      <div className="text-center">
        <h2 id="connection-chain-title" className="text-sm text-zinc-500 dark:text-zinc-400">
          Connection
        </h2>
        <p aria-live="polite" className="mt-1 text-2xl font-semibold">
          {headline}
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          3 seconds of pings per hop, the average is the latency
        </p>
      </div>

      <ol aria-label="Connection chain" className="flex w-full flex-col md:flex-row md:items-start">
        {views.map((hop, index) => (
          <Fragment key={hop.name}>
            {index > 0 && <HopLink state={linkState(hop)} />}
            <HopNode hop={hop} sweep={sweep} celebrate={done && online && !apiError} />
          </Fragment>
        ))}
      </ol>

      <button
        type="button"
        onClick={restart}
        disabled={!done}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
      >
        <RefreshIcon className={`h-4 w-4 ${done ? "" : "animate-spin"}`} />
        {done ? "Check again" : "Checking…"}
      </button>
    </section>
  );
}
