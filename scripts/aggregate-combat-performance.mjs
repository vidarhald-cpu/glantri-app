import { readFile } from "node:fs/promises";

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

const sourcePath = process.argv[2];
const source = sourcePath
  ? await readFile(sourcePath, "utf8")
  : await new Promise((resolve, reject) => {
      let value = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        value += chunk;
      });
      process.stdin.on("end", () => resolve(value));
      process.stdin.on("error", reject);
    });

const records = source
  .split(/\r?\n/)
  .flatMap((line) => {
    const jsonStart = line.indexOf("{");
    if (!line.includes("PERF combat-command") || jsonStart < 0) {
      return [];
    }
    try {
      return [JSON.parse(line.slice(jsonStart))];
    } catch {
      return [];
    }
  })
  .filter(
    (record) =>
      typeof record.correlationId === "string" &&
      typeof record.durationMs === "number" &&
      typeof record.stage === "string",
  );

const samplesByRoundAndStage = new Map();
for (const record of records) {
  const round = record.roundNumber ?? "unknown";
  const key = `${round}:${record.stage}`;
  const samples = samplesByRoundAndStage.get(key) ?? [];
  samples.push(record.durationMs);
  samplesByRoundAndStage.set(key, samples);
}

const rows = [...samplesByRoundAndStage.entries()]
  .map(([key, values]) => {
    const separator = key.indexOf(":");
    return {
      medianMs: Number(median(values).toFixed(2)),
      round: key.slice(0, separator),
      samples: values.length,
      stage: key.slice(separator + 1),
    };
  })
  .sort(
    (left, right) =>
      Number(left.round) - Number(right.round) || left.stage.localeCompare(right.stage),
  );

process.stdout.write(`${JSON.stringify({ records: records.length, rows }, null, 2)}\n`);
