import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const MAX_ZIP_COMMENT_LENGTH = 0xffff;

interface ZipEntryMetadata {
  compressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minimumOffset = Math.max(0, buffer.length - MAX_ZIP_COMMENT_LENGTH - 22);

  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }

  throw new Error("Could not find ZIP end of central directory record.");
}

function findZipEntry(buffer: Buffer, entryPath: string): ZipEntryMetadata {
  const endOfCentralDirectoryOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOfCentralDirectoryOffset + 10);
  let centralDirectoryOffset = buffer.readUInt32LE(endOfCentralDirectoryOffset + 16);
  const normalizedEntryPath = entryPath.replace(/\\/g, "/");

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(centralDirectoryOffset) !== CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE) {
      throw new Error("Invalid ZIP central directory file header.");
    }

    const compressionMethod = buffer.readUInt16LE(centralDirectoryOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralDirectoryOffset + 20);
    const fileNameLength = buffer.readUInt16LE(centralDirectoryOffset + 28);
    const extraFieldLength = buffer.readUInt16LE(centralDirectoryOffset + 30);
    const fileCommentLength = buffer.readUInt16LE(centralDirectoryOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(centralDirectoryOffset + 42);
    const fileNameStart = centralDirectoryOffset + 46;
    const fileName = buffer.toString("utf8", fileNameStart, fileNameStart + fileNameLength);

    if (fileName === normalizedEntryPath) {
      return {
        compressedSize,
        compressionMethod,
        localHeaderOffset,
      };
    }

    centralDirectoryOffset =
      fileNameStart + fileNameLength + extraFieldLength + fileCommentLength;
  }

  throw new Error(`Could not find ZIP entry '${entryPath}'.`);
}

export function readZipEntryUtf8(workbookPath: string, entryPath: string): string {
  const buffer = readFileSync(workbookPath);
  const entry = findZipEntry(buffer, entryPath);

  if (buffer.readUInt32LE(entry.localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error(`Invalid ZIP local file header for '${entryPath}'.`);
  }

  const fileNameLength = buffer.readUInt16LE(entry.localHeaderOffset + 26);
  const extraFieldLength = buffer.readUInt16LE(entry.localHeaderOffset + 28);
  const dataStart = entry.localHeaderOffset + 30 + fileNameLength + extraFieldLength;
  const compressedData = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return compressedData.toString("utf8");
  }

  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressedData).toString("utf8");
  }

  throw new Error(
    `Unsupported ZIP compression method ${entry.compressionMethod} for '${entryPath}'.`,
  );
}
