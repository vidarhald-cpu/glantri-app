import type { ReactNode } from "react";

import type { CombatStateDetailRow, CombatStatePanelModel } from "../combatStatePanel";

function SectionCard(input: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        background: "#fbfaf5",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.75rem",
        padding: "1rem"
      }}
    >
      <div style={{ display: "grid", gap: "0.2rem" }}>
        <h2 style={{ margin: 0 }}>{input.title}</h2>
        {input.description ? (
          <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>{input.description}</div>
        ) : null}
      </div>
      {input.children}
    </section>
  );
}

function StatGrid(input: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gap: "0.75rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
      }}
    >
      {input.children}
    </div>
  );
}

function DetailRow(input: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        alignItems: "start",
        display: "grid",
        gap: "0.35rem",
        gridTemplateColumns: "minmax(140px, 180px) 1fr"
      }}
    >
      <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>{input.label}</div>
      <div>{input.value}</div>
    </div>
  );
}

function BattleStatCard(input: {
  title: string;
  subtitle?: string;
  rows: CombatStateDetailRow[];
}) {
  return (
    <div
      style={{
        background: "#f6f5ef",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.5rem",
        padding: "1rem"
      }}
    >
      <div style={{ display: "grid", gap: "0.15rem" }}>
        <strong>{input.title}</strong>
        {input.subtitle ? (
          <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>{input.subtitle}</div>
        ) : null}
      </div>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        {input.rows.map((row) => (
          <DetailRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
    </div>
  );
}

function TableCard(input: {
  title: string;
  description?: string;
  columns: string[];
  nowrapColumnIndexes?: number[];
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <div
      style={{
        background: "#f6f5ef",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.75rem",
        padding: "1rem"
      }}
    >
      <div style={{ display: "grid", gap: "0.15rem" }}>
        <strong>{input.title}</strong>
        {input.description ? (
          <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>{input.description}</div>
        ) : null}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: "100%", width: "100%" }}>
          <thead>
            <tr>
              {input.columns.map((column) => (
                <th
                  key={column}
                  style={{
                    borderBottom: "1px solid #d9ddd8",
                    color: "#5e5a50",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    padding: "0.6rem",
                    textAlign: "left",
                    whiteSpace: "nowrap"
                  }}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {input.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${rowIndex}-${cellIndex}`}
                    style={{
                    borderBottom: rowIndex === input.rows.length - 1 ? "none" : "1px solid #e6e6df",
                      fontSize: "0.95rem",
                      padding: "0.6rem",
                      verticalAlign: "top",
                      whiteSpace: input.nowrapColumnIndexes?.includes(cellIndex) ? "nowrap" : "normal",
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CombatStatePanel(input: { model: CombatStatePanelModel }) {
  return (
    <SectionCard title={input.model.title} description={input.model.description}>
      <StatGrid>
        <BattleStatCard
          title="Combat stats and skills"
          rows={input.model.statsRows}
        />
        <BattleStatCard
          title="Defence and movement"
          rows={input.model.capabilityRows}
        />
        {input.model.armorRows ? (
          <BattleStatCard
            title="Armor"
            rows={input.model.armorRows}
          />
        ) : null}
      </StatGrid>

      {input.model.statsTable ? (
        <TableCard
          title={input.model.statsTable.title}
          description={input.model.statsTable.description}
          columns={input.model.statsTable.columns}
          rows={input.model.statsTable.rows}
        />
      ) : null}

      {input.model.armorTable ? (
        <TableCard
          title={input.model.armorTable.title}
          description={input.model.armorTable.description}
          columns={input.model.armorTable.columns}
          rows={input.model.armorTable.rows}
        />
      ) : null}

      <TableCard
        title={input.model.weaponModeTable.title}
        description={input.model.weaponModeTable.description}
        columns={input.model.weaponModeTable.columns}
        nowrapColumnIndexes={[0, 1]}
        rows={input.model.weaponModeTable.rows}
      />
    </SectionCard>
  );
}
