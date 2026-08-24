import { createHash } from "node:crypto";
import path from "node:path";

import {
  artifactMediaTypeSchema,
  type ArtifactKind,
  type ArtifactMediaType,
} from "@glantri/domain";

export const MAX_ARTIFACT_BYTES = 25 * 1024 * 1024;

export class ArtifactUploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactUploadValidationError";
  }
}

export function sanitizeArtifactFilename(filename: string | undefined): string | undefined {
  if (!filename) return undefined;

  const normalized = filename.replaceAll("\\", "/");
  const basename = path.posix.basename(normalized);
  const printable = [...basename.normalize("NFKC")]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 31 && codePoint !== 127;
    })
    .join("");
  const safe = printable
    .replace(/[^\p{L}\p{N}._() -]/gu, "_")
    .trim()
    .slice(0, 120);

  return safe || undefined;
}

function detectMediaType(
  prefix: Uint8Array,
  tail: Uint8Array,
  byteSize: number,
): ArtifactMediaType {
  const bytes = Buffer.from(prefix);

  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    return "image/png";
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    tail.length >= 2 &&
    tail[tail.length - 2] === 0xff &&
    tail[tail.length - 1] === 0xd9
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP" &&
    bytes.readUInt32LE(4) + 8 === byteSize
  ) {
    return "image/webp";
  }

  if (
    bytes.length >= 5 &&
    Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-" &&
    /%%EOF\s*$/.test(Buffer.from(tail).toString("latin1"))
  ) {
    return "application/pdf";
  }

  throw new ArtifactUploadValidationError("The uploaded file is not a supported safe format.");
}

function validateKindAndMediaType(kind: ArtifactKind, mediaType: ArtifactMediaType): void {
  const isImage = mediaType.startsWith("image/");

  if (["map", "image", "portrait"].includes(kind) && !isImage) {
    throw new ArtifactUploadValidationError(
      "This Artifact kind requires a PNG, JPEG, or WebP image.",
    );
  }
}

export function validateArtifactUpload(input: {
  artifactKind: ArtifactKind;
  content: AsyncIterable<Uint8Array>;
  declaredMediaType: string;
  maxBytes?: number;
}): {
  content: AsyncIterable<Uint8Array>;
  result: Promise<{ byteSize: number; mediaType: ArtifactMediaType; sha256Digest: string }>;
} {
  const declaredMediaType = artifactMediaTypeSchema.safeParse(
    input.declaredMediaType.toLowerCase().split(";", 1)[0]?.trim(),
  );

  if (!declaredMediaType.success) {
    throw new ArtifactUploadValidationError("Only PNG, JPEG, WebP, and PDF files are supported.");
  }

  let resolveResult!: (value: {
    byteSize: number;
    mediaType: ArtifactMediaType;
    sha256Digest: string;
  }) => void;
  let rejectResult!: (reason: unknown) => void;
  const result = new Promise<{
    byteSize: number;
    mediaType: ArtifactMediaType;
    sha256Digest: string;
  }>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  const content = (async function* () {
    const digest = createHash("sha256");
    const prefixChunks: Buffer[] = [];
    let prefixLength = 0;
    let tail = Buffer.alloc(0);
    let byteSize = 0;

    try {
      for await (const rawChunk of input.content) {
        const chunk = Buffer.from(rawChunk);
        byteSize += chunk.byteLength;

        if (byteSize > (input.maxBytes ?? MAX_ARTIFACT_BYTES)) {
          throw new ArtifactUploadValidationError("The uploaded file exceeds the 25 MiB limit.");
        }

        digest.update(chunk);
        if (prefixLength < 16) {
          const needed = 16 - prefixLength;
          const addition = chunk.subarray(0, needed);
          prefixChunks.push(addition);
          prefixLength += addition.length;
        }
        tail = Buffer.concat([tail, chunk]).subarray(-1024);
        yield chunk;
      }

      if (byteSize === 0) {
        throw new ArtifactUploadValidationError("The uploaded file is empty.");
      }

      const mediaType = detectMediaType(Buffer.concat(prefixChunks), tail, byteSize);
      if (mediaType !== declaredMediaType.data) {
        throw new ArtifactUploadValidationError(
          "The file content does not match its declared type.",
        );
      }
      validateKindAndMediaType(input.artifactKind, mediaType);
      resolveResult({ byteSize, mediaType, sha256Digest: digest.digest("hex") });
    } catch (error) {
      rejectResult(error);
      throw error;
    }
  })();

  return { content, result };
}
