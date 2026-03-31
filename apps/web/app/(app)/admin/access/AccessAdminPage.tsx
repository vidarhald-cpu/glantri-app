"use client";

import { useEffect, useState } from "react";

import { useAdminContent } from "../../../../src/lib/admin/AdminContentContext";
import { downloadCsv } from "../../../../src/lib/admin/exporters";
import {
  buildProfessionAccessRows,
  buildSocietyAccessRows
} from "../../../../src/lib/admin/viewModels";
import {
  AdminButton,
  AdminDataTable,
  AdminPageIntro,
  AdminPanel,
  AdminTagList
} from "../admin-ui";

type AccessMode = "profession" | "society";

export default function AccessAdminPage() {
  const { content } = useAdminContent();
  const professionRows = buildProfessionAccessRows(content);
  const societyRows = buildSocietyAccessRows(content);
  const [mode, setMode] = useState<AccessMode>("profession");
  const [selectedId, setSelectedId] = useState<string>();
  const currentIds = mode === "profession" ? professionRows : societyRows;

  useEffect(() => {
    setSelectedId(currentIds[0]?.id);
  }, [currentIds, mode]);

  function exportCurrentView() {
    if (mode === "profession") {
      downloadCsv({
        columns: [
          { header: "Profession", value: (row) => row.name },
          { header: "Skill Groups", value: (row) => row.skillGroups.join(" | ") },
          { header: "Skills", value: (row) => row.skills.join(" | ") },
          { header: "Society-Class Access", value: (row) => row.societyEntries.join(" | ") }
        ],
        filename: "glantri-access-professions.csv",
        rows: professionRows
      });
      return;
    }

    downloadCsv({
      columns: [
        { header: "Society-Class Entry", value: (row) => row.societyEntry },
        { header: "Professions", value: (row) => row.professions.join(" | ") },
        { header: "Skill Groups", value: (row) => row.skillGroups.join(" | ") },
        { header: "Skills", value: (row) => row.skills.join(" | ") }
      ],
      filename: "glantri-access-societies.csv",
      rows: societyRows
    });
  }

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        actions={
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <AdminButton
              onClick={() => setMode("profession")}
              variant={mode === "profession" ? "primary" : "ghost"}
            >
              Profession View
            </AdminButton>
            <AdminButton
              onClick={() => setMode("society")}
              variant={mode === "society" ? "primary" : "ghost"}
            >
              Society-Class View
            </AdminButton>
            <AdminButton onClick={exportCurrentView} variant="secondary">
              Export CSV
            </AdminButton>
          </div>
        }
        eyebrow="Admin / Access"
        summary="This page is the read-optimized relationship lens: one view starts from professions and fans outward into grants and society access, while the other starts from society/social-class rows and shows what each band unlocks."
        title="Relationship Views"
      />

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1.7fr) minmax(320px, 1fr)" }}>
        <AdminPanel
          subtitle={
            mode === "profession"
              ? "Profession -> skill groups / skills / society-class access"
              : "Society-class -> professions / skills"
          }
          title={mode === "profession" ? "Profession Access Matrix" : "Society-Class Access Matrix"}
        >
          {mode === "profession" ? (
            <AdminDataTable
              columns={[
                    {
                      header: "Profession",
                      render: (row) => <strong>{row.name}</strong>
                    },
                    {
                      header: "Skill Groups",
                      render: (row) => <AdminTagList values={row.skillGroups} />
                    },
                    {
                      header: "Skills",
                      render: (row) => <AdminTagList values={row.skills} />
                    },
                    {
                      header: "Society-Class Access",
                      render: (row) => <AdminTagList values={row.societyEntries} />
                    }
                  ]}
              emptyState="No access rows found."
              onSelect={setSelectedId}
              rows={professionRows}
              selectedId={(professionRows.find((row) => row.id === selectedId) ?? professionRows[0])?.id}
            />
          ) : (
            <AdminDataTable
              columns={[
                    {
                      header: "Society-Class Entry",
                      render: (row) => <strong>{row.societyEntry}</strong>
                    },
                    {
                      header: "Professions",
                      render: (row) => <AdminTagList values={row.professions} />
                    },
                    {
                      header: "Skill Groups",
                      render: (row) => <AdminTagList values={row.skillGroups} />
                    },
                    {
                      header: "Skills",
                      render: (row) => <AdminTagList values={row.skills} />
                    }
                  ]}
              emptyState="No access rows found."
              onSelect={setSelectedId}
              rows={societyRows}
              selectedId={(societyRows.find((row) => row.id === selectedId) ?? societyRows[0])?.id}
            />
          )}
        </AdminPanel>

        <AdminPanel title={mode === "profession" ? "Selected Profession" : "Selected Society-Class Row"}>
          {mode === "profession" ? (
            (professionRows.find((row) => row.id === selectedId) ?? professionRows[0]) ? (
              <div style={{ display: "grid", gap: "1rem" }}>
                {(() => {
                  const selectedRow =
                    professionRows.find((row) => row.id === selectedId) ?? professionRows[0];

                  return (
                    <>
                      <div style={{ display: "grid", gap: "0.35rem" }}>
                        <strong style={{ color: "#2e2619", fontSize: "1.05rem" }}>
                          {selectedRow.name}
                        </strong>
                        <span style={{ color: "#5f543a" }}>
                          Use the professions page to edit grants and society reach.
                        </span>
                      </div>

                      <div style={{ display: "grid", gap: "0.75rem" }}>
                        <div style={{ display: "grid", gap: "0.35rem" }}>
                          <strong style={{ color: "#594320" }}>Allowed Skill Groups</strong>
                          <AdminTagList values={selectedRow.skillGroups} />
                        </div>

                        <div style={{ display: "grid", gap: "0.35rem" }}>
                          <strong style={{ color: "#594320" }}>Allowed Skills</strong>
                          <AdminTagList values={selectedRow.skills} />
                        </div>

                        <div style={{ display: "grid", gap: "0.35rem" }}>
                          <strong style={{ color: "#594320" }}>Society-Class Access</strong>
                          <AdminTagList values={selectedRow.societyEntries} />
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div>Select an access row to inspect its relationships.</div>
            )
          ) : (societyRows.find((row) => row.id === selectedId) ?? societyRows[0]) ? (
            <div style={{ display: "grid", gap: "1rem" }}>
              {(() => {
                const selectedRow = societyRows.find((row) => row.id === selectedId) ?? societyRows[0];

                return (
                  <>
                    <div style={{ display: "grid", gap: "0.35rem" }}>
                      <strong style={{ color: "#2e2619", fontSize: "1.05rem" }}>
                        {selectedRow.societyEntry}
                      </strong>
                      <span style={{ color: "#5f543a" }}>
                        Use the societies page to edit profession, group, and skill access.
                      </span>
                    </div>

                    <div style={{ display: "grid", gap: "0.75rem" }}>
                      <div style={{ display: "grid", gap: "0.35rem" }}>
                        <strong style={{ color: "#594320" }}>Allowed Professions</strong>
                        <AdminTagList values={selectedRow.professions} />
                      </div>

                      <div style={{ display: "grid", gap: "0.35rem" }}>
                        <strong style={{ color: "#594320" }}>Allowed Skills</strong>
                        <AdminTagList values={selectedRow.skills} />
                      </div>

                      <div style={{ display: "grid", gap: "0.35rem" }}>
                        <strong style={{ color: "#594320" }}>Allowed Skill Groups</strong>
                        <AdminTagList values={selectedRow.skillGroups} />
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div>Select an access row to inspect its relationships.</div>
          )}
        </AdminPanel>
      </div>
    </section>
  );
}
