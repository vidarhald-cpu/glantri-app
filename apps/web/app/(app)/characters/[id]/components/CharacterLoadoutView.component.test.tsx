import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadCharacterContext: vi.fn(),
  loadEquipment: vi.fn(),
  setActiveAmmunition: vi.fn(),
}));

vi.mock("@/features/equipment/equipmentSelectors", () => ({
  getEquipmentTemplateById: (
    state: { templates: { templatesById: Record<string, unknown> } },
    id: string,
  ) => state.templates.templatesById[id],
}));

vi.mock("@/features/equipment/loadoutModule", () => ({
  buildEquipmentLoadoutModuleModel: () => ({ fields: [] }),
  EquipmentLoadoutModule: () => <div>Equipment choices</div>,
}));

vi.mock("@/features/equipment/loadoutWeaponOptions", () => ({
  isValidLoadoutThrowingWeaponItem: () => true,
}));

vi.mock("@/lib/api/localServiceClient", () => ({
  loadCharacterEquipmentState: mocks.loadEquipment,
  setCharacterActiveAmmunitionOnServer: mocks.setActiveAmmunition,
  setCharacterActiveMissileWeaponOnServer: vi.fn(),
  setCharacterActivePrimaryWeaponOnServer: vi.fn(),
  setCharacterActiveSecondaryWeaponOnServer: vi.fn(),
  setCharacterReadyShieldOnServer: vi.fn(),
  setCharacterWornArmorOnServer: vi.fn(),
}));

vi.mock("@/lib/characters/loadLocalCharacterContext", () => ({
  loadCurrentCharacterContext: mocks.loadCharacterContext,
  loadLocalCharacterContext: mocks.loadCharacterContext,
}));

import CharacterLoadoutView from "./CharacterLoadoutView";

const characterId = "character-1";
const bow = {
  category: "weapon",
  characterId,
  displayName: "Practice bow",
  id: "bow-1",
  templateId: "weapon-template-bow",
};
const arrows = {
  category: "gear",
  characterId,
  displayName: "Ash arrows",
  id: "arrows-1",
  templateId: "gear-template-arrows",
};
const bolts = {
  category: "gear",
  characterId,
  displayName: "Crossbow bolts",
  id: "bolts-1",
  templateId: "gear-template-crossbow-bolts",
};

function equipmentState(activeAmmoItemIds: string[]) {
  return {
    activeLoadoutByCharacterId: {
      [characterId]: {
        activeAmmoItemIds,
        activeMissileWeaponItemId: bow.id,
      },
    },
    itemsById: { [arrows.id]: arrows, [bolts.id]: bolts, [bow.id]: bow },
    locationsById: {},
    revision: activeAmmoItemIds.length,
    templates: {
      templatesById: {
        [arrows.templateId]: {
          ammunitionProfile: { family: "arrow" },
          category: "gear",
          id: arrows.templateId,
          name: "Arrows",
        },
        [bow.templateId]: {
          category: "weapon",
          id: bow.templateId,
          missileProfile: { ammoFamily: "arrow" },
          name: "Bow",
        },
        [bolts.templateId]: {
          ammunitionProfile: { family: "crossbow_bolt" },
          category: "gear",
          id: bolts.templateId,
          name: "Crossbow bolts",
        },
      },
    },
  };
}

describe("CharacterLoadoutView active ammunition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadCharacterContext.mockResolvedValue({ record: { build: { name: "Alaric" } } });
    mocks.loadEquipment.mockResolvedValue(equipmentState([]));
    mocks.setActiveAmmunition.mockResolvedValue(equipmentState([arrows.id]));
  });

  it("lets a player select compatible ammunition and shows the persisted selection after reload", async () => {
    const initial = render(<CharacterLoadoutView characterId={characterId} />);

    const ammunition = await screen.findByRole("checkbox", { name: "Ash arrows" });
    expect(ammunition).not.toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Crossbow bolts" })).not.toBeInTheDocument();
    fireEvent.click(ammunition);

    await waitFor(() =>
      expect(mocks.setActiveAmmunition).toHaveBeenCalledWith({
        characterId,
        expectedRevision: 0,
        itemIds: [arrows.id],
      }),
    );
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Ash arrows" })).toBeChecked());

    initial.unmount();
    mocks.loadEquipment.mockResolvedValue(equipmentState([arrows.id]));
    render(<CharacterLoadoutView characterId={characterId} />);

    expect(await screen.findByRole("checkbox", { name: "Ash arrows" })).toBeChecked();
  });
});
