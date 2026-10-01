// @vitest-environment happy-dom

import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { artifactPackageSchema, parseAiIntakeContext } from "@glantri/domain";

import { buildIntakeProposal, planIntake } from "../artifacts/intake/intakeProposal";

/**
 * The producer half of the prepared-Map path: an ordinary Glantri authoring
 * chat describes the prepared map, the GM supplies the file, and the complete
 * import package is produced in one step.
 *
 * This is the Captain Varro / Old Gatehouse regression case. The original
 * failure was an authoring/packaging worker that never held the image bytes and
 * therefore emitted SHA-256 placeholders, which forced a second technical
 * repair step before the package could be imported at all. Any path that asks a
 * human — or an assistant — for a digest is the defect.
 */

const preparedMapBytes = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const derivedDigest = createHash("sha256").update(preparedMapBytes).digest("hex");

function preparedMapFile(): File {
  return new File([preparedMapBytes], "old-gatehouse.png", { type: "image/png" });
}

/** Exactly the shape the documented instruction block asks an author for. */
const authoredContext = (entry: Record<string, unknown> = {}) =>
  JSON.stringify({
    entries: [
      {
        description: "The gatehouse and the road that approaches it.",
        filename: "old-gatehouse.png",
        gmNotes: "Captain Varro keeps the watch here.",
        kind: "map",
        playerDescription: "A hand-drawn plan of the Old Gatehouse and its approach.",
        relatedTo: "Captain Varro",
        represents: "artifact",
        title: "Old Gatehouse",
        ...entry,
      },
    ],
    format: "glantri-intake",
    version: 1,
  });

describe("prepared Map authoring package", () => {
  it("produces a complete importable package with no human-supplied digest", async () => {
    const planned = planIntake(authoredContext(), [preparedMapFile()]);
    expect(planned.ok, planned.ok ? "" : planned.problems.join("; ")).toBe(true);
    if (!planned.ok) return;

    const { files, manifest } = await buildIntakeProposal(planned.plan);

    // The manifest validates as-is: nothing downstream has to repair it, and
    // the digest is the real one derived from the bytes the browser holds.
    expect(() => artifactPackageSchema.parse(manifest)).not.toThrow();
    expect(manifest.resources).toEqual([
      { id: "resource-1", mediaType: "image/png", sha256: derivedDigest },
    ]);
    expect(JSON.stringify(manifest)).not.toMatch(/placeholder|todo|<sha256>|xxxx|0{64}|compute/i);

    // The package carries its own bytes, so the digest was derived where the
    // bytes exist rather than declared somewhere they do not.
    const packaged = files[manifest.resources[0]!.id];
    expect(packaged).toBeInstanceOf(File);
    expect(
      createHash("sha256")
        .update(Buffer.from(await packaged!.arrayBuffer()))
        .digest("hex"),
    ).toBe(derivedDigest);

    // The Artifact the package proposes is one a Map may use as a background:
    // an active image kind carrying player-facing alt text.
    expect(manifest.objects).toHaveLength(1);
    expect(manifest.objects[0]).toMatchObject({
      metadata: {
        altText: "A hand-drawn plan of the Old Gatehouse and its approach.",
        artifactKind: "map",
        title: "Old Gatehouse",
      },
      resourceId: "resource-1",
      type: "Artifact",
    });
  });

  it("refuses an authored context that supplies technical identity itself", () => {
    for (const supplied of [
      { sha256: derivedDigest },
      { checksum: "0".repeat(64) },
      { mediaType: "image/png" },
      { byteSize: preparedMapBytes.byteLength },
      { storageKey: "artifact-internal:old-gatehouse" },
    ]) {
      const parsed = parseAiIntakeContext(authoredContext(supplied));
      expect(parsed.ok, `${Object.keys(supplied)[0]} was accepted`).toBe(false);
    }
  });

  it("refuses a package whose digest does not match the bytes it ships", () => {
    for (const sha256 of ["<sha256>", "PLACEHOLDER", "", derivedDigest.toUpperCase()]) {
      expect(
        artifactPackageSchema.safeParse({
          objects: [
            {
              id: "gatehouse",
              metadata: { artifactKind: "map", title: "Old Gatehouse" },
              resourceId: "gatehouse-image",
              type: "Artifact",
            },
          ],
          packageId: "p",
          producer: "glantri-app/ai-intake",
          resources: [{ id: "gatehouse-image", mediaType: "image/png", sha256 }],
          schemaVersion: 1,
          title: "Old Gatehouse",
          version: "1",
        }).success,
        `${sha256 || "(empty)"} was accepted`,
      ).toBe(false);
    }
  });
});
