import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { rename, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

const MAX_CAPTURED_STDERR_CHARACTERS = 64 * 1024;

export type StreamedDumpOptions = {
  args: string[];
  command: string;
  destination: string;
  env?: NodeJS.ProcessEnv;
};

export type StreamedDumpResult = {
  bytesWritten: number;
  error?: NodeJS.ErrnoException;
  status: number | null;
  stderr: string;
};

/**
 * Stream a `pg_dump` (or `docker exec ... pg_dump`) straight to disk.
 *
 * Buffering a whole dump in memory fails with ENOBUFS on a realistic database,
 * so stdout is piped into the destination file instead. The dump is written to a
 * sibling `.partial` file and renamed only after the process exits successfully,
 * so a failed or interrupted dump can never leave a truncated file presented as
 * a valid backup. Failure detection stays with the caller: spawn errors, exit
 * status, and captured stderr are returned unchanged.
 */
export async function streamDumpToFile({
  args,
  command,
  destination,
  env,
}: StreamedDumpOptions): Promise<StreamedDumpResult> {
  const partialPath = `${destination}.partial`;
  const writeStream = createWriteStream(partialPath);
  const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    if (stderr.length < MAX_CAPTURED_STDERR_CHARACTERS) {
      stderr += chunk;
    }
  });

  let spawnError: NodeJS.ErrnoException | undefined;
  let streamError: NodeJS.ErrnoException | undefined;

  const streamed = pipeline(child.stdout, writeStream).catch((error: unknown) => {
    streamError = error as NodeJS.ErrnoException;
  });

  const status = await new Promise<number | null>((resolve) => {
    child.once("error", (error: NodeJS.ErrnoException) => {
      spawnError = error;
      child.stdout.destroy();
      resolve(null);
    });
    child.once("close", (code) => {
      resolve(code);
    });
  });

  await streamed;

  const failure = spawnError ?? streamError;

  if (failure || status !== 0) {
    await rm(partialPath, { force: true });

    return {
      bytesWritten: 0,
      error: failure,
      status,
      stderr,
    };
  }

  const bytesWritten = writeStream.bytesWritten;
  await rename(partialPath, destination);

  return {
    bytesWritten,
    status,
    stderr,
  };
}
