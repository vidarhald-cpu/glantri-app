import type { ReactNode } from "react";

import type { CombatStateDetailRow, CombatStatePanelModel } from "../combatStatePanel";
import styles from "./CombatStatePanel.module.css";

function SectionCard(input: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionCardHeader}>
        <h2 className={styles.sectionCardHeading}>{input.title}</h2>
        {input.description ? (
          <div className={styles.sectionCardDescription}>{input.description}</div>
        ) : null}
      </div>
      {input.children}
    </section>
  );
}

function StatGrid(input: { children: ReactNode }) {
  return (
    <div className={styles.statGrid}>
      {input.children}
    </div>
  );
}

function DetailRow(input: { label: string; value: ReactNode }) {
  return (
    <div className={styles.detailRow}>
      <div className={styles.detailRowLabel}>{input.label}</div>
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
    <div className={styles.battleStatCard}>
      <div className={styles.battleStatCardHeader}>
        <strong>{input.title}</strong>
        {input.subtitle ? (
          <div className={styles.battleStatCardSubtitle}>{input.subtitle}</div>
        ) : null}
      </div>
      <div className={styles.detailRows}>
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
    <div className={styles.tableCard}>
      <div className={styles.tableCardHeader}>
        <strong>{input.title}</strong>
        {input.description ? (
          <div className={styles.tableCardDescription}>{input.description}</div>
        ) : null}
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {input.columns.map((column) => (
                <th key={column} className={styles.th}>
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
                    className={styles.td}
                    style={{
                      borderBottom: rowIndex === input.rows.length - 1 ? "none" : "1px solid #e6e6df",
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
      {input.model.modifierSourceNote ? (
        <div style={{ color: "#5e5a50", fontSize: "0.92rem" }}>
          {input.model.modifierSourceNote}
        </div>
      ) : null}

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
