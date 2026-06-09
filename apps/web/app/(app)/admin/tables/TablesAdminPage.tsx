"use client";

import React from "react";

import {
  COMBAT_ARMOR_MODIFIER_RULE_TABLE,
  COMBAT_TO_HIT_RULE_TABLE,
  expandClosedDieRuleTable,
  HIT_LOCATION_RULE_TABLE,
  type ClosedDieRuleTable,
  type CombatArmorModifierRuleTable,
  type CombatToHitRuleTable,
} from "@glantri/domain";
import { WORKBOOK_MOVEMENT_PERCENT_TABLE } from "@glantri/rules-engine";

import { AdminPageIntro, AdminPanel, AdminTag } from "../admin-ui";

const movementModifierColumns = Array.from({ length: 15 }, (_, index) => index + 1);

const percentExplanation =
  "The Percent table converts a modifier into a percentage adjustment. It is used by movement and combat calculations that apply percentage-based modifiers.";

const combatToHitHumanNotes = [
  "Roll open-ended 1d20.",
  "Add the roll total to OB minus DB.",
  "Hit lookup total = OB - DB + open-ended roll total.",
  "10 or lower misses.",
  "11 is a grazing hit.",
  "12 or higher hits.",
  "Normal hit damage uses a second lookup: hit lookup total + weapon DMB + defender DM + armor modifier.",
  "The damage lookup row gives final table damage, critical grade, and minimum damage.",
  "Grazing damage rolls 1d of the table damage from lookup 12 plus the same DMB, DM, and armor modifier.",
  "D1/D2 damage proposals resolve hit location with a closed 1d20 before damage is committed.",
  "Armor modifier participates in the damage lookup when a safe armor source is available.",
];

export default function TablesAdminPage() {
  const baseMoveRows = Object.keys(WORKBOOK_MOVEMENT_PERCENT_TABLE)
    .map((value) => Number(value))
    .sort((left, right) => left - right);

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Tables"
        title="Tables"
        summary="Reference tables used by current combat and movement calculations."
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

      <ClosedDieRuleTablePanel group="Combat" table={HIT_LOCATION_RULE_TABLE} />
      <CombatArmorModifierRuleTablePanel table={COMBAT_ARMOR_MODIFIER_RULE_TABLE} />
      <CombatToHitRuleTablePanel table={COMBAT_TO_HIT_RULE_TABLE} />
    </section>
  );
}

function formatLookupTotal(row: CombatToHitRuleTable["rows"][number]): string {
  if (row.lookupTotal !== undefined) {
    return row.lookupTotal.toString();
  }

  if (row.maxLookupTotal !== undefined) {
    return `<= ${row.maxLookupTotal}`;
  }

  if (row.minLookupTotal !== undefined) {
    return `>= ${row.minLookupTotal}`;
  }

  return "Unbounded";
}

function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No";
}

function formatCombatTableDamage(row: CombatToHitRuleTable["rows"][number]): string {
  if (row.ambiguousDamage) {
    return "Needs clarification";
  }

  if (row.damageRollFormula === "grazing-from-lookup-12") {
    return "1d reference damage";
  }

  if (row.damage !== undefined) {
    return row.damage.toString();
  }

  if (row.damageFormula === "lookup-minus-13") {
    return "Lookup - 13";
  }

  return "—";
}

function formatCombatCriticalGrade(row: CombatToHitRuleTable["rows"][number]): string {
  return row.criticalGrade ? row.criticalGrade.toUpperCase() : "—";
}

function formatMinimumDamage(row: CombatToHitRuleTable["rows"][number]): string {
  return row.minDamage !== undefined ? row.minDamage.toString() : "—";
}

function formatMaximumDamage(row: CombatToHitRuleTable["rows"][number]): string {
  return row.maxDamageNote ?? "—";
}

