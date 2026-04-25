"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useHasAnyRole } from "../../../src/lib/auth/SessionUserContext";
import {
  REMEMBERED_SELECTION_KEYS,
  useRememberedSelection,
} from "../../../src/lib/browser/rememberedSelection";

interface CharactersSubmenuItem {
  href: string;
  isActive: boolean;
  label: string;
}

function getCurrentCharacterId(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "characters") {
    return null;
  }

  return segments[1] ?? null;
}

function isCharacterSheetPath(pathname: string, characterId: string): boolean {
  return pathname === `/characters/${characterId}` || pathname === `/characters/${characterId}/sheet`;
}

export function buildCharactersSubmenuItems(options: {
  currentCharacterId: string | null;
  isGameMaster: boolean;
  pathname: string;
  rememberedCharacterId?: string | null;
}): CharactersSubmenuItem[] {
  const effectiveCharacterId = options.currentCharacterId ?? options.rememberedCharacterId ?? null;
  const { isGameMaster, pathname } = options;
  const items: Array<CharactersSubmenuItem | null> = [
    {
      href: "/characters",
      isActive: pathname === "/characters",
      label: "Characters"
    },
    effectiveCharacterId
      ? {
          href: `/characters/${effectiveCharacterId}`,
          isActive: isCharacterSheetPath(pathname, effectiveCharacterId),
          label: "Character sheet"
        }
      : null,
    effectiveCharacterId
      ? {
          href: `/characters/${effectiveCharacterId}/equipment`,
          isActive: pathname === `/characters/${effectiveCharacterId}/equipment`,
          label: "Inventory by location"
        }
      : null,
    effectiveCharacterId
      ? {
          href: `/characters/${effectiveCharacterId}/weapons-shields-armor`,
          isActive: pathname === `/characters/${effectiveCharacterId}/weapons-shields-armor`,
          label: "Weapons/Shields/Armor"
        }
      : null,
    effectiveCharacterId
      ? {
          href: `/characters/${effectiveCharacterId}/loadout`,
          isActive: pathname === `/characters/${effectiveCharacterId}/loadout`,
          label: "Equip items"
        }
      : null,
    effectiveCharacterId
      ? {
          href: `/characters/${effectiveCharacterId}/advance`,
          isActive: pathname === `/characters/${effectiveCharacterId}/advance`,
          label: "Advance Character"
        }
      : null,
    effectiveCharacterId && isGameMaster
      ? {
          href: `/characters/${effectiveCharacterId}/edit`,
          isActive: pathname === `/characters/${effectiveCharacterId}/edit`,
          label: "Edit Character"
        }
      : null
  ];

  return items.filter((item): item is CharactersSubmenuItem => item !== null);
}

export default function CharactersSubmenu() {
  const pathname = usePathname();
  const currentCharacterId = getCurrentCharacterId(pathname);
  const isGameMaster = useHasAnyRole(["game_master"]);
  const rememberedCharacterSelection = useRememberedSelection(
    REMEMBERED_SELECTION_KEYS.characterId,
  );
  const items = buildCharactersSubmenuItems({
    currentCharacterId,
    isGameMaster,
    pathname,
    rememberedCharacterId: rememberedCharacterSelection.value,
  });

  return (
    <nav
      aria-label="Characters section"
      style={{
        borderBottom: "1px solid #d9ddd8",
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem 1rem",
        marginBottom: "1.5rem",
        paddingBottom: "0.75rem"
      }}
    >
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          style={{
            color: item.isActive ? "#2e2619" : undefined,
            fontWeight: item.isActive ? 700 : 400,
            textDecoration: item.isActive ? "underline" : undefined,
            textUnderlineOffset: item.isActive ? "0.2em" : undefined
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
