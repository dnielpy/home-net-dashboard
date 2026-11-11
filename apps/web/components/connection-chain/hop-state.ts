import type { ComponentType } from "react";

import { AntennaIcon } from "@/components/icons/antenna-icon";
import { GlobeIcon } from "@/components/icons/globe-icon";
import type { IconProps } from "@/components/icons/icon-props";
import { RouterIcon } from "@/components/icons/router-icon";
import { TowerIcon } from "@/components/icons/tower-icon";
import type { HopInfo } from "@/lib/api";
import { type HopName, hopLabel } from "@/lib/hops";

/** What the sweep knows about a hop: not reached yet, being pinged, or the result of its pings. */
export type Probe =
  | { status: "pending" }
  | { status: "pinging" }
  | { status: "done"; ok: boolean; latency_ms: number | null };

// pending: not pinged yet in this sweep · pinging: pings in flight · ok: answers pings · down: no ping reply
export type HopState = "pending" | "pinging" | "ok" | "down";

export type HopView = HopInfo & {
  label: string;
  state: HopState;
  latency_ms: number | null;
  Icon: ComponentType<IconProps>;
};

export type LinkState = "idle" | "travel" | "up" | "down";

const HOP_ICONS: Record<HopName, ComponentType<IconProps>> = {
  router: RouterIcon,
  nano: AntennaIcon,
  provider: TowerIcon,
  internet: GlobeIcon,
};

export const HOP_STATE_STYLES: Record<HopState, { circle: string; status: string }> = {
  pending: { circle: "bg-zinc-400 ring-zinc-300/40 dark:bg-zinc-600 dark:ring-zinc-700/40", status: "Waiting" },
  pinging: { circle: "bg-[#fab219] ring-[#fab219]/25", status: "Pinging…" },
  ok: { circle: "bg-[#0ca30c] ring-[#0ca30c]/20", status: "Answering" },
  down: { circle: "bg-[#d03b3b] ring-[#d03b3b]/20", status: "No ping reply" },
};

function hopState(probe: Probe): HopState {
  if (probe.status !== "done") return probe.status;
  return probe.ok ? "ok" : "down";
}

export function buildHopViews(hops: HopInfo[], probes: Probe[]): HopView[] {
  return hops.map((hop, index) => {
    const probe = probes[index];
    return {
      ...hop,
      label: hopLabel(hop.name),
      Icon: HOP_ICONS[hop.name as HopName] ?? GlobeIcon,
      state: hopState(probe),
      latency_ms: probe.status === "done" ? probe.latency_ms : null,
    };
  });
}

/** The link that leads into `next`. */
export function linkState(next: HopView): LinkState {
  if (next.state === "pinging") return "travel";
  if (next.state === "ok") return "up";
  return next.state === "down" ? "down" : "idle";
}

/** Where the chain is cut once every hop has been pinged: right after the last hop that answers. */
export function sweepResult(views: HopView[]): { online: boolean; breakAt: HopView | null } {
  const lastOk = views.findLastIndex((view) => view.state === "ok");
  return { online: lastOk === views.length - 1, breakAt: views[lastOk + 1] ?? null };
}
