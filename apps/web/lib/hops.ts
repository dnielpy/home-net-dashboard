export const HOP_NAMES = ["router", "nano", "provider", "internet"] as const;

export type HopName = (typeof HOP_NAMES)[number];

export function isHopName(name: string): name is HopName {
  return (HOP_NAMES as readonly string[]).includes(name);
}

export const HOP_LABELS: Record<HopName, string> = {
  router: "Router",
  nano: "Nano",
  provider: "Provider",
  internet: "Internet",
};

export function hopLabel(name: string | null): string {
  return name && name in HOP_LABELS ? HOP_LABELS[name as HopName] : "Unknown";
}
