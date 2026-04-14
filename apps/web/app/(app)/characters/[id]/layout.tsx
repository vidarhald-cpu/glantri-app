import type { ReactNode } from "react";

import { RequireOwnedLocalCharacter } from "../../../../src/lib/auth/LocalCharacterAccessGate";

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

  return <RequireOwnedLocalCharacter characterId={id}>{children}</RequireOwnedLocalCharacter>;
}
