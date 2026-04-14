"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useHasAnyRole } from "../../../src/lib/auth/SessionUserContext";

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
  characterId: string | null;
  isGameMaster: boolean;
  pathname: string;
}): CharactersSubmenuItem[] {
  const { characterId, isGameMaster, pathname } = options;
  const items: Array<CharactersSubmenuItem | null> = [
    {
      href: "/characters",
      isActive: pathname === "/characters",
      label: "Characters"
    },
    characterId
      ? {
          href: `/characters/${characterId}`,
          isActive: isCharacterSheetPath(pathname, characterId),
          label: "Character sheet"
        }
      : null,
    characterId
      ? {
          href: `/characters/${characterId}/equipment`,
          isActive: pathname === `/characters/${characterId}/equipment`,
          label: "Inventory by location"
        }
      : null,
    characterId
      ? {
          href: `/characters/${characterId}/weapons-shields-armor`,
          isActive: pathname === `/characters/${characterId}/weapons-shields-armor`,
          label: "Weapons/Shields/Armor"
        }
      : null,
    characterId
      ? {
          href: `/characters/${characterId}/loadout`,
          isActive: pathname === `/characters/${characterId}/loadout`,
          label: "Equip items"
        }
      : null,
    characterId
      ? {
          href: `/characters/${characterId}/advance`,
          isActive: pathname === `/characters/${characterId}/advance`,
          label: "Advance Character"
        }
      : null,
    characterId && isGameMaster
      ? {
          href: `/characters/${characterId}/edit`,
          isActive: pathname === `/characters/${characterId}/edit`,
          label: "Edit Character"
        }
      : null
  ];

  return items.filter((item): item is CharactersSubmenuItem => item !== null);
}

export default function CharactersSubmenu() {
  const pathname = usePathname();
  const characterId = getCurrentCharacterId(pathname);
  const isGameMaster = useHasAnyRole(["game_master"]);
  const items = buildCharactersSubmenuItems({ characterId, isGameMaster, pathname });

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
