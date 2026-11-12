import { connection } from "next/server";

export class ApiUnavailableError extends Error {}

function apiUrl(path: string): string {
  const base = process.env.API_URL ?? "http://localhost:3011";
  return new URL(path, base).toString();
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), init);
  } catch (error) {
    throw new ApiUnavailableError("Could not reach the API", { cause: error });
  }

  if (!response.ok) {
    throw new ApiUnavailableError(`API responded with ${response.status}`);
  }

  return response.json();
}

export type Hop = {
  name: string;
  ip: string;
  ok: boolean;
  latency_ms: number | null;
};

export type HopInfo = { name: string; ip: string };

export async function getHops(): Promise<HopInfo[]> {
  return getJson("/connection/hops");
}

export function liveHopApiPath(name: string): string {
  return `/connection/live/${encodeURIComponent(name)}`;
}

export async function getLiveHop(name: string): Promise<Hop> {
  return getJson(liveHopApiPath(name));
}

export type LatestCheck = {
  checked_at: string;
  online: boolean;
  break_at: string | null;
  hops: Hop[];
};

/** The latest check stored by the API's background job, or null before the first one. */
export async function getLatestCheck(): Promise<LatestCheck | null> {
  await connection();
  return getJson("/connection/latest", { cache: "no-store" });
}

export type Period = { start: string; end: string; duration_hours: number };

export type OutagePeriod = Period & { break_at: string | null };

export type ConnectionStatus = {
  online: boolean | null;
  break_at: string | null;
  current_since: string | null;
  last_online: string | null;
  last_outage: OutagePeriod | null;
  last_online_period: Period | null;
  // Hours online and offline in the last 24 hours, leaving out gaps without checks
  totals_since: string | null;
  online_hours: number;
  offline_hours: number;
};

export type ConnectionStatusResult = {
  status: ConnectionStatus;
  fetchedAt: number;
};

export async function getConnectionStatus(): Promise<ConnectionStatusResult> {
  await connection();
  const fetchedAt = Date.now();
  return { status: await getJson("/connection-status"), fetchedAt };
}

export type Segment = {
  start: string;
  end: string;
  online: boolean | null;
  break_at: string | null;
};

export type ConnectionHistory = {
  segments: Segment[];
  fetchedAt: number;
};

export type DayHistory = ConnectionHistory & {
  // Today's 00:00 and the next 00:00 in the server's time zone (TZ)
  dayStart: number;
  dayEnd: number;
};

/** Today's connection history, from midnight to the moment of the fetch. */
export async function getTodayHistory(): Promise<DayHistory> {
  await connection();
  const fetchedAt = Date.now();
  const start = new Date(fetchedAt);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  // Enough hours back to reach midnight
  const hours = Math.max(1, Math.ceil((fetchedAt - start.getTime()) / 3_600_000));
  return {
    segments: await getJson(`/connection-history?hours=${hours}`),
    fetchedAt,
    dayStart: start.getTime(),
    dayEnd: end.getTime(),
  };
}

export type Outage = {
  start: string;
  end: string;
  duration_hours: number;
  ongoing: boolean;
  break_at: string | null;
};

export async function getOutages(hours: number): Promise<Outage[]> {
  return getJson(`/outages?hours=${hours}`);
}

export type BandwidthBucket = "10min" | "hour" | "day";

export type BandwidthPoint = {
  start: string;
  rx_bytes: number;
  tx_bytes: number;
};

export type Bandwidth = {
  total_rx_bytes: number;
  total_tx_bytes: number;
  items: BandwidthPoint[];
};

export type BandwidthResult = {
  bandwidth: Bandwidth;
  fetchedAt: number;
};

export async function getBandwidth(hours: number, bucket: BandwidthBucket): Promise<BandwidthResult> {
  await connection();
  const fetchedAt = Date.now();
  return { bandwidth: await getJson(`/bandwidth?hours=${hours}&bucket=${bucket}`), fetchedAt };
}

