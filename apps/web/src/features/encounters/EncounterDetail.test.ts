import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "EncounterDetail.tsx");

function readEncounterDetailSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("EncounterDetail table rendering", () => {
  it("saves local transitions against the loaded server revision", () => {
    const source = readEncounterDetailSource();
    const persist = source.slice(
      source.indexOf("async function persistEncounter("),
      source.indexOf("async function handleAssignRoleplayStatCheck("),
    );

    expect(persist).toContain("expectedRevision: encounter?.updatedAt");
    expect(persist).toContain("session: nextEncounter");
    expect(persist).toContain("localEncounterRepository.save(nextEncounter)");
  });

  it("routes roleplay encounters to the GM roleplaying screen", () => {
    const source = readEncounterDetailSource();

    expect(source).toContain("GmRoleplayingEncounterScreen");
    expect(source).toContain('encounter.kind === "roleplay"');
    expect(source).toContain("onPersist={persistEncounter}");
    expect(source).toContain('encounter?.kind !== "roleplay"');
    expect(source).toContain("startGuardedPolling");
    expect(source).toContain("loadEncounterById(id)");
  });

  it("uses stable unique ids for repeated GM encounter header labels", () => {
    const source = readEncounterDetailSource();

    expect(source).toContain('{ id: "selected-action", label: "Action" }');
    expect(source).toContain('{ id: "phase-one-action", label: "Action" }');
    expect(source).toContain('{ id: "phase-two-action", label: "Action" }');
    expect(source).toContain("key={column.id}");
    expect(source).not.toContain("key={label}");
  });

  it("routes terminal Encounters to history before any GM activity surface", () => {
    const source = readEncounterDetailSource();
    const historyIndex = source.indexOf("<CompletedEncounterHistory");
    const roleplayIndex = source.indexOf("<GmRoleplayingEncounterScreen");

    expect(source).toContain('encounter.status === "completed"');
    expect(source).toContain('encounter.status === "archived"');
    expect(historyIndex).toBeGreaterThan(-1);
    expect(roleplayIndex).toBeGreaterThan(historyIndex);
    expect(source.slice(historyIndex, roleplayIndex)).toContain('viewerMode="gm"');
  });
});