function CombatToHitRuleTablePanel(props: {
  table: CombatToHitRuleTable;
}) {
  return (
    <AdminPanel
      title={props.table.title}
      subtitle="Combat hit, miss, and grazing-hit lookup."
    >
      <div style={{ display: "grid", gap: "0.85rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <AdminTag>Combat</AdminTag>
          <AdminTag>Open-ended {props.table.dieLabel}</AdminTag>
        </div>
        <ul style={{ color: "#5f543a", lineHeight: 1.5, margin: 0, paddingLeft: "1.2rem" }}>
          {combatToHitHumanNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <div
          style={{
            border: "1px solid rgba(85, 73, 48, 0.14)",
            borderRadius: 18,
            overflowX: "auto",
          }}
        >
          <table style={{ borderCollapse: "collapse", minWidth: 860, width: "100%" }}>
            <thead style={{ background: "rgba(255, 252, 245, 0.95)" }}>
              <tr>
                <th style={tableHeaderStyle}>Lookup total</th>
                <th style={tableHeaderStyle}>Result</th>
                <th style={tableHeaderStyle}>Hit?</th>
                <th style={tableHeaderStyle}>Grazing?</th>
                <th style={tableHeaderStyle}>Table damage</th>
                <th style={tableHeaderStyle}>Critical</th>
                <th style={tableHeaderStyle}>Min damage</th>
                <th style={tableHeaderStyle}>Max damage</th>
              </tr>
            </thead>
            <tbody>
              {props.table.rows.map((row) => (
                <tr key={`${row.resultKey}:${formatLookupTotal(row)}`}>
                  <td style={tableCellStyle}>{formatLookupTotal(row)}</td>
                  <td style={tableCellStyle}>{row.resultLabel}</td>
                  <td style={tableCellStyle}>{formatBoolean(row.hit)}</td>
                  <td style={tableCellStyle}>{formatBoolean(row.grazing)}</td>
                  <td style={tableCellStyle}>{formatCombatTableDamage(row)}</td>
                  <td style={tableCellStyle}>{formatCombatCriticalGrade(row)}</td>
                  <td style={tableCellStyle}>{formatMinimumDamage(row)}</td>
                  <td style={tableCellStyle}>{formatMaximumDamage(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPanel>
  );
}

function CombatArmorModifierRuleTablePanel(props: {
  table: CombatArmorModifierRuleTable;
}) {
  return (
    <AdminPanel
      title={props.table.title}
      subtitle="Damage lookup modifier by weapon armor class and defender armor class."
    >
      <div style={{ display: "grid", gap: "0.85rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <AdminTag>Combat</AdminTag>
          <AdminTag>Armor modifier</AdminTag>
        </div>
        <ul style={{ color: "#5f543a", lineHeight: 1.5, margin: 0, paddingLeft: "1.2rem" }}>
          {props.table.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <div
          style={{
            border: "1px solid rgba(85, 73, 48, 0.14)",
            borderRadius: 18,
            overflowX: "auto",
          }}
        >
          <table style={{ borderCollapse: "collapse", minWidth: 620, width: "100%" }}>
            <thead style={{ background: "rgba(255, 252, 245, 0.95)" }}>
              <tr>
                <th style={tableHeaderStyle}>Armor</th>
                <th style={tableHeaderStyle}>Armor class</th>
                {props.table.columns.map((column) => (
                  <th key={column} style={tableHeaderStyle}>
                    Weapon {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.table.rows.map((row) => (
                <tr key={row.armorKey}>
                  <td style={tableCellStyle}>{row.armorLabel}</td>
                  <td style={tableCellStyle}>{row.armorClass}</td>
                  {props.table.columns.map((column) => (
                    <td key={`${row.armorKey}:${column}`} style={tableCellStyle}>
                      {row.modifiersByWeaponArmorClass[column]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPanel>
  );
}

function ClosedDieRuleTablePanel(props: {
  group: string;
  table: ClosedDieRuleTable;
}) {
  const rows = expandClosedDieRuleTable(props.table);

  return (
    <AdminPanel
      title={props.table.title}
      subtitle="Canonical structured rule table used by domain helpers and future combat resolution."
    >
      <div style={{ display: "grid", gap: "0.85rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <AdminTag>{props.group}</AdminTag>
          <AdminTag>Closed {props.table.dieLabel}</AdminTag>
          <AdminTag>{rows.length} rows</AdminTag>
        </div>
        {props.table.notes?.length ? (
          <ul style={{ color: "#5f543a", lineHeight: 1.5, margin: 0, paddingLeft: "1.2rem" }}>
            {props.table.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
        <div
          style={{
            border: "1px solid rgba(85, 73, 48, 0.14)",
            borderRadius: 18,
            overflowX: "auto",
          }}
        >
          <table style={{ borderCollapse: "collapse", minWidth: 560, width: "100%" }}>
            <thead style={{ background: "rgba(255, 252, 245, 0.95)" }}>
              <tr>
                <th style={tableHeaderStyle}>Roll</th>
                <th style={tableHeaderStyle}>Location</th>
                <th style={tableHeaderStyle}>Short</th>
                <th style={tableHeaderStyle}>Key</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.roll}>
                  <td style={tableCellStyle}>{row.roll}</td>
                  <td style={tableCellStyle}>{row.fullLabel}</td>
                  <td style={tableCellStyle}>{row.shortLabel}</td>
                  <td style={tableCellStyle}>
                    <code>{row.key}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPanel>
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
