import type { Metadata } from "next";
import { Suspense } from "react";

import { DeviceList } from "@/components/devices/device-list";
import { ChartCardSkeleton } from "@/components/stats/chart-card-skeleton";
import { StatusMessage } from "@/components/status-message";
import { ApiUnavailableError, type DevicesResult, getDevicesResult } from "@/lib/api";

export const metadata: Metadata = {
  title: "Devices · Home Net",
};

async function Devices() {
  let result: DevicesResult;
  try {
    result = await getDevicesResult();
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return (
        <StatusMessage
          title="Router unavailable"
          body="Could not load the devices. Make sure the API is running and can log in to the router."
        />
      );
    }
    throw error;
  }
  return <DeviceList initialDevices={result.devices} fetchedAt={result.fetchedAt} />;
}

export default function DevicesPage() {
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-4 px-4 py-6 md:px-6">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Devices</h1>
      <Suspense fallback={<ChartCardSkeleton height={320} />}>
        <Devices />
      </Suspense>
    </main>
  );
}
