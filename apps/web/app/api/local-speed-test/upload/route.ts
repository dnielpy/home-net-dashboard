// Reads and throws away the body for the local upload test, answering with how many bytes arrived
export async function POST(request: Request) {
  let received = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      received += value.byteLength;
    }
  }
  return Response.json({ received }, { headers: { "Cache-Control": "no-store" } });
}
