"use client";

import { useCallback, useEffect, useState } from "react";

import type { Probe } from "@/components/connection-chain/hop-state";
import type { Hop, HopInfo, LatestCheck } from "@/lib/api";

// Each hop takes at least this long, so the sweep can be followed by eye
export const HOP_DURATION_MS = 3_000;

export type SweepPhase = { kind: "pinging"; index: number } | { kind: "done" };

export type ChainSweep = {
  probes: Probe[];
  phase: SweepPhase;
  // Bumps on every sweep so the arrival animations play again; 0 while showing the server's latest check
  sweep: number;
  apiError: boolean;
  checkedAt: number | null;
  // The result is the server's latest check, so nothing is animated
  restored: boolean;
};

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => clearTimeout(id), { once: true });
  });
}

async function pingHop(name: string, signal: AbortSignal): Promise<Hop | null> {
  try {
    const response = await fetch(`/api/hops/${encodeURIComponent(name)}`, { signal, cache: "no-store" });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

function pendingProbes(hops: HopInfo[]): Probe[] {
  return hops.map(() => ({ status: "pending" }));
}

function restoredProbes(hops: HopInfo[], check: LatestCheck): Probe[] | null {
  const byName = new Map(check.hops.map((hop) => [hop.name, hop]));
  if (!hops.every((hop) => byName.has(hop.name))) return null;
  return hops.map((hop) => {
    const { ok, latency_ms } = byName.get(hop.name)!;
    return { status: "done", ok, latency_ms };
  });
}

/** Starts from the server's latest check; only when there is none yet does it walk the chain on its own. */
function initialSweep(hops: HopInfo[], latest: LatestCheck | null): ChainSweep {
  const probes = latest ? restoredProbes(hops, latest) : null;
  if (latest && probes) {
    return {
      probes,
      phase: { kind: "done" },
      sweep: 0,
      apiError: false,
      checkedAt: Date.parse(latest.checked_at),
      restored: true,
    };
  }
  return {
    probes: pendingProbes(hops),
    phase: { kind: "pinging", index: 0 },
    sweep: 1,
    apiError: false,
    checkedAt: null,
    restored: false,
  };
}

/**
 * Shows the server's latest check as it is, and walks the chain hop by hop (with its animations) only when
 * `restart` is called.
 */
export function useChainSweep(hops: HopInfo[], latest: LatestCheck | null): ChainSweep & { restart: () => void } {
  const [state, setState] = useState<ChainSweep>(() => initialSweep(hops, latest));
  const { sweep } = state;

  const restart = useCallback(() => {
    setState((current) =>
      current.phase.kind === "pinging"
        ? current
        : {
            ...current,
            probes: pendingProbes(hops),
            phase: { kind: "pinging", index: 0 },
            sweep: current.sweep + 1,
            apiError: false,
            restored: false,
          },
    );
  }, [hops]);

  useEffect(() => {
    if (sweep === 0) return;
    const controller = new AbortController();
    const { signal } = controller;

    async function run() {
      let apiError = false;
      for (let index = 0; index < hops.length; index += 1) {
        setState((current) => ({
          ...current,
          probes: current.probes.map((probe, i) => (i === index ? { status: "pinging" } : probe)),
          phase: { kind: "pinging", index },
        }));

        const [hop] = await Promise.all([pingHop(hops[index].name, signal), sleep(HOP_DURATION_MS, signal)]);
        if (signal.aborted) return;
        apiError ||= hop === null;

        setState((current) => ({
          ...current,
          probes: current.probes.map((probe, i) =>
            i === index ? { status: "done", ok: hop?.ok ?? false, latency_ms: hop?.latency_ms ?? null } : probe,
          ),
        }));
      }

      const checkedAt = Date.now();
      setState((current) => ({ ...current, phase: { kind: "done" }, apiError, checkedAt }));
    }

    run();
    return () => controller.abort();
  }, [hops, sweep]);

  return { ...state, restart };
}
