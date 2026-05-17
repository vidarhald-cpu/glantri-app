import Link from "next/link";

import styles from "./AppHeader.module.css";
import { appNavigationLinks } from "./appNavigation";

export function AppHeader() {
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
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
