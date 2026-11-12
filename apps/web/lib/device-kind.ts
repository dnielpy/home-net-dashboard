export type DeviceKind = "mobile" | "laptop" | "server" | "other";

// Checked in order, so "Laptop server" counts as a server
const KIND_PATTERNS: [DeviceKind, RegExp][] = [
  ["server", /server|\bnas\b|raspberry|\bpi\b|docker|ubuntu|debian|synology/i],
  ["mobile", /iphone|ipad|android|galaxy|pixel|redmi|xiaomi|huawei|motorola|\bmoto\b|phone|\btab\b|tablet/i],
  ["laptop", /macbook|laptop|notebook|\bpc\b|desktop|imac|thinkpad|windows|\bmac\b/i],
];

/** Guesses the kind of device from the name it has in the router; "other" when the name says nothing. */
export function deviceKind(name: string): DeviceKind {
  return KIND_PATTERNS.find(([, pattern]) => pattern.test(name))?.[0] ?? "other";
}
