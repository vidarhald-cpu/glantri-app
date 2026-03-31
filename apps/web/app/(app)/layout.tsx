import Link from "next/link";
import type { ReactNode } from "react";

type AppLayoutProps = {
  children: ReactNode;
};

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/chargen", label: "Chargen" },
  { href: "/characters", label: "Characters" },
  { href: "/encounters", label: "Encounters" },
  { href: "/admin", label: "Admin" },
  { href: "/auth", label: "Auth" }
] as const;

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div>
      <header
        style={{
          borderBottom: "1px solid #d9ddd8",
          padding: "1rem 1.5rem",
          position: "sticky",
          top: 0,
          background: "#f6f5ef"
        }}
      >
        <nav style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <strong>Glantri</strong>
          {navLinks.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main style={{ padding: "2rem 1.5rem" }}>{children}</main>
    </div>
  );
}
