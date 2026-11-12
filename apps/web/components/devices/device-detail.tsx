import { LiveDeviceCard } from "@/components/devices/live-device-card";
import { StatusMessage } from "@/components/status-message";
import { ApiUnavailableError, type DevicesResult, getDevicesResult } from "@/lib/api";

export async function DeviceDetail({ mac }: { mac: string }) {
  let result: DevicesResult;
  try {
    result = await getDevicesResult();
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return <StatusMessage title="Router unavailable" body="Could not load the device. Its history is below." />;
    }
    throw error;
  }

  const device = result.devices.find((item) => item.mac === mac);
  if (!device) {
    return <StatusMessage title="Unknown device" body={`Neither the router nor the history knows ${mac}.`} />;
  }
  return (
    <div className="flex flex-col gap-1">
      <h1 className="sr-only">{device.name || mac}</h1>
      <LiveDeviceCard initialDevice={device} fetchedAt={result.fetchedAt} />
    </div>
  );
}
