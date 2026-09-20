import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { streamDumpToFile } from "./streamingPgDump";

let workingDirectory: string;

beforeEach(async () => {
  workingDirectory = await mkdtemp(resolve(tmpdir(), "glantri-streaming-dump-"));
});

afterEach(async () => {
  await rm(workingDirectory, { force: true, recursive: true });
});

describe("streamDumpToFile", () => {
  it("streams the whole dump to the destination file", async () => {
    const destination = resolve(workingDirectory, "dump.sql");

    const result = await streamDumpToFile({
      args: ["-c", "printf 'CREATE TABLE a();\\nCREATE TABLE b();\\n'"],
      command: "sh",
      destination,
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(await readFile(destination, "utf8")).toBe("CREATE TABLE a();\nCREATE TABLE b();\n");
    expect(result.bytesWritten).toBe(36);
  });

  it("writes output far larger than a spawnSync buffer without truncation", async () => {
    const destination = resolve(workingDirectory, "large-dump.sql");
    const lineCount = 400_000;

    const result = await streamDumpToFile({
      args: ["-c", `seq 1 ${lineCount}`],
      command: "sh",
      destination,
    });

    expect(result.status).toBe(0);
    const written = await readFile(destination, "utf8");
    expect(written.trimEnd().split("\n")).toHaveLength(lineCount);
    expect(written.trimEnd().split("\n").at(-1)).toBe(String(lineCount));
    expect(result.bytesWritten).toBeGreaterThan(2_000_000);
  });

  it("passes the environment through to the dump command", async () => {
    const destination = resolve(workingDirectory, "env-dump.sql");

    const result = await streamDumpToFile({
      args: ["-c", 'printf "%s" "$PGPASSWORD"'],
      command: "sh",
      destination,
      env: { PATH: process.env.PATH ?? "", PGPASSWORD: "streamed-secret" },
    });

    expect(result.status).toBe(0);
    expect(await readFile(destination, "utf8")).toBe("streamed-secret");
  });

  it("leaves no file behind when the dump command fails after partial output", async () => {
    const destination = resolve(workingDirectory, "failed-dump.sql");

    const result = await streamDumpToFile({
      args: ["-c", "printf 'partial output\\n'; printf 'pg_dump: error: boom\\n' >&2; exit 1"],
      command: "sh",
      destination,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("pg_dump: error: boom");
    expect(result.bytesWritten).toBe(0);
    expect(existsSync(destination)).toBe(false);
    expect(existsSync(`${destination}.partial`)).toBe(false);
  });

  it("reports a missing command without writing a destination file", async () => {
    const destination = resolve(workingDirectory, "missing-command.sql");

    const result = await streamDumpToFile({
      args: ["--version"],
      command: resolve(workingDirectory, "definitely-not-installed"),
      destination,
    });

    expect(result.error?.code).toBe("ENOENT");
    expect(existsSync(destination)).toBe(false);
    expect(existsSync(`${destination}.partial`)).toBe(false);
  });
});
