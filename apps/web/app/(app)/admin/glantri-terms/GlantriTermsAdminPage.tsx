"use client";

import { glantriTerms } from "@glantri/domain";

import { AdminPageIntro, AdminPanel } from "../admin-ui";

export default function GlantriTermsAdminPage() {
  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Rules & Documentation"
        title="Glantri App Terms"
        summary="Canonical terminology for the Glantri app. This page reads from the shared domain terms file so UI labels and developer documentation stay anchored to one source."
      />

      <div style={{ display: "grid", gap: "1rem" }}>
        {glantriTerms.map((term) => (
          <AdminPanel key={term.id} title={term.name} subtitle={term.definition}>
            <div style={{ display: "grid", gap: "0.65rem" }}>
              <div style={{ color: "#776b52", fontSize: "0.82rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {term.id}
              </div>
              <div style={{ display: "grid", gap: "0.45rem" }}>
                <strong style={{ color: "#2c2418", fontSize: "0.95rem" }}>Where used</strong>
                <ul style={{ color: "#4f4635", lineHeight: 1.6, margin: 0, paddingLeft: "1.1rem" }}>
                  {term.whereUsed.map((usage) => (
                    <li key={usage}>{usage}</li>
                  ))}
                </ul>
              </div>
            </div>
          </AdminPanel>
        ))}
      </div>
    </section>
  );
}
