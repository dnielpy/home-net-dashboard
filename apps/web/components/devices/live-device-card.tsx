"use client";

import { useEffect, useState } from "react";

import { DeviceCard } from "@/components/devices/device-card";
import type { Device } from "@/lib/api";

const REFRESH_INTERVAL_MS = 5_000;

/** One device's card, refreshed every few seconds from the live device list. */
export function LiveDeviceCard({ initialDevice, fetchedAt }: { initialDevice: Device; fetchedAt: number }) {
  const [device, setDevice] = useState(initialDevice);
  const [now, setNow] = useState(fetchedAt);

  useEffect(() => {
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const response = await fetch("/api/devices", { cache: "no-store" });
        if (!response.ok) return;
        const next = ((await response.json()) as Device[]).find((item) => item.mac === initialDevice.mac);
        if (next && !cancelled) {
          setDevice(next);
          setNow(Date.now());
        }
      } catch {
        // Keep showing the last state until the router answers again
      }
    }, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [initialDevice.mac]);

  return <DeviceCard device={device} now={now} onChange={setDevice} />;
}
