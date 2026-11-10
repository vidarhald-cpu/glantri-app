import { brotliCompress, constants, gzip } from "node:zlib";
import { promisify } from "node:util";

import type { FastifyInstance } from "fastify";

/**
 * Forgejo #1093: JSON API responses (combat mutations, round summaries, projections) reach 300-650 KB
 * and App Service does not compress container responses. This `onSend` hook compresses string/Buffer
 * JSON payloads at or above a threshold with brotli or gzip, as the client's `Accept-Encoding`
 * allows. Streams (Artifact downloads), multipart, non-JSON, already-encoded, 204/304 and HEAD
 * responses are left untouched, so bodies are byte-identical after decompression.
 */

export const COMPRESSION_THRESHOLD_BYTES = 1024;

const brotliAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

type Encoding = "br" | "gzip";

export function chooseEncoding(acceptEncoding: string | string[] | undefined): Encoding | null {
  if (!acceptEncoding) {
    return null;
  }
  const header = Array.isArray(acceptEncoding) ? acceptEncoding.join(",") : acceptEncoding;
  const q = new Map<string, number>();
  for (const part of header.split(",")) {
    const [rawName, ...params] = part.trim().split(";");
    const name = rawName?.trim().toLowerCase();
    if (!name) {
      continue;
    }
    let weight = 1;
    for (const param of params) {
      const match = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(param);
      if (match) {
        const parsed = Number(match[1]);
        weight = Number.isFinite(parsed) ? parsed : 0;
      }
    }
    q.set(name, weight);
  }
  const wildcard = q.get("*") ?? 0;
  const br = q.get("br") ?? wildcard;
  const gz = q.get("gzip") ?? q.get("x-gzip") ?? wildcard;
  if (br <= 0 && gz <= 0) {
    return null;
  }
  return br >= gz && br > 0 ? "br" : "gzip";
}

function isJsonContentType(contentType: unknown): boolean {
  if (typeof contentType !== "string") {
    return false;
  }
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

function appendVary(existing: unknown, value: string): string {
  const current = Array.isArray(existing)
    ? existing.join(", ")
    : typeof existing === "string"
      ? existing
      : "";
  if (current === "*") {
    return current;
  }
  const tokens = current
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  return tokens.includes(value.toLowerCase()) ? current : current ? `${current}, ${value}` : value;
}

export function registerResponseCompression(app: FastifyInstance) {
  app.addHook("onSend", async (request, reply, payload) => {
    if (
      request.method === "HEAD" ||
      reply.statusCode === 204 ||
      reply.statusCode === 304 ||
      (typeof payload !== "string" && !Buffer.isBuffer(payload)) ||
      reply.hasHeader("content-encoding") ||
      !isJsonContentType(reply.getHeader("content-type"))
    ) {
      return payload;
    }
    const body = typeof payload === "string" ? Buffer.from(payload) : payload;
    if (body.length < COMPRESSION_THRESHOLD_BYTES) {
      return payload;
    }
    const encoding = chooseEncoding(request.headers["accept-encoding"]);
    if (!encoding) {
      return payload;
    }

    const compressed =
      encoding === "br"
        ? await brotliAsync(body, {
            params: {
              [constants.BROTLI_PARAM_QUALITY]: 4,
              [constants.BROTLI_PARAM_SIZE_HINT]: body.length,
            },
          })
        : await gzipAsync(body);

    reply.header("content-encoding", encoding);
    reply.header("vary", appendVary(reply.getHeader("vary"), "Accept-Encoding"));
    reply.header("content-length", String(compressed.length));
    const etag = reply.getHeader("etag");
    if (typeof etag === "string" && !etag.startsWith("W/")) {
      reply.header("etag", `W/${etag}`);
    }
    return compressed;
  });
}
