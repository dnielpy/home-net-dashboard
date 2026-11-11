"use client";

import { useCallback, useEffect, useState } from "react";

import type { Probe } from "@/components/connection-chain/hop-state";
import type { Hop, HopInfo } from "@/lib/api";

// Each hop takes at least this long, so the sweep can be followed by eye
export const HOP_DURATION_MS = 3_000;

export type SweepPhase = { kind: "pinging"; index: number } | { kind: "done" };

export type ChainSweep = {
  probes: Probe[];
  phase: SweepPhase;
  // Bumps on every sweep so the arrival animations play again
  sweep: number;
  apiError: boolean;
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

function initialSweep(hops: HopInfo[], sweep: number): ChainSweep {
  return {
    probes: hops.map(() => ({ status: "pending" })),
    phase: { kind: "pinging", index: 0 },
    sweep,
    apiError: false,
  };
}

/** Walks the chain hop by hop once when mounted, and again every time `restart` is called. */
export function useChainSweep(hops: HopInfo[]): ChainSweep & { restart: () => void } {
  const [state, setState] = useState<ChainSweep>(() => initialSweep(hops, 0));
  const { sweep } = state;

  const restart = useCallback(() => {
    setState((current) => (current.phase.kind === "done" ? initialSweep(hops, current.sweep + 1) : current));
  }, [hops]);

  useEffect(() => {
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

      setState((current) => ({ ...current, phase: { kind: "done" }, apiError }));
    }

    run();
    return () => controller.abort();
  }, [hops, sweep]);

  return { ...state, restart };
}
