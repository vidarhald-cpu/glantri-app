import type { ReactNode } from "react";

import { RequireOwnedLocalCharacter } from "@/lib/auth/LocalCharacterAccessGate";
import RememberedSelectionEffect from "@/lib/browser/RememberedSelectionEffect";
import { REMEMBERED_SELECTION_KEYS } from "@/lib/browser/rememberedSelection";

interface CharacterScopedLayoutProps {
  children: ReactNode;
  params: Promise<{
    id: string;
  }>;
}

export default async function CharacterScopedLayout({
  children,
  params,
}: CharacterScopedLayoutProps) {
  const { id } = await params;

  return (
    <RequireOwnedLocalCharacter characterId={id}>
      <RememberedSelectionEffect
        selectionKey={REMEMBERED_SELECTION_KEYS.characterId}
        value={id}
      />
      {children}
    </RequireOwnedLocalCharacter>
  );
}
