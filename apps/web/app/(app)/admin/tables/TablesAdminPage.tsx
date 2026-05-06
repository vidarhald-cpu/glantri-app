"use client";

import { WORKBOOK_MOVEMENT_PERCENT_TABLE } from "@glantri/rules-engine";

import { AdminPageIntro, AdminPanel } from "../admin-ui";

const movementModifierColumns = Array.from({ length: 15 }, (_, index) => index + 1);

const percentExplanation =
  "The Percent table converts a modifier into a workbook percentage adjustment. It is used by workbook-faithful calculations such as movement loss from encumbrance, and by other percentage-based combat adjustments.";

export default function TablesAdminPage() {
  const baseMoveRows = Object.keys(WORKBOOK_MOVEMENT_PERCENT_TABLE)
    .map((value) => Number(value))
    .sort((left, right) => left - right);

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Tables"
        title="Tables"
        summary="Reference tables used by current workbook-faithful combat and movement calculations."
      />

      <AdminPanel title="Percent table" subtitle={percentExplanation}>
        <div
          style={{
            border: "1px solid rgba(85, 73, 48, 0.14)",
            borderRadius: 18,
            overflowX: "auto",
          }}
        >
          <table style={{ borderCollapse: "collapse", minWidth: 980, width: "100%" }}>
            <thead style={{ background: "rgba(255, 252, 245, 0.95)" }}>
              <tr>
                <th style={tableHeaderStyle}>Base move</th>
                {movementModifierColumns.map((modifier) => (
                  <th key={modifier} style={tableHeaderStyle}>
                    {modifier}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {baseMoveRows.map((baseMove) => (
                <tr key={baseMove}>
                  <td style={tableCellStyle}>{baseMove}</td>
                  {movementModifierColumns.map((modifier) => (
                    <td key={`${baseMove}:${modifier}`} style={tableCellStyle}>
                      {WORKBOOK_MOVEMENT_PERCENT_TABLE[baseMove]?.[modifier] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </section>
  );
}

const tableHeaderStyle = {
  borderBottom: "1px solid rgba(85, 73, 48, 0.14)",
  color: "#5f543a",
  fontSize: "0.8rem",
  fontWeight: 700,
  padding: "0.75rem",
  textAlign: "left" as const,
  whiteSpace: "nowrap" as const,
};

const tableCellStyle = {
  borderBottom: "1px solid rgba(85, 73, 48, 0.08)",
  color: "#2e2619",
  fontSize: "0.92rem",
  padding: "0.75rem",
  verticalAlign: "top" as const,
  whiteSpace: "nowrap" as const,
};
