import { connection } from "next/server";

import { ApiUnavailableError, streamThroughput } from "@/lib/api";

// Passes the API's NDJSON stream straight through, so the dashboard sees the Nano's speed every second
export async function GET(request: Request) {
  await connection();
  try {
    const upstream = await streamThroughput(request.signal);
    return new Response(upstream.body, {
      headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ApiUnavailableError) {
      return Response.json({ detail: error.message }, { status: 503 });
    }
    throw error;
  }
}
