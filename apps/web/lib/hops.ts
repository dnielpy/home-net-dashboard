export type HopName = "router" | "nano" | "provider" | "internet";

export const HOP_LABELS: Record<HopName, string> = {
  router: "Router",
  nano: "Nano",
  provider: "Provider",
  internet: "Internet",
};

export function hopLabel(name: string | null): string {
  return name && name in HOP_LABELS ? HOP_LABELS[name as HopName] : "Unknown";
}
