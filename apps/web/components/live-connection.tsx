import { ConnectionChain } from "@/components/connection-chain/connection-chain";
import { StatusMessage } from "@/components/status-message";
import { ApiUnavailableError, getHops, type HopInfo } from "@/lib/api";

export async function LiveConnectionView() {
  let hops: HopInfo[];
  try {
    hops = await getHops();
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return <StatusMessage title="API unavailable" body="Could not load data from the API. Make sure it is running." />;
    }
    throw error;
  }

  return <ConnectionChain hops={hops} />;
}
