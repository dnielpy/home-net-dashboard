import { connection } from "next/server";

// An empty answer, so the browser can time a round trip to this server
export async function GET() {
  await connection();
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
