import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { chmod, link, mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import type {
  ArtifactBinaryReadResult,
  ArtifactBinaryStatResult,
  ArtifactBinaryStore,
} from "@glantri/database";

function validateKey(key: string): void {
  if (!/^[a-f0-9]{32,64}$/.test(key)) throw new Error("Invalid Artifact storage key.");
}

export class LocalArtifactBinaryStore implements ArtifactBinaryStore {
  readonly provider = "local" as const;

  constructor(private readonly root: string) {}

  async put(input: { content: AsyncIterable<Uint8Array>; key: string; signal?: AbortSignal }) {
    validateKey(input.key);
    await this.prepareRoot();
    const finalPath = this.resolveKey(input.key);
    const temporaryPath = path.join(this.root, `.${input.key}.${randomUUID()}.part`);
    const digest = createHash("sha256");
    let byteSize = 0;
    const hashingTransform = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        byteSize += chunk.byteLength;
        digest.update(chunk);
        callback(null, chunk);
      },
    });

    try {
      await pipeline(
        input.content,
        hashingTransform,
        createWriteStream(temporaryPath, { flags: "wx", mode: 0o600 }),
        { signal: input.signal },
      );
      await chmod(temporaryPath, 0o600);
      await link(temporaryPath, finalPath);
      await unlink(temporaryPath);
      return { byteSize, sha256Digest: digest.digest("hex") };
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  async read(input: { key: string; signal?: AbortSignal }): Promise<ArtifactBinaryReadResult> {
    validateKey(input.key);
    const details = await stat(this.resolveKey(input.key));
    if (!details.isFile()) throw new Error("Artifact object not found.");
    return {
      byteSize: details.size,
      content: createReadStream(this.resolveKey(input.key), { signal: input.signal }),
    };
  }

  async stat(key: string): Promise<ArtifactBinaryStatResult | null> {
    validateKey(key);
    try {
      const details = await stat(this.resolveKey(key));
      if (!details.isFile()) return null;
      const digest = createHash("sha256");
      for await (const chunk of createReadStream(this.resolveKey(key))) digest.update(chunk);
      return { byteSize: details.size, sha256Digest: digest.digest("hex") };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    validateKey(key);
    await unlink(this.resolveKey(key)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  private async prepareRoot(): Promise<void> {
    await mkdir(this.root, { mode: 0o700, recursive: true });
    await chmod(this.root, 0o700);
  }

  private resolveKey(key: string): string {
    const resolved = path.resolve(this.root, key);
    if (path.dirname(resolved) !== path.resolve(this.root)) {
      throw new Error("Invalid Artifact storage key.");
    }
    return resolved;
  }
}
