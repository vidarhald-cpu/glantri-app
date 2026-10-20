import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  defaultCanonicalContent,
  validateCanonicalContent,
  type CanonicalContent,
} from "@glantri/content";
import { DEFAULT_CHARGEN_RULE_SET } from "@glantri/domain";

import { localDb } from "@/lib/offline/glantriDexie";

import {
  CHARGEN_CONTENT_CACHE_KEY,
  CHARGEN_STALE_CONTENT_DIAGNOSTIC_KEY,
  evaluateCachedChargenContent,
  evaluateChargenContent,
} from "./chargenContentAvailability";
import {
  buildTargetRuntimeContent,
  createTargetCompetencyChargenSource,
  getTargetCompetencyActivationBlockers,
} from "./targetCompetencyContent";

/**
 * Forgejo #716. Chargen's content cache is keyed by browser origin, so a snapshot written by a
 * build that predates the 2026-09-27 Fencing/Longbow reclassification (#389) outlives the catalogue
 * it was written against. In that snapshot `fencing` exists only as a Specialization, so
 * `resolveLinkedStats` finds no base-Skill counterpart, the Target projection reports it as an
 * unresolved linked-stat blocker, and `buildTargetRuntimeContent` throws — previously inside a
 * `useMemo`, which crashed the whole Chargen tree and, because the throw escaped hydration before
 * the refresh write, left the profile permanently wedged across reloads.
 *
 * These cases assert the measured mechanism, not that a route renders. A test that renders a clean
 * profile passes against the unrepaired build and proves nothing.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/api/localServiceClient", () => ({
  getCurrentSessionUser: vi.fn().mockResolvedValue({
    email: "lane716@example.test",
    id: "lane716-player",
    roles: ["player"],
  }),
  loadActiveChargenRuleSet: vi.fn().mockResolvedValue(DEFAULT_CHARGEN_RULE_SET),
  saveCharacterToServer: vi.fn(),
}));

const loadCanonicalContentFromServer = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/contentClient", () => ({ loadCanonicalContentFromServer }));

/**
 * The pre-#389 catalogue shape, derived from the current seed by removing the `fencing` base Skill
 * and every reference to it. This is the authorized "equivalent" of the Product Owner's record: the
 * genuine historical `canonicalContent.json` at `157ba885` produces the identical blocker list and
 * the identical thrown message, which the characterization reproduced in the production container.
 */
function buildPreReclassificationSnapshot(): CanonicalContent {
  const stripFencing = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value
        .filter(
          (item) =>
            item !== "fencing" &&
            !(
              item !== null &&
              typeof item === "object" &&
              (item as Record<string, unknown>).skillId === "fencing"
            ),
        )
        .map(stripFencing);
    }

    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
          key,
          stripFencing(entry),
        ]),
      );
    }

    return value;
  };

  const snapshot = JSON.parse(JSON.stringify(defaultCanonicalContent)) as CanonicalContent;
  const withoutFencingSkill = {
    ...snapshot,
    professionSkills: snapshot.professionSkills.filter(
      (entry) => JSON.stringify(entry).indexOf("fencing") === -1,
    ),
    skills: snapshot.skills.filter((skill) => skill.id !== "fencing"),
    societyBandSkillAccess: snapshot.societyBandSkillAccess.filter(
      (entry) => JSON.stringify(entry).indexOf("fencing") === -1,
    ),
    specializations: snapshot.specializations.filter((entry) => entry.skillId !== "fencing"),
  };

  return validateCanonicalContent(stripFencing(withoutFencingSkill));
}

async function importWizard() {
  const module = await import("./ChargenWizardExperience");
  return module.default;
}

async function seedCachedSnapshot(value: unknown, version = "v1"): Promise<void> {
  await localDb.cachedContent.put({
    key: CHARGEN_CONTENT_CACHE_KEY,
    updatedAt: "2026-09-20T10:00:00.000Z",
    value: value as CanonicalContent,
    version,
  });
}

let staleSnapshot: CanonicalContent;

