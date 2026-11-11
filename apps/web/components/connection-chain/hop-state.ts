import type { ComponentType } from "react";

import { AntennaIcon } from "@/components/icons/antenna-icon";
import { GlobeIcon } from "@/components/icons/globe-icon";
import type { IconProps } from "@/components/icons/icon-props";
import { RouterIcon } from "@/components/icons/router-icon";
import { TowerIcon } from "@/components/icons/tower-icon";
import type { Hop } from "@/lib/api";
import { type HopName, hopLabel } from "@/lib/hops";

// ok: answers pings · passing: ignores pings but a hop behind it answers · cut: the chain breaks here · unknown: behind the cut
export type HopState = "ok" | "passing" | "cut" | "unknown";

export type HopView = Hop & { label: string; state: HopState; Icon: ComponentType<IconProps> };

export type LinkState = "up" | "cut" | "unknown";

const HOP_ICONS: Record<HopName, ComponentType<IconProps>> = {
  router: RouterIcon,
  nano: AntennaIcon,
  provider: TowerIcon,
  internet: GlobeIcon,
};

export const HOP_STATE_STYLES: Record<HopState, { circle: string; status: string }> = {
  ok: { circle: "bg-[#0ca30c] ring-[#0ca30c]/20", status: "Answering" },
  passing: { circle: "bg-[#fab219] ring-[#fab219]/25", status: "No ping reply · passing traffic" },
  cut: { circle: "bg-[#d03b3b] ring-[#d03b3b]/20", status: "Not answering" },
  unknown: {
    circle: "bg-zinc-400 ring-zinc-300/40 dark:bg-zinc-600 dark:ring-zinc-700/40",
    status: "Unreachable behind the cut",
  },
};

export function buildHopViews(hops: Hop[]): HopView[] {
  const lastOk = hops.findLastIndex((hop) => hop.ok);
  return hops.map((hop, index) => ({
    ...hop,
    label: hopLabel(hop.name),
    Icon: HOP_ICONS[hop.name as HopName] ?? GlobeIcon,
    state: hop.ok ? "ok" : index < lastOk ? "passing" : index === lastOk + 1 ? "cut" : "unknown",
  }));
}

export function linkState(next: HopView): LinkState {
  if (next.state === "ok" || next.state === "passing") return "up";
  return next.state === "cut" ? "cut" : "unknown";
}
