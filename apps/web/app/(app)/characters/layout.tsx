import type { ReactNode } from "react";

import { RequireAuthenticatedUser } from "../../../src/lib/auth/RouteAccessGate";
import CharactersSubmenu from "./CharactersSubmenu";

interface CharactersLayoutProps {
  children: ReactNode;
}

export default function CharactersLayout({ children }: CharactersLayoutProps) {
  return (
    <RequireAuthenticatedUser
      message="You need to sign in before you can open character pages."
      title="Characters require login"
    >
      <CharactersSubmenu />
      {children}
    </RequireAuthenticatedUser>
  );
}
