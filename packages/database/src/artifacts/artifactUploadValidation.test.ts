import { describe, expect, it } from "vitest";

import {
  ArtifactUploadValidationError,
  MAX_ARTIFACT_BYTES,
  sanitizeArtifactFilename,
  validateArtifactUpload,
} from "./artifactUploadValidation";

async function* stream(chunks: Uint8Array[]) {
  yield* chunks;
}

async function consume(input: ReturnType<typeof validateArtifactUpload>) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of input.content) chunks.push(chunk);
  return { chunks, result: await input.result };
}

const supported = [
  { bytes: Buffer.from("89504e470d0a1a0a00000000", "hex"), mediaType: "image/png" },
  { bytes: Buffer.from("ffd8ffe00010ffd9", "hex"), mediaType: "image/jpeg" },
  { bytes: Buffer.from("524946460400000057454250", "hex"), mediaType: "image/webp" },
  { bytes: Buffer.from("%PDF-1.7\n1 0 obj\n%%EOF\n"), mediaType: "application/pdf" },
] as const;

describe("Artifact upload validation", () => {
  for (const fixture of supported) {
    it(`streams and accepts ${fixture.mediaType}`, async () => {
      const upload = validateArtifactUpload({
        artifactKind: fixture.mediaType === "application/pdf" ? "document" : "image",
        content: stream([fixture.bytes]),
        declaredMediaType: fixture.mediaType,
      });
      const consumed = await consume(upload);
      expect(consumed.result.byteSize).toBe(fixture.bytes.length);
      expect(consumed.result.mediaType).toBe(fixture.mediaType);
      expect(consumed.result.sha256Digest).toMatch(/^[0-9a-f]{64}$/);
      expect(Buffer.concat(consumed.chunks)).toEqual(fixture.bytes);
    });
  }

  it.each([
    ["SVG", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"), "image/svg+xml"],
    ["HTML", Buffer.from("<!doctype html><script>alert(1)</script>"), "text/html"],
    ["GIF", Buffer.from("GIF89a"), "image/gif"],
    [
      "ZIP/DOCX",
      Buffer.from("504b0304", "hex"),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    ["executable", Buffer.from("4d5a9000", "hex"), "application/octet-stream"],
  ])("rejects %s without accepting a stream", async (_label, bytes, mediaType) => {
    expect(() =>
      validateArtifactUpload({
        artifactKind: "document",
        content: stream([bytes]),
        declaredMediaType: mediaType,
      }),
    ).toThrow(ArtifactUploadValidationError);
  });

  it("rejects empty, oversized, spoofed, truncated JPEG, and wrong-kind content", async () => {
    const cases = [
      validateArtifactUpload({
        artifactKind: "image",
        content: stream([]),
        declaredMediaType: "image/png",
      }),
      validateArtifactUpload({
        artifactKind: "image",
        content: stream([Buffer.from("89504e470d0a1a0a00000000", "hex")]),
        declaredMediaType: "image/jpeg",
      }),
      validateArtifactUpload({
        artifactKind: "image",
        content: stream([Buffer.from("ffd8ffe00010", "hex")]),
        declaredMediaType: "image/jpeg",
      }),
      validateArtifactUpload({
        artifactKind: "map",
        content: stream([Buffer.from("%PDF-1.7\n%%EOF\n")]),
        declaredMediaType: "application/pdf",
      }),
      validateArtifactUpload({
        artifactKind: "image",
        content: stream([Buffer.alloc(17)]),
        declaredMediaType: "image/png",
        maxBytes: 16,
      }),
    ];
    for (const testCase of cases) {
      const settled = await Promise.allSettled([consume(testCase), testCase.result]);
      expect(settled.some((entry) => entry.status === "rejected")).toBe(true);
    }
  });

  it("rejects the first streamed byte over the exact 25 MiB limit", async () => {
    const header = Buffer.from("89504e470d0a1a0a", "hex");
    const oversized = (async function* () {
      yield header;
      let remaining = MAX_ARTIFACT_BYTES + 1 - header.length;
      while (remaining > 0) {
        const size = Math.min(1024 * 1024, remaining);
        yield Buffer.alloc(size);
        remaining -= size;
      }
    })();
    const upload = validateArtifactUpload({
      artifactKind: "image",
      content: oversized,
      declaredMediaType: "image/png",
    });
    const [consumption, result] = await Promise.allSettled([consume(upload), upload.result]);
    expect(consumption).toMatchObject({
      reason: expect.objectContaining({
        message: expect.stringContaining("exceeds the 25 MiB limit"),
      }),
      status: "rejected",
    });
    expect(result).toMatchObject({
      reason: expect.objectContaining({
        message: expect.stringContaining("exceeds the 25 MiB limit"),
      }),
      status: "rejected",
    });
  });

  it("sanitizes hostile filenames without using path components or control characters", () => {
    expect(sanitizeArtifactFilename("../../secret\r\nX-Evil: yes.png")).toBe(
      "secretX-Evil_ yes.png",
    );
    expect(sanitizeArtifactFilename("..\\..\\map.webp")).toBe("map.webp");
  });
});
