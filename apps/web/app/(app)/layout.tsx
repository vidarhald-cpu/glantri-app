import type { ReactNode } from "react";
type AppLayoutProps = { children: ReactNode };

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <main style={{ padding: "2rem 1.5rem" }}>{children}</main>
  );
}
