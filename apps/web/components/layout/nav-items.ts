import type { ComponentType } from "react";

import { ChartIcon } from "@/components/icons/chart-icon";
import { DashboardIcon } from "@/components/icons/dashboard-icon";
import { DevicesIcon } from "@/components/icons/devices-icon";
import type { IconProps } from "@/components/icons/icon-props";
import { SpeedIcon } from "@/components/icons/speed-icon";

export type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<IconProps>;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", Icon: DashboardIcon },
  { href: "/speed-test", label: "Speed test", Icon: SpeedIcon },
  { href: "/stats", label: "Stats", Icon: ChartIcon },
  { href: "/devices", label: "Devices", Icon: DevicesIcon },
];
