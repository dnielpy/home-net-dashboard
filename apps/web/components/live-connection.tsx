import { ConnectionChain } from "@/components/connection-chain/connection-chain";
import { StatusMessage } from "@/components/status-message";
import {
  ApiUnavailableError,
  getHops,
  getLatestCheck,
  getLatestSpeedTest,
  type HopInfo,
  type LatestCheck,
  type LatestSpeedTest,
} from "@/lib/api";

export async function LiveConnectionView() {
  let hops: HopInfo[];
  let latest: LatestCheck | null;
  let latestSpeedTest: LatestSpeedTest | null;
  try {
    [hops, latest, latestSpeedTest] = await Promise.all([getHops(), getLatestCheck(), getLatestSpeedTest()]);
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return <StatusMessage title="API unavailable" body="Could not load data from the API. Make sure it is running." />;
    }
    throw error;
  }

  return <ConnectionChain hops={hops} latest={latest} latestSpeedTest={latestSpeedTest} />;
}
