import { readdir, readFile, stat } from "node:fs/promises";

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

const sourcePath = process.argv[2];
const sources = sourcePath
  ? (await stat(sourcePath)).isDirectory()
    ? await Promise.all(
        (await readdir(sourcePath))
          .filter((filename) => filename.endsWith(".json"))
          .sort()
          .map((filename) => readFile(`${sourcePath}/${filename}`, "utf8")),
      )
    : [await readFile(sourcePath, "utf8")]
  : await new Promise((resolve, reject) => {
      let value = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        value += chunk;
      });
      process.stdin.on("end", () => resolve([value]));
      process.stdin.on("error", reject);
    });

const records = sources.flatMap((source) => {
  try {
    const capture = JSON.parse(source);
    if (capture?.version === 1 && Array.isArray(capture?.server?.stages)) {
      return [
        ...capture.server.stages.map((stage) => ({
          ...stage,
          command: capture.command,
          correlationId: capture.correlationId,
          roundNumber: capture.round,
          source: "server",
        })),
        ...(capture.client?.stages ?? []).map((stage) => ({
          ...stage,
          command: capture.command,
          correlationId: capture.correlationId,
          roundNumber: capture.round,
          source: "client",
        })),
      ];
    }
  } catch {
    // Fall through to the earlier console-line format.
  }

  return source.split(/\r?\n/).flatMap((line) => {
    const jsonStart = line.indexOf("{");
    if (!line.includes("PERF combat-command") || jsonStart < 0) {
      return [];
    }
    try {
      return [JSON.parse(line.slice(jsonStart))];
    } catch {
      return [];
    }
  });
});

const timingRecords = records
  .filter(
    (record) =>
      typeof record.correlationId === "string" &&
      typeof record.durationMs === "number" &&
      typeof record.stage === "string",
  );

const samplesByRoundAndStage = new Map();
for (const record of timingRecords) {
  const round = record.roundNumber ?? "unknown";
  const source = record.source ?? "console";
  const key = `${round}:${source}:${record.stage}`;
  const samples = samplesByRoundAndStage.get(key) ?? [];
  samples.push(record.durationMs);
  samplesByRoundAndStage.set(key, samples);
}

const rows = [...samplesByRoundAndStage.entries()]
  .map(([key, values]) => {
    const [round, source, ...stage] = key.split(":");
    return {
      medianMs: Number(median(values).toFixed(2)),
      round,
      samples: values.length,
      source,
      stage: stage.join(":"),
    };
  })
  .sort(
    (left, right) =>
      Number(left.round) - Number(right.round) || left.stage.localeCompare(right.stage),
  );

process.stdout.write(`${JSON.stringify({ records: timingRecords.length, rows }, null, 2)}\n`);
