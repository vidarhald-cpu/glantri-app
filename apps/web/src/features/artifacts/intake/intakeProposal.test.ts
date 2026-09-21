// @vitest-environment happy-dom
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { buildIntakeProposal, planIntake } from "./intakeProposal";

const bytes = Buffer.from("89504e470d0a1a0a00000000", "hex");
const expectedDigest = createHash("sha256").update(bytes).digest("hex");

function pngFile(name: string): File {
  return new File([bytes], name, { type: "image/png" });
}

const context = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    format: "glantri-intake",
    version: 1,
    entries: [
      {
        represents: "item",
        filename: "torn-map.png",
        title: "Torn Treasure Map",
        kind: "map",
        description: "A salt-stained sea chart.",
        gmNotes: "The harbourmaster holds the other half.",
        playerDescription: "A torn sea chart.",
        relatedTo: "Captain Varro",
      },
    ],
    ...overrides,
  });

describe("intake planning", () => {
  it("pairs a described entry with the chosen file", () => {
    const planned = planIntake(context(), [pngFile("torn-map.png")]);
    expect(planned.ok).toBe(true);
    if (planned.ok) expect(planned.plan.entries[0]!.file?.name).toBe("torn-map.png");
  });

  it("surfaces a named file that was not chosen instead of proceeding", () => {
    const planned = planIntake(context(), [pngFile("other.png")]);
    expect(planned.ok).toBe(false);
    if (!planned.ok)
      expect(planned.problems.join(" ")).toContain("which is not among the chosen files");
  });

  it("surfaces a chosen file that nothing describes", () => {
    const planned = planIntake(context(), [pngFile("torn-map.png"), pngFile("stray.png")]);
    expect(planned.ok).toBe(false);
    if (!planned.ok) expect(planned.problems.join(" ")).toContain("no entry describes it");
  });

  it("refuses a file type Glantri cannot accept", () => {
    const planned = planIntake(
      context({
        entries: [
          { represents: "artifact", filename: "notes.exe", title: "Notes", kind: "document" },
        ],
      }),
      [new File([bytes], "notes.exe", { type: "application/x-msdownload" })],
    );
    expect(planned.ok).toBe(false);
  });
});

describe("intake proposal", () => {
  it("proposes a canonical Item with the file as its attached representation", async () => {
    const planned = planIntake(context(), [pngFile("torn-map.png")]);
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const { manifest, files } = await buildIntakeProposal(planned.plan);

    expect(manifest.resources).toEqual([
      { id: "resource-1", mediaType: "image/png", sha256: expectedDigest },
    ]);
    expect(Object.keys(files)).toEqual(["resource-1"]);

    const artifact = manifest.objects.find((object) => object.type === "Artifact")!;
    expect(artifact.metadata).toMatchObject({
      altText: "A torn sea chart.",
      artifactKind: "map",
      title: "Torn Treasure Map",
    });
    // The human reference belongs to the Item, not to its picture.
    expect(artifact.relationshipLabel).toBeUndefined();

    const item = manifest.objects.find((object) => object.type === "Item")!;
    expect(item.itemMetadata).toEqual({
      description: "A salt-stained sea chart.",
      title: "Torn Treasure Map",
    });
    expect(item.attachments).toEqual([{ kind: "local", id: artifact.id }]);
    expect(item.relationshipLabel).toBe("Captain Varro");
    expect(item.gmNotes).toContain("The harbourmaster holds the other half.");
    expect(item.resourceId).toBeUndefined();
  });

  it("keeps intake scaffolding off the Item and leaves media suggestions with the Artifact", async () => {
    const planned = planIntake(
      context({
        notes: "From the session-three chat.",
        entries: [
          {
            represents: "item",
            filename: "torn-map.png",
            title: "Torn Treasure Map",
            kind: "map",
            description: "A salt-stained sea chart.",
            gmNotes: "The harbourmaster holds the other half.",
            suggestedVisibility: "campaign",
            tags: ["clue", "harbour"],
          },
        ],
      }),
      [pngFile("torn-map.png")],
    );
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const { manifest } = await buildIntakeProposal(planned.plan);

    const item = manifest.objects.find((object) => object.type === "Item")!;
    expect(item.gmNotes).toBe(
      "The harbourmaster holds the other half.\n\nFrom the session-three chat.",
    );
    expect(item.gmNotes).not.toContain("Suggested tags");
    expect(item.gmNotes).not.toContain("Suggested visibility");

    // The generic GM note is not duplicated onto the representation; only the
    // suggestions about filing and sharing the media stay an Artifact concern.
    const artifact = manifest.objects.find((object) => object.type === "Artifact")!;
    expect(artifact.gmNotes).toContain("Suggested tags: clue, harbour");
    expect(artifact.gmNotes).toContain("always created GM-private");
    expect(artifact.gmNotes).not.toContain("The harbourmaster holds the other half.");
  });

  it("proposes a pure Artifact with no Item and keeps its own relationship", async () => {
    const planned = planIntake(
      context({
        entries: [
          {
            represents: "artifact",
            filename: "varro.png",
            title: "Captain Varro",
            kind: "portrait",
            relatedTo: "Varro's Sabre",
          },
        ],
      }),
      [pngFile("varro.png")],
    );
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const { manifest } = await buildIntakeProposal(planned.plan);
    expect(manifest.objects).toHaveLength(1);
    expect(manifest.objects[0]!.type).toBe("Artifact");
    expect(manifest.objects[0]!.relationshipLabel).toBe("Varro's Sabre");
  });

  it("proposes an Item with no representation when no file was described", async () => {
    const planned = planIntake(
      context({ entries: [{ represents: "item", title: "Iron Key" }] }),
      [],
    );
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const { manifest } = await buildIntakeProposal(planned.plan);
    expect(manifest.resources).toEqual([]);
    expect(manifest.objects).toHaveLength(1);
    expect(manifest.objects[0]!.type).toBe("Item");
    expect(manifest.objects[0]!.attachments).toEqual([]);
  });
});
