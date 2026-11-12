import { ApiUnavailableError, getDevices } from "@/lib/api";

// The browser cannot reach the API directly (in Docker it lives at http://api:3011), so the live list comes through here
export async function GET() {
  try {
    return Response.json(await getDevices(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return Response.json({ detail: error.message }, { status: 503 });
    }
    throw error;
  }
}
