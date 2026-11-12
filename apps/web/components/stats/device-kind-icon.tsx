import { DevicesIcon } from "@/components/icons/devices-icon";
import type { IconProps } from "@/components/icons/icon-props";
import { LaptopIcon } from "@/components/icons/laptop-icon";
import { PhoneIcon } from "@/components/icons/phone-icon";
import { ServerIcon } from "@/components/icons/server-icon";
import type { DeviceKind } from "@/lib/device-kind";

const KIND_ICONS: Record<DeviceKind, (props: IconProps) => React.JSX.Element> = {
  mobile: PhoneIcon,
  laptop: LaptopIcon,
  server: ServerIcon,
  other: DevicesIcon,
};

export const KIND_LABELS: Record<DeviceKind, string> = {
  mobile: "Mobile",
  laptop: "Laptop",
  server: "Server",
  other: "Device",
};

export function DeviceKindIcon({ kind, className }: { kind: DeviceKind; className?: string }) {
  const Icon = KIND_ICONS[kind];
  return <Icon className={className} />;
}
