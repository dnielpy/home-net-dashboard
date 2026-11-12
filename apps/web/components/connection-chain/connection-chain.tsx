"use client";

import { Fragment, useEffect, useState } from "react";

import { ConnectedBadge } from "@/components/connection-chain/connected-badge";
import { HopLink } from "@/components/connection-chain/hop-link";
import { HopNode } from "@/components/connection-chain/hop-node";
import { buildHopViews, linkState, sweepResult } from "@/components/connection-chain/hop-state";
import { useChainSweep } from "@/components/connection-chain/use-chain-sweep";
import { RefreshIcon } from "@/components/icons/refresh-icon";
import type { HopInfo, LatestCheck } from "@/lib/api";

// How long the hops flash together before they collapse into the "Connected" ball
const CELEBRATION_MS = 1_000;

function minutesAgo(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  return minutes < 1 ? "just now" : `${minutes} min ago`;
}

type ConnectionChainProps = {
  hops: HopInfo[];
  latest: LatestCheck | null;
};

export function ConnectionChain({ hops, latest }: ConnectionChainProps) {
  const { probes, phase, sweep, apiError, checkedAt, restored, restart } = useChainSweep(hops, latest);
  const views = buildHopViews(hops, probes);
  const done = phase.kind === "done";
  const [now, setNow] = useState<number | null>(null);

  // Keeps "checked … ago" current without reading the clock while rendering
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [checkedAt]);
  const { online, breakAt } = sweepResult(views);
  const internet = views.at(-1);
  const connected = done && online && !apiError;

  // Sweep whose chain has collapsed into the "Connected" ball; a restored result starts collapsed
  const [collapsedSweep, setCollapsedSweep] = useState<number | null>(connected && restored ? sweep : null);
  useEffect(() => {
    if (!connected) return;
    // Lets the hops play their celebration flash before they collapse
    const id = setTimeout(() => setCollapsedSweep(sweep), restored ? 0 : CELEBRATION_MS);
    return () => clearTimeout(id);
  }, [connected, restored, sweep]);
  const collapsed = connected && collapsedSweep === sweep;

  let headline;
  if (phase.kind === "pinging") {
    headline = <span className="text-zinc-900 dark:text-zinc-50">Checking {views[phase.index]?.label}…</span>;
  } else if (apiError) {
    headline = <span className="text-zinc-900 dark:text-zinc-50">API unavailable</span>;
  } else if (online) {
    headline = (
      <span className="text-zinc-900 dark:text-zinc-50">
        <span key={sweep} className={restored ? undefined : "text-flash"}>
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
        <p className="mt-1 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          {done && checkedAt !== null && now !== null
            ? `Checked ${minutesAgo(now - checkedAt)} · the server checks every 30 seconds`
            : "3 seconds of pings per hop, the average is the latency"}
        </p>
      </div>

      {collapsed ? (
        <ConnectedBadge key={sweep} animate={!restored} />
      ) : (
        <ol aria-label="Connection chain" className="flex w-full flex-col md:flex-row md:items-start">
          {views.map((hop, index) => (
            <Fragment key={hop.name}>
              {index > 0 && <HopLink state={linkState(hop)} />}
              <HopNode hop={hop} sweep={sweep} animate={!restored} celebrate={connected} />
            </Fragment>
          ))}
        </ol>
      )}

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
