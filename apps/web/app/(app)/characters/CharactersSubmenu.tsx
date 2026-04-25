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
  currentCharacterId: string | null;
  isGameMaster: boolean;
  pathname: string;
}): CharactersSubmenuItem[] {
  const { currentCharacterId, isGameMaster, pathname } = options;
  const items: Array<CharactersSubmenuItem | null> = [
    {
      href: "/characters",
      isActive: pathname === "/characters",
      label: "Characters"
    },
    currentCharacterId
      ? {
          href: `/characters/${currentCharacterId}`,
          isActive: isCharacterSheetPath(pathname, currentCharacterId),
          label: "Character sheet"
        }
      : null,
    currentCharacterId
      ? {
          href: `/characters/${currentCharacterId}/equipment`,
          isActive: pathname === `/characters/${currentCharacterId}/equipment`,
          label: "Inventory by location"
        }
      : null,
    currentCharacterId
      ? {
          href: `/characters/${currentCharacterId}/weapons-shields-armor`,
          isActive: pathname === `/characters/${currentCharacterId}/weapons-shields-armor`,
          label: "Weapons/Shields/Armor"
        }
      : null,
    currentCharacterId
      ? {
          href: `/characters/${currentCharacterId}/loadout`,
          isActive: pathname === `/characters/${currentCharacterId}/loadout`,
          label: "Equip items"
        }
      : null,
    currentCharacterId
      ? {
          href: `/characters/${currentCharacterId}/advance`,
          isActive: pathname === `/characters/${currentCharacterId}/advance`,
          label: "Advance Character"
        }
      : null,
    currentCharacterId && isGameMaster
      ? {
          href: `/characters/${currentCharacterId}/edit`,
          isActive: pathname === `/characters/${currentCharacterId}/edit`,
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
  const items = buildCharactersSubmenuItems({
    currentCharacterId,
    isGameMaster,
    pathname,
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
