import { Readable } from "node:stream";
import { brotliDecompressSync, gunzipSync } from "node:zlib";

import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { chooseEncoding, registerResponseCompression } from "./responseCompression";
import { CLIENT_SAFE_INTERNAL_ERROR_MESSAGE, sendInternalServerError } from "./errors";

// Forgejo #1093: JSON responses above the threshold are compressed; everything else is untouched.

const largeBody = {
  rounds: Array.from({ length: 400 }, (_, i) => ({
    round: i,
    summary: "combat event ".repeat(10),
  })),
};
const largeJson = JSON.stringify(largeBody);

function buildApp() {
  const app = Fastify();
  registerResponseCompression(app);
  app.get("/large", async () => largeBody);
  app.get("/small", async () => ({ ok: true }));
  app.get("/empty", async (_req, reply) => reply.code(204).send());
  app.get("/text", async (_req, reply) => reply.type("text/plain").send("x".repeat(5000)));
  app.get("/stream", async (_req, reply) =>
    reply.type("application/json").send(Readable.from([Buffer.from(largeJson)])),
  );
  app.get("/encoded", async (_req, reply) =>
    reply.header("content-encoding", "identity").send(largeBody),
  );
  app.get("/binary", async (_req, reply) =>
    reply.type("application/octet-stream").send(Buffer.alloc(5000, 1)),
  );
  app.get("/vary", async (_req, reply) => reply.header("vary", "Origin").send(largeBody));
  app.get("/boom", async () => {
    throw new Error("secret detail");
  });
  app.setErrorHandler((error, _req, reply) => sendInternalServerError(error, reply));
  return app;
}

describe("response compression", () => {
  it("compresses large JSON with gzip and decompresses byte-identically", async () => {
    const res = await buildApp().inject({ url: "/large", headers: { "accept-encoding": "gzip" } });
    expect(res.headers["content-encoding"]).toBe("gzip");
    expect(res.headers.vary).toBe("Accept-Encoding");
    expect(res.headers["content-length"]).toBe(String(res.rawPayload.length));
    expect(res.rawPayload.length).toBeLessThan(largeJson.length / 5);
    expect(gunzipSync(res.rawPayload).toString()).toBe(largeJson);
    expect(res.statusCode).toBe(200);
  });

  it("prefers brotli and decompresses byte-identically", async () => {
    const res = await buildApp().inject({
      url: "/large",
      headers: { "accept-encoding": "gzip, deflate, br" },
    });
    expect(res.headers["content-encoding"]).toBe("br");
    expect(brotliDecompressSync(res.rawPayload).toString()).toBe(largeJson);
  });

  it("appends to an existing Vary header", async () => {
    const res = await buildApp().inject({ url: "/vary", headers: { "accept-encoding": "gzip" } });
    expect(res.headers.vary).toBe("Origin, Accept-Encoding");
  });

  it("leaves responses uncompressed without a usable Accept-Encoding", async () => {
    const app = buildApp();
    for (const value of [undefined, "identity", "gzip;q=0, br;q=0", "deflate"]) {
      const res = await app.inject({
        url: "/large",
        headers: value ? { "accept-encoding": value } : {},
      });
      expect(res.headers["content-encoding"]).toBeUndefined();
      expect(res.headers.vary).toBeUndefined();
      expect(res.payload).toBe(largeJson);
    }
  });

  it("does not touch small, empty, text, binary, stream, pre-encoded or HEAD responses", async () => {
    const app = buildApp();
    const headers = { "accept-encoding": "gzip, br" };
    const small = await app.inject({ url: "/small", headers });
    expect(small.headers["content-encoding"]).toBeUndefined();
    expect(small.payload).toBe('{"ok":true}');
    const empty = await app.inject({ url: "/empty", headers });
    expect(empty.statusCode).toBe(204);
    expect(empty.headers["content-encoding"]).toBeUndefined();
    const text = await app.inject({ url: "/text", headers });
    expect(text.headers["content-encoding"]).toBeUndefined();
    const binary = await app.inject({ url: "/binary", headers });
    expect(binary.headers["content-encoding"]).toBeUndefined();
    expect(binary.rawPayload.equals(Buffer.alloc(5000, 1))).toBe(true);
    const stream = await app.inject({ url: "/stream", headers });
    expect(stream.headers["content-encoding"]).toBeUndefined();
    expect(stream.payload).toBe(largeJson);
    const encoded = await app.inject({ url: "/encoded", headers });
    expect(encoded.headers["content-encoding"]).toBe("identity");
    expect(encoded.payload).toBe(largeJson);
    const head = await app.inject({ method: "HEAD", url: "/large", headers });
    expect(head.headers["content-encoding"]).toBeUndefined();
  });

  it("leaves the small fixed 500 error body unchanged", async () => {
    const res = await buildApp().inject({ url: "/boom", headers: { "accept-encoding": "gzip" } });
    expect(res.headers["content-encoding"]).toBeUndefined();
    expect(res.payload).toContain(CLIENT_SAFE_INTERNAL_ERROR_MESSAGE);
  });

  it("parses Accept-Encoding with q-values and wildcards", () => {
    expect(chooseEncoding("gzip;q=0.5, br;q=0.9")).toBe("br");
    expect(chooseEncoding("br;q=0.2, gzip")).toBe("gzip");
    expect(chooseEncoding("*")).toBe("br");
    expect(chooseEncoding("br;q=0, *;q=0.5")).toBe("gzip");
    expect(chooseEncoding("identity")).toBeNull();
    expect(chooseEncoding(undefined)).toBeNull();
  });
});
