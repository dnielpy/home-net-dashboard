import { randomBytes } from "node:crypto";

const CHUNK = randomBytes(1024 * 1024);
const MAX_BYTES = 200 * 1024 * 1024;
const DEFAULT_BYTES = 25 * 1024 * 1024;

// Streams `bytes` random bytes (incompressible, so nothing in between can shrink them) for the local download test
export async function GET(request: Request) {
  const requested = Number(new URL(request.url).searchParams.get("bytes"));
  const total = Number.isFinite(requested) && requested > 0 ? Math.min(Math.floor(requested), MAX_BYTES) : DEFAULT_BYTES;

  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const size = Math.min(CHUNK.length, total - sent);
      controller.enqueue(CHUNK.subarray(0, size));
      sent += size;
      if (sent >= total) controller.close();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(total),
      "Cache-Control": "no-store",
    },
  });
}