describe("Chargen persisted content-cache validation (#716)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    staleSnapshot = buildPreReclassificationSnapshot();
    await localDb.cachedContent.clear();
    await localDb.chargenSessions.clear();
    loadCanonicalContentFromServer.mockResolvedValue(defaultCanonicalContent);
  });

  afterEach(async () => {
    cleanup();
    await localDb.cachedContent.clear();
    await localDb.chargenSessions.clear();
  });

  it("the captured stale snapshot still reproduces the pre-repair failure at its source", () => {
    const source = createTargetCompetencyChargenSource(staleSnapshot);

    expect(getTargetCompetencyActivationBlockers(source)).toEqual(["fencing"]);
    expect(() => buildTargetRuntimeContent(source)).toThrow(
      "Target linked stats await approval: fencing.",
    );
  });

  it("rejects the stale snapshot before runtime content is constructed", () => {
    const evaluation = evaluateChargenContent(staleSnapshot);

    expect(evaluation.status).toBe("unusable");
    expect(evaluation.status === "unusable" && evaluation.diagnostics).toMatchObject({
      blockers: ["fencing"],
      reason: "activation-blockers",
    });
  });

  it("reports a schema-invalid persisted record instead of throwing out of hydration", () => {
    const evaluation = evaluateCachedChargenContent({
      key: CHARGEN_CONTENT_CACHE_KEY,
      updatedAt: "2026-09-20T10:00:00.000Z",
      value: { skills: "not-a-catalogue" } as unknown as CanonicalContent,
      version: "v1",
    });

    expect(evaluation?.status).toBe("unusable");
    expect(evaluation?.status === "unusable" && evaluation.diagnostics.reason).toBe(
      "schema-invalid",
    );
  });

  it("accepts the current catalogue unchanged", () => {
    expect(evaluateChargenContent(defaultCanonicalContent).status).toBe("usable");
  });

  it("a wedged profile renders without a client exception and the stale record is replaced", async () => {
    await seedCachedSnapshot(staleSnapshot);
    const ChargenWizard = await importWizard();

    render(<ChargenWizard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Roll all dice" })).toBeInTheDocument();
    });

    await waitFor(async () => {
      const record = await localDb.cachedContent.get(CHARGEN_CONTENT_CACHE_KEY);
      expect(record?.value.skills.some((skill) => skill.id === "fencing")).toBe(true);
    });

    const retained = await localDb.cachedContent.get(CHARGEN_STALE_CONTENT_DIAGNOSTIC_KEY);
    expect(retained?.value.skills.some((skill) => skill.id === "fencing")).toBe(false);
    expect(retained?.version).toContain("rejected:activation-blockers");
  }, 20_000);

  it("renders the unavailable state when the current authoritative content is itself blocked", async () => {
    await seedCachedSnapshot(staleSnapshot);
    loadCanonicalContentFromServer.mockResolvedValue(staleSnapshot);
    const ChargenWizard = await importWizard();

    render(<ChargenWizard />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chargen is unavailable" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Roll all dice" })).not.toBeInTheDocument();
    // Player-facing copy carries no competency identifiers or implementation terminology.
    expect(document.body.textContent).not.toContain("fencing");
    expect(document.body.textContent).not.toContain("linked stats");
    // A blocked authoritative catalogue is never replaced by a substitute catalogue.
    const record = await localDb.cachedContent.get(CHARGEN_CONTENT_CACHE_KEY);
    expect(record).toBeUndefined();
  }, 20_000);

  it("a profile with no cached snapshot behaves exactly as before", async () => {
    const ChargenWizard = await importWizard();

    render(<ChargenWizard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Roll all dice" })).toBeInTheDocument();
    });

    await waitFor(async () => {
      const record = await localDb.cachedContent.get(CHARGEN_CONTENT_CACHE_KEY);
      expect(record?.value.skills.some((skill) => skill.id === "fencing")).toBe(true);
    });

    expect(await localDb.cachedContent.get(CHARGEN_STALE_CONTENT_DIAGNOSTIC_KEY)).toBeUndefined();
  }, 20_000);
});
