import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/styles/glantri-baseline.css";
import { SessionUserProvider } from "@/lib/auth/SessionUserContext";
import { AppHeader } from "@/lib/layout/AppHeader";

export const metadata: Metadata = {
  title: "Glantri",
  description: "Web-first RPG app scaffold with offline-first architecture",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" style={{ colorScheme: "light" }}>
      <body
        style={{
          background: "var(--glantri-surface-muted)",
          margin: 0,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <SessionUserProvider>
          <AppHeader />
          {children}
        </SessionUserProvider>
      </body>
    </html>
  );
}
