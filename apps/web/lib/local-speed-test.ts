const BASE = "/api/local-speed-test";

const STREAMS = 4;
const DURATION_MS = 8000;
// The first second fills the TCP windows, so the final speed is taken from after it
const WARMUP_MS = 1000;
const TICK_MS = 250;
const DOWNLOAD_BYTES = 25 * 1024 * 1024;
const UPLOAD_BYTES = 4 * 1024 * 1024;
const PINGS = 10;

function toMbps(bytes: number, ms: number): number {
  return ms > 0 ? (bytes * 8) / 1000 / ms : 0;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** The median round trip to this server, in ms, from a few back to back empty requests. */
export async function measureLatency(signal: AbortSignal): Promise<number> {
  const ping = async () => {
    const start = performance.now();
    await fetch(`${BASE}/ping?r=${Math.random()}`, { signal, cache: "no-store" });
    return performance.now() - start;
  };

  // The first request may open the connection, so it does not count
  await ping();
  const samples: number[] = [];
  for (let i = 0; i < PINGS; i++) samples.push(await ping());
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

type Worker = (stop: AbortSignal, addBytes: (bytes: number) => void) => Promise<void>;

/** Runs a few workers in parallel for a fixed time, reporting the combined speed while they go and the final one at the end. */
async function measureThroughput(signal: AbortSignal, onProgress: (mbps: number) => void, worker: Worker): Promise<number> {
  const stop = new AbortController();
  const abort = () => stop.abort();
  signal.addEventListener("abort", abort);

  let bytes = 0;
  const start = performance.now();
  let warm: { at: number; bytes: number } | null = null;

  const speedNow = () => {
    const now = performance.now();
    if (!warm && now - start >= WARMUP_MS) warm = { at: now, bytes };
    return warm && now > warm.at ? toMbps(bytes - warm.bytes, now - warm.at) : toMbps(bytes, now - start);
  };

  const ticker = setInterval(() => onProgress(speedNow()), TICK_MS);
  const timer = setTimeout(abort, DURATION_MS);

  const run = async () => {
    while (!stop.signal.aborted) {
      try {
        await worker(stop.signal, (received) => (bytes += received));
      } catch (error) {
        if (!stop.signal.aborted || !isAbort(error)) throw error;
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: STREAMS }, run));
  } finally {
    clearInterval(ticker);
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    stop.abort();
  }
  if (signal.aborted) throw new DOMException("The test was cancelled", "AbortError");
  return speedNow();
}

/** Download speed from this server to the browser, in Mbps. */
export function measureDownload(signal: AbortSignal, onProgress: (mbps: number) => void): Promise<number> {
  return measureThroughput(signal, onProgress, async (stop, addBytes) => {
    const response = await fetch(`${BASE}/download?bytes=${DOWNLOAD_BYTES}&r=${Math.random()}`, {
      signal: stop,
      cache: "no-store",
    });
    if (!response.ok || !response.body) throw new Error(`Download responded with ${response.status}`);
    const reader = response.body.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      addBytes(value.byteLength);
    }
  });
}

let uploadPayload: Blob | null = null;

// Random bytes, so nothing on the way can compress them; getRandomValues fills at most 64 KiB per call
function getUploadPayload(): Blob {
  if (!uploadPayload) {
    const data = new Uint8Array(UPLOAD_BYTES);
    for (let offset = 0; offset < data.length; offset += 65536) {
      crypto.getRandomValues(data.subarray(offset, offset + 65536));
    }
    uploadPayload = new Blob([data], { type: "application/octet-stream" });
  }
  return uploadPayload;
}

/** Upload speed from the browser to this server, in Mbps. Uses XMLHttpRequest, as fetch cannot report upload progress. */
export function measureUpload(signal: AbortSignal, onProgress: (mbps: number) => void): Promise<number> {
  const payload = getUploadPayload();
  return measureThroughput(
    signal,
    onProgress,
    (stop, addBytes) =>
      new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let sent = 0;
        xhr.upload.onprogress = (event) => {
          addBytes(event.loaded - sent);
          sent = event.loaded;
        };
        xhr.onload = () => (xhr.status < 400 ? resolve() : reject(new Error(`Upload responded with ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.onabort = () => reject(new DOMException("Upload aborted", "AbortError"));
        stop.addEventListener("abort", () => xhr.abort(), { once: true });
        xhr.open("POST", `${BASE}/upload`);
        xhr.send(payload);
      }),
  );
}
