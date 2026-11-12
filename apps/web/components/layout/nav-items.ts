import type { ComponentType } from "react";

import { ChartIcon } from "@/components/icons/chart-icon";
import { DashboardIcon } from "@/components/icons/dashboard-icon";
import { DevicesIcon } from "@/components/icons/devices-icon";
import type { IconProps } from "@/components/icons/icon-props";

export type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<IconProps>;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", Icon: DashboardIcon },
  { href: "/stats", label: "Stats", Icon: ChartIcon },
  { href: "/devices", label: "Devices", Icon: DevicesIcon },
];
