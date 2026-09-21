import { type ArtifactKind, type ArtifactMediaType } from "@glantri/domain";

/**
 * The single place where Glantri derives technical facts about a chosen file.
 *
 * Every ordinary path — plain upload and AI-assisted intake alike — derives the
 * media type, byte size and SHA-256 here, so no GM and no AI ever supplies one
 * and there is only one derivation to be correct.
 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
export const MAX_FILES = 100;

export interface OrdinaryArtifactDraft {
  altText: string;
  artifactKind: ArtifactKind;
  description: string;
  file: File;
  id: string;
  mediaType: ArtifactMediaType;
  title: string;
}

export interface DerivedArtifactResource {
  id: string;
  mediaType: ArtifactMediaType;
  sha256: string;
}

export function mediaTypeFromFile(file: File): ArtifactMediaType | undefined {
  const declared = file.type.toLowerCase().split(";", 1)[0]?.trim();
  if (["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(declared ?? ""))
    return declared as ArtifactMediaType;
  const extension = file.name.toLowerCase().match(/\.([^.]+)$/)?.[1];
  if (extension === "png") return "image/png";
  if (["jpg", "jpeg"].includes(extension ?? "")) return "image/jpeg";
  if (extension === "webp") return "image/webp";
  if (extension === "pdf") return "application/pdf";
  return undefined;
}

export function titleFromFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  return withoutExtension.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "Untitled Artifact";
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} bytes`;
}

export async function digestFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Derives one declared package resource per draft and the matching upload
 * bodies, relabelling a file whose declared type disagrees with the derived one.
 */
export async function deriveArtifactPackageResources(drafts: OrdinaryArtifactDraft[]): Promise<{
  files: Record<string, File>;
  resources: DerivedArtifactResource[];
}> {
  const resources = await Promise.all(
    drafts.map(async (draft, index) => ({
      id: `resource-${index + 1}`,
      mediaType: draft.mediaType,
      sha256: await digestFile(draft.file),
    })),
  );
  return {
    resources,
    files: Object.fromEntries(
      drafts.map((draft, index) => {
        const resource = resources[index]!;
        const file =
          draft.file.type === resource.mediaType
            ? draft.file
            : new File([draft.file], draft.file.name, {
                lastModified: draft.file.lastModified,
                type: resource.mediaType,
              });
        return [resource.id, file];
      }),
    ),
  };
}
