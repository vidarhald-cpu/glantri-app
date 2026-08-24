import { Readable } from "node:stream";
import type { ContainerClient } from "@azure/storage-blob";
import { describe, expect, it } from "vitest";

import { AzureArtifactBinaryStore } from "./azureArtifactBinaryStore";

async function* stream(chunks: Uint8Array[]) {
  yield* chunks;
}

function fakeContainer() {
  const objects = new Map<string, Buffer>();
  return {
    objects,
    client: {
      getBlobClient(key: string) {
        return {
          async deleteIfExists() {
            objects.delete(key);
            return { succeeded: true };
          },
          async download() {
            const bytes = objects.get(key);
            if (!bytes) throw { statusCode: 404 };
            return { contentLength: bytes.length, readableStreamBody: Readable.from([bytes]) };
          },
          async getProperties() {
            const bytes = objects.get(key);
            if (!bytes) throw { statusCode: 404 };
            return { contentLength: bytes.length };
          },
        };
      },
      getBlockBlobClient(key: string) {
        return {
          async uploadStream(stream: NodeJS.ReadableStream) {
            if (objects.has(key)) throw new Error("blob already exists");
            const chunks: Buffer[] = [];
            for await (const chunk of stream) chunks.push(Buffer.from(chunk));
            objects.set(key, Buffer.concat(chunks));
          },
        };
      },
    } as unknown as ContainerClient,
  };
}

describe("AzureArtifactBinaryStore contract", () => {
  it("streams private server-side put/read/stat/delete without returning a URL", async () => {
    const fake = fakeContainer();
    const store = new AzureArtifactBinaryStore(fake.client);
    const key = "c".repeat(32);
    const bytes = Buffer.from("azure-compatible private bytes");
    const put = await store.put({ content: stream([bytes]), key });
    expect(put).toMatchObject({ byteSize: bytes.length });
    expect(put).not.toHaveProperty("url");
    await expect(store.put({ content: stream([Buffer.from("replacement")]), key })).rejects.toThrow(
      "already exists",
    );
    expect(await store.stat(key)).toEqual({ byteSize: bytes.length });

    const read = await store.read({ key });
    const chunks: Uint8Array[] = [];
    for await (const chunk of read.content) chunks.push(chunk);
    expect(Buffer.concat(chunks)).toEqual(bytes);
    expect(read).not.toHaveProperty("url");

    await store.delete(key);
    expect(await store.stat(key)).toBeNull();
    await store.delete(key);
  });

  it("rejects non-opaque keys before contacting the provider", async () => {
    const store = new AzureArtifactBinaryStore(fakeContainer().client);
    await expect(
      store.put({ content: stream([Buffer.from("x")]), key: "../../escape" }),
    ).rejects.toThrow();
  });
});
