import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@glantri/auth";
import type { CharacterBuild } from "@glantri/domain";

import { localDb, type LocalCharacterRecord } from "@/lib/offline/glantriDexie";
import { CharacterRecoveryRepository } from "@/lib/offline/repositories/characterRecoveryRepository";

const mocks = vi.hoisted(() => ({
  getCurrentCharacterFromMutationConflict: vi.fn(),
  loadContext: vi.fn(),
  updateServerCharacter: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/auth/SessionUserContext", () => ({
  useSessionUser: () => ({
    currentUser: account,
    loading: false,
  }),
}));

vi.mock("@/lib/api/localServiceClient", () => ({
  getCurrentCharacterFromMutationConflict: mocks.getCurrentCharacterFromMutationConflict,
  updateServerCharacter: mocks.updateServerCharacter,
}));

vi.mock("@/lib/characters/loadLocalCharacterContext", () => ({
  loadLocalCharacterContext: mocks.loadContext,
}));

vi.mock("@/lib/characters/characterSheet", () => ({
  buildCharacterSheetProfileStatRows: () => [],
  buildCharacterSheetSkillRows: () => [],
  buildCharacterSheetSpecializationRows: () => [],
  characterSheetSkillsTableColumns: [],
  characterSheetSpecializationsTableColumns: [],
  characterSheetStatsTableColumns: [],
}));

vi.mock("@glantri/rules-engine", () => ({
  buildCharacterSheetSummary: () => ({
    distractionLevel: 3,
    draftView: {
      education: { theoreticalSkillCount: 0 },
      groups: [],
      primaryPoolAvailable: 0,
      secondaryPoolAvailable: 0,
    },
    professionName: undefined,
    skillPoints: {
      current: 0,
      original: 0,
      successfulProgressionGains: 0,
    },
    societyLabel: undefined,
  }),
}));

import CharacterDetail from "./CharacterDetail";

const account: AuthUser = {
  email: "player-a@example.com",
  id: "account-a",
  roles: ["player"],
};

function createBuild(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    equipment: { items: [] },
    id: "character-a",
    inventoryNotes: "Canonical notes",
    name: "Canonical name",
    profile: {
      distractionLevel: 3,
      id: "profile-a",
      label: "Profile",
      rolledStats: {
        cha: 10,
        com: 10,
        con: 10,
        dex: 10,
        health: 10,
        int: 10,
        lck: 10,
        pow: 10,
        siz: 10,
        str: 10,
        will: 10,
      },
      societyLevel: 0,
    },
    progression: {
      chargenMode: "standard",
      educationPoints: 0,
      flexiblePointFactor: 1,
      level: 1,
      primaryPoolSpent: 0,
      primaryPoolTotal: 60,
      secondaryPoolSpent: 0,
      secondaryPoolTotal: 0,
      skillGroups: [],
      skills: [],
      specializations: [],
    },
    progressionState: {
      availablePoints: 0,
      checks: [],
      history: [],
      pendingAttempts: [],
    },
    ...overrides,
  };
}

function createRecord(build: CharacterBuild): LocalCharacterRecord {
  return {
    build,
    createdAt: "2026-08-21T09:00:00.000Z",
    finalizedAt: "2026-08-21T09:00:00.000Z",
    id: build.id,
    serverUpdatedAt: "revision-1",
    syncStatus: "synced",
    updatedAt: "revision-1",
  };
}

describe("CharacterDetail competing recovery presentation", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await localDb.characterRecoveries.clear();
    const canonical = createBuild();
    mocks.loadContext.mockResolvedValue({
      canonicalMissing: false,
      conflictPaths: [],
      content: {
        professionFamilies: [],
        professions: [],
        skillGroups: [],
      },
      hasRevisionConflict: false,
      record: createRecord(canonical),
      recoveredBuild: undefined,
      recoveryRecord: undefined,
    });
  });

  it("keeps a CAS-rejected stale-tab edit visible without mutating the winner or calling the server", async () => {
    const user = userEvent.setup();
    const repository = new CharacterRecoveryRepository();
    const canonical = createBuild();
    const view = render(<CharacterDetail id={canonical.id} />);
    const nameInput = await screen.findByDisplayValue("Canonical name");
    const winningAttempt = await repository.createAttempt({
      account,
      attemptedBuild: { ...canonical, inventoryNotes: "Tab A retained notes" },
      baseBuild: canonical,
      baseRevision: "revision-1",
      characterId: canonical.id,
      sourceAction: "Save notes in tab A",
      sourceSurface: "Character Sheet",
    });

    await user.clear(nameInput);
    await user.type(nameInput, "Tab B new name");
    await user.click(screen.getByRole("button", { name: "Save identity" }));

    expect(
      await screen.findByText(
        "Another recovery attempt for this Character won in another tab. Your changes were not sent to the server and are retained as a separate rejected candidate. Review the competing attempts before retrying.",
      ),
    ).toBeVisible();
    expect(nameInput).toHaveValue("Tab B new name");
    expect(
      screen.getByText(
        "Another tab's primary recovery is listed below. Your newer edits remain in this form and are also retained as a separate rejected candidate.",
      ),
    ).toBeVisible();
    expect(screen.getByText("Changed: Inventory notes")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save identity" })).toBeDisabled();
    expect(mocks.updateServerCharacter).not.toHaveBeenCalled();
    const retained = await waitFor(async () => {
      const recovery = await repository.get(account.id, canonical.id);
      expect(recovery?.saveAttempt.id).toBe(winningAttempt?.saveAttempt.id);
      expect(recovery?.competingCandidates).toHaveLength(1);
      return recovery;
    });

    view.unmount();
    mocks.loadContext.mockResolvedValue({
      canonicalMissing: false,
      conflictPaths: [],
      content: {
        professionFamilies: [],
        professions: [],
        skillGroups: [],
      },
      hasRevisionConflict: false,
      record: createRecord(canonical),
      recoveredBuild: undefined,
      recoveryRecord: retained,
    });
    render(<CharacterDetail id={canonical.id} />);

    expect(await screen.findByDisplayValue("Canonical name")).toBeVisible();
    expect(screen.getByText("Competing rejected save — Character name")).toBeVisible();
    expect(screen.getByText(/Save identity details/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Review rejected candidate" }));
    expect(screen.getByDisplayValue("Tab B new name")).toBeVisible();
    expect(
      screen.getByText(
        "The rejected candidate is shown separately for review. It has not been merged or sent to the server.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Save identity" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Return to current Character" }));
    await user.click(screen.getByRole("button", { name: "Review unsaved changes" }));
    expect(screen.getByRole("button", { name: "Save identity" })).toBeDisabled();
    expect(mocks.updateServerCharacter).not.toHaveBeenCalled();
  });
});
