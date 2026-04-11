import type { ReactNode } from "react";

import CharactersSubmenu from "./CharactersSubmenu";

interface CharactersLayoutProps {
  children: ReactNode;
}

export default function CharactersLayout({ children }: CharactersLayoutProps) {
  return (
    <>
      <CharactersSubmenu />
      {children}
    </>
  );
}
