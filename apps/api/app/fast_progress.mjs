// Runs fast-test-cli's download test and prints one JSON line per progress update, then one with the result.
// The CLI only reports progress on an interactive terminal, so this calls its speed test module directly.
// Usage: node fast_progress.mjs <path to fast-test-cli/dist/src/speed-test.js>
import { pathToFileURL } from "node:url";

const { runSpeedTest } = await import(pathToFileURL(process.argv[2]).href);

const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);

try {
  const result = await runSpeedTest({ upload: false }, ({ phase, mbps, elapsedMs }) =>
    emit({ type: "progress", phase, mbps, elapsedMs }),
  );
  emit({ type: "result", ...result });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
