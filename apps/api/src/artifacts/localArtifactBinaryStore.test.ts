import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { LocalArtifactBinaryStore } from "./localArtifactBinaryStore";

const roots: string[] = [];

async function* stream(chunks: Uint8Array[]) {
  yield* chunks;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("LocalArtifactBinaryStore", () => {
  it("writes opaque objects atomically with private permissions and matching integrity", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "glantri-artifact-store-"));
    roots.push(root);
    const store = new LocalArtifactBinaryStore(root);
    const key = "a".repeat(32);
    const bytes = Buffer.from("private artifact bytes");
    const result = await store.put({ content: stream([bytes]), key });

    expect(result.byteSize).toBe(bytes.length);
    expect(result.sha256Digest).toMatch(/^[0-9a-f]{64}$/);
    expect(await readFile(path.join(root, key))).toEqual(bytes);
    expect((await stat(root)).mode & 0o777).toBe(0o700);
    expect((await stat(path.join(root, key))).mode & 0o777).toBe(0o600);
    expect(await store.stat(key)).toEqual({ byteSize: bytes.length });
    await expect(
      store.put({ content: stream([Buffer.from("replacement")]), key }),
    ).rejects.toThrow();
    expect(await readFile(path.join(root, key))).toEqual(bytes);

    const read = await store.read({ key });
    const chunks: Uint8Array[] = [];
    for await (const chunk of read.content) chunks.push(chunk);
    expect(Buffer.concat(chunks)).toEqual(bytes);
    await store.delete(key);
    expect(await store.stat(key)).toBeNull();
    await expect(store.delete(key)).resolves.toBeUndefined();
  });

  it("rejects traversal and cleans a partial file after abort", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "glantri-artifact-store-"));
    roots.push(root);
    const store = new LocalArtifactBinaryStore(root);
    await expect(
      store.put({ content: stream([Buffer.from("x")]), key: "../escape" }),
    ).rejects.toThrow();

    const controller = new AbortController();
    const content = (async function* () {
      yield Buffer.alloc(1024);
      controller.abort();
      yield Buffer.alloc(1024);
    })();
    await expect(
      store.put({ content, key: "b".repeat(32), signal: controller.signal }),
    ).rejects.toThrow();
    await expect((await import("node:fs/promises")).readdir(root)).resolves.not.toContain(
      "b".repeat(32),
    );
  });
});
