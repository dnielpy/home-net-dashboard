import { ApiUnavailableError, getLiveHop } from "@/lib/api";
import { isHopName } from "@/lib/hops";

// The browser cannot reach the API directly (in Docker it lives at http://api:3011), so pings go through here
export async function GET(_request: Request, ctx: RouteContext<"/api/hops/[hop]">) {
  const { hop } = await ctx.params;
  if (!isHopName(hop)) {
    return Response.json({ detail: `Unknown hop ${hop}` }, { status: 404 });
  }

  try {
    return Response.json(await getLiveHop(hop));
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return Response.json({ detail: error.message }, { status: 503 });
    }
    throw error;
  }
}
