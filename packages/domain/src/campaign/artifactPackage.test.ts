import { describe, expect, it } from "vitest";
import { artifactPackageSchema, validateArtifactSelection } from "./artifactPackage";
const input = () => ({
  schemaVersion: 1,
  packageId: "p",
  producer: "author",
  version: "1",
  title: "Handouts",
  resources: [{ id: "image", mediaType: "image/png", sha256: "a".repeat(64) }],
  objects: [
    {
      id: "a",
      type: "Artifact",
      metadata: { title: "A", artifactKind: "image" },
      resourceId: "image",
      dependencies: [{ kind: "local", id: "b" }],
    },
    {
      id: "b",
      optional: true,
      type: "Artifact",
      metadata: { title: "B", artifactKind: "image" },
      resourceId: "image",
    },
  ],
});
describe("Artifact-only package contract", () => {
  it("resolves identity and closure independently of order, never by title or bytes", () => {
    const manifest = artifactPackageSchema.parse(input());
    expect(validateArtifactSelection(manifest, ["b", "a"]).size).toBe(0);
    expect(validateArtifactSelection(manifest, ["a"]).get("a")).toContain(
      "A required dependency is missing from the selection.",
    );
    expect(validateArtifactSelection(manifest, ["b"]).has("a")).toBe(true);
  });
  it("allows an optional unsupported type only outside the selected closure", () => {
    const data = input();
    data.objects[1]!.type = "Map";
    data.objects[0]!.dependencies = [];
    const manifest = artifactPackageSchema.parse(data);
    expect(validateArtifactSelection(manifest, ["a"]).size).toBe(0);
    expect(validateArtifactSelection(manifest, ["a", "b"]).has("b")).toBe(true);
  });
  it("rejects executable fields, unsupported references, versions, duplicate identities and paths", () => {
    for (const extra of [
      { commands: ["equip"] },
      { schemaVersion: 2 },
      { resources: [{ id: "../escape", mediaType: "image/png", sha256: "a".repeat(64) }] },
    ])
      expect(artifactPackageSchema.safeParse({ ...input(), ...extra }).success).toBe(false);
    const data = input();
    data.objects.push(data.objects[0]!);
    expect(artifactPackageSchema.safeParse(data).success).toBe(false);
  });
  it("rejects reserved identity keys and excess reference depth", () => {
    const invalid = input();
    invalid.objects[0]!.id = "__proto__";
    expect(artifactPackageSchema.safeParse(invalid).success).toBe(false);
    const manifest = artifactPackageSchema.parse(input());
    manifest.objects = Array.from({ length: 33 }, (_, i) => ({
      ...manifest.objects[0]!,
      id: `n${i}`,
      dependencies: i < 32 ? [{ kind: "local" as const, id: `n${i + 1}` }] : [],
    }));
    expect(
      validateArtifactSelection(
        manifest,
        manifest.objects.map((x) => x.id),
      ).get("n0"),
    ).toContain("Dependency graph is too deep.");
  });
  it("rejects dependency cycles and excessive graph depth", () => {
    const manifest = artifactPackageSchema.parse(input());
    manifest.objects[1]!.dependencies = [{ kind: "local", id: "a" }];
    expect(validateArtifactSelection(manifest, ["a", "b"]).get("a")).toContain(
      "Dependency cycles are not supported.",
    );
  });
});
