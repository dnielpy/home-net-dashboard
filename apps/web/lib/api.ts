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

export type LatestSpeedTest = {
  measured_at: string;
  download_mbps: number;
  ping_ms: number | null;
  duration_ms: number | null;
  server_location: string | null;
  client_location: string | null;
};

export async function getLatestSpeedTest(): Promise<LatestSpeedTest | null> {
  return getJson("/speed-test/latest", { cache: "no-store" });
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

export async function getConnectionHistory(hours: number): Promise<ConnectionHistory> {
  await connection();
  const fetchedAt = Date.now();
  return { segments: await getJson(`/connection-history?hours=${hours}`), fetchedAt };
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
