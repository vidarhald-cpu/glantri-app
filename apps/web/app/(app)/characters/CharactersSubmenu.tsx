"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useHasAnyRole } from "../../../src/lib/auth/SessionUserContext";

interface CharactersSubmenuItem {
  href?: string;
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

export default function CharactersSubmenu() {
  const pathname = usePathname();
  const characterId = getCurrentCharacterId(pathname);
  const isGameMaster = useHasAnyRole(["game_master"]);

  const items: CharactersSubmenuItem[] = [
    {
      href: "/characters",
      isActive: pathname === "/characters",
      label: "Characters"
    },
    {
      href: characterId ? `/characters/${characterId}` : undefined,
      isActive: characterId ? isCharacterSheetPath(pathname, characterId) : false,
      label: "Character sheet"
    },
    {
      href: characterId ? `/characters/${characterId}/equipment` : undefined,
      isActive: characterId ? pathname === `/characters/${characterId}/equipment` : false,
      label: "Inventory by location"
    },
    {
      href: characterId ? `/characters/${characterId}/weapons-shields-armor` : undefined,
      isActive: characterId
        ? pathname === `/characters/${characterId}/weapons-shields-armor`
        : false,
      label: "Weapons/Shields/Armor"
    },
    {
      href: characterId ? `/characters/${characterId}/loadout` : undefined,
      isActive: characterId ? pathname === `/characters/${characterId}/loadout` : false,
      label: "Equip items"
    },
    {
      href: characterId ? `/characters/${characterId}/advance` : undefined,
      isActive: characterId ? pathname === `/characters/${characterId}/advance` : false,
      label: "Advance Character"
    },
    {
      href: characterId && isGameMaster ? `/characters/${characterId}/edit` : undefined,
      isActive: characterId ? pathname === `/characters/${characterId}/edit` : false,
      label: "Edit Character"
    }
  ];

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
      {items.map((item) =>
        item.href ? (
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
        ) : (
          <span
            key={item.label}
            style={{
              color: "#7b766d"
            }}
          >
            {item.label}
          </span>
        )
      )}
    </nav>
  );
}
