import Link from "next/link";

import { getRulesDocumentationPageModel } from "../../../../src/lib/rulesDocs";
import { AdminPageIntro, AdminPanel, AdminStatusBadge } from "../admin-ui";
import { MarkdownRenderer } from "./MarkdownRenderer";

export default async function RulesDocsAdminPage(props: {
  selectedDocumentId?: string;
}) {
  const { documents, selectedDocument } = await getRulesDocumentationPageModel({
    selectedDocumentId: props.selectedDocumentId
  });

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Rules & Documentation"
        title="Rules Documentation"
        summary="Repo-local rules and calculation references rendered from docs/rules. These notes are read-only and should change alongside app calculation changes."
      />

      <AdminPanel>
        <div style={{ color: "#5f543a", lineHeight: 1.6 }}>
          When app calculations or displayed derived values change, update the relevant rules documentation in the same change.
        </div>
      </AdminPanel>

      <div
        style={{
          alignItems: "start",
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "minmax(220px, 0.32fr) minmax(0, 1fr)"
        }}
      >
        <AdminPanel title="Documents" subtitle="Select a rules reference.">
          <nav style={{ display: "grid", gap: "0.55rem" }}>
            {documents.map((document) => {
              const selected = document.id === selectedDocument.id;

              return (
                <Link
                  href={`/admin/rules-docs?doc=${encodeURIComponent(document.id)}`}
                  key={document.id}
                  style={{
                    background: selected ? "rgba(126, 93, 42, 0.12)" : "rgba(255, 252, 245, 0.65)",
                    border: selected
                      ? "1px solid rgba(126, 93, 42, 0.28)"
                      : "1px solid rgba(85, 73, 48, 0.12)",
                    borderRadius: 14,
                    color: "#2c2418",
                    display: "grid",
                    gap: "0.25rem",
                    padding: "0.75rem",
                    textDecoration: "none"
                  }}
                >
                  <strong>{document.title}</strong>
                  <span style={{ color: "#6b6048", fontSize: "0.85rem" }}>{document.section}</span>
                </Link>
              );
            })}
          </nav>
        </AdminPanel>

        <AdminPanel>
          <article style={{ display: "grid", gap: "1rem" }}>
            <header style={{ display: "grid", gap: "0.6rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <AdminStatusBadge tone="neutral">{selectedDocument.section}</AdminStatusBadge>
                <AdminStatusBadge tone="neutral">{selectedDocument.audience}</AdminStatusBadge>
              </div>
              <h2
                style={{
                  color: "#2c2418",
                  fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
                  fontSize: "clamp(1.7rem, 3vw, 2.4rem)",
                  lineHeight: 1.1,
                  margin: 0
                }}
              >
                {selectedDocument.title}
              </h2>
              <p style={{ color: "#5f543a", lineHeight: 1.6, margin: 0 }}>
                {selectedDocument.description}
              </p>
            </header>

            <MarkdownRenderer markdown={selectedDocument.markdown} />
          </article>
        </AdminPanel>
      </div>
    </section>
  );
}
