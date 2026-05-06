import Link from "next/link";

import { appNavigationLinks } from "./appNavigation";

export function AppHeader() {
  return (
    <header
      style={{
        borderBottom: "1px solid #d9ddd8",
        padding: "1rem 1.5rem",
        position: "sticky",
        top: 0,
        background: "#f6f5ef",
        zIndex: 10
      }}
    >
      <nav style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <strong>Glantri</strong>
        {appNavigationLinks.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