export type DeviceUsage = {
  mac: string;
  name: string;
  down_bytes: number;
  up_bytes: number;
};

/** Bytes each device used in the last `hours`, the heaviest first; only devices that used something. */
export async function getDeviceUsage(hours: number): Promise<DeviceUsage[]> {
  await connection();
  return getJson(`/device-usage?hours=${hours}`);
}

export type SpeedTestEvent =
  | { type: "progress"; phase: string; mbps: number; elapsed_ms: number }
  | {
      type: "result";
      download_mbps: number;
      ping_ms: number | null;
      duration_ms: number | null;
      server_location: string | null;
      client_location: string | null;
    }
  | { type: "error"; detail: string };

/** Starts (or follows) a speed test; the body streams one SpeedTestEvent per line. */
export async function streamSpeedTest(signal: AbortSignal): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/speed-test"), { method: "POST", cache: "no-store", signal });
  } catch (error) {
    throw new ApiUnavailableError("Could not reach the API", { cause: error });
  }
  if (!response.ok || !response.body) {
    throw new ApiUnavailableError(`API responded with ${response.status}`);
  }
  return response;
}

export type Device = {
  mac: string;
  name: string;
  ip: string | null;
  /** False when only the history knows the device; the router no longer lists it. */
  in_router: boolean;
  online: boolean;
  blocked: boolean;
  /** KB/s as the router reports them (1 KB = 1024 bytes); limits of 0 mean unlimited. */
  down_kbs: number;
  up_kbs: number;
  connected_since: string | null;
  last_seen: string | null;
  limit_down_kbs: number;
  limit_up_kbs: number;
  usage_24h_down_bytes: number;
  usage_24h_up_bytes: number;
};

/** The live device list; pages go through getDevicesResult, the route handler calls this directly. */
export async function getDevices(): Promise<Device[]> {
  return getJson("/devices", { cache: "no-store" });
}

export type DevicesResult = { devices: Device[]; fetchedAt: number };

export async function getDevicesResult(): Promise<DevicesResult> {
  await connection();
  const fetchedAt = Date.now();
  return { devices: await getDevices(), fetchedAt };
}

export type DeviceHistoryPoint = {
  start: string;
  avg_down_kbs: number;
  max_down_kbs: number;
  avg_up_kbs: number;
  max_up_kbs: number;
  down_bytes: number;
  up_bytes: number;
};

export type DeviceHistory = {
  mac: string;
  total_down_bytes: number;
  total_up_bytes: number;
  items: DeviceHistoryPoint[];
};

export type DeviceHistoryResult = { history: DeviceHistory; fetchedAt: number };

export async function getDeviceHistory(mac: string, hours: number, bucket: BandwidthBucket): Promise<DeviceHistoryResult> {
  await connection();
  const fetchedAt = Date.now();
  const path = `/devices/${encodeURIComponent(mac)}/history?hours=${hours}&bucket=${bucket}`;
  return { history: await getJson(path, { cache: "no-store" }), fetchedAt };
}

export const DEVICE_ACTIONS = ["block", "limit", "name"] as const;

export type DeviceAction = (typeof DEVICE_ACTIONS)[number];

export class ApiRejectedError extends Error {
  constructor(
    readonly status: number,
    readonly detail: unknown,
  ) {
    super(`API rejected the request with ${status}`);
  }
}

/** Sends a block, limit or rename to the API and returns the device as the router lists it afterwards. */
export async function postDeviceAction(mac: string, action: DeviceAction, body: unknown): Promise<Device> {
  let response: Response;
  try {
    response = await fetch(apiUrl(`/devices/${encodeURIComponent(mac)}/${action}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    throw new ApiUnavailableError("Could not reach the API", { cause: error });
  }
  if (response.status >= 500) {
    throw new ApiUnavailableError(`API responded with ${response.status}`);
  }
  if (!response.ok) {
    throw new ApiRejectedError(response.status, (await response.json().catch(() => null))?.detail);
  }
  return response.json();
}
