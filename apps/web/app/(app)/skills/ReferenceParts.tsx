"use client";

import type React from "react";
import type {
  ReferenceAccessGrid,
  ReferenceBound,
  ReferenceLink,
  ReferenceRelationship,
  SkillReferenceTab,
} from "@/lib/skills/skillReferenceModel";
import { accessOverviewRows, type ReaderProse } from "./referenceCatalogue";
import { hashFor, linkDestination, type Navigate } from "./referenceNavigation";
import styles from "./skillsReference.module.css";

export function ReferenceLinkView({
  item,
  tab,
  navigate,
}: {
  item: ReferenceLink;
  tab: SkillReferenceTab;
  navigate: Navigate;
}) {
  const destination = linkDestination(tab, item);
  return (
    <a
      href={hashFor(destination)}
      onClick={(event) => {
        event.preventDefault();
        navigate(destination);
      }}
    >
      {item.name}
    </a>
  );
}

export function LinkSeries({
  items,
  tab,
  navigate,
}: {
  items: ReferenceLink[];
  tab: SkillReferenceTab;
  navigate: Navigate;
}) {
  return (
    <>
      {items.map((item, index) => (
        <span key={item.id}>
          {index > 0 ? ", " : ""}
          <ReferenceLinkView item={item} tab={tab} navigate={navigate} />
        </span>
      ))}
    </>
  );
}

export function BoundText({ bound }: { bound?: ReferenceBound }) {
  if (!bound) return null;
  return (
    <span>
      {" "}
      · From Society Level {bound.minSocietyLevel}
      {bound.minSocialBand !== "L1" ? `, Social Band ${bound.minSocialBand}` : ""}
      {bound.reasons.length ? ` — ${bound.reasons.join(" ")}` : ""}
    </span>
  );
}

export function Section({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty: string;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  return (
    <section className={styles.relationships}>
      <h3>{title}</h3>
      {Array.isArray(items) && items.length === 0 ? <p>{empty}</p> : <ul>{items}</ul>}
    </section>
  );
}

/** A plain block section, for Inspector steps whose body is prose rather than a list. */
export function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.relationships}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function RelationshipRow({
  relationship,
  navigate,
}: {
  relationship: ReferenceRelationship;
  navigate: Navigate;
}) {
  const factor = (value: number) => (value === 1 ? "1.0" : String(value));
  return (
    <li>
      <ReferenceLinkView item={relationship.source} tab="skills" navigate={navigate} /> →{" "}
      <ReferenceLinkView item={relationship.target} tab="skills" navigate={navigate} /> ·{" "}
      <strong>{relationship.mechanism}</strong>.{" "}
      {relationship.bridge
        ? `Parent threshold ${relationship.bridge.threshold}; parent excess offset ${relationship.bridge.parentExcessOffset}; reverse factor ${factor(relationship.bridge.reverseFactor)} from the Specialization to its parent.`
        : `Factor ${factor(relationship.factor!)}.`}
    </li>
  );
}

/**
 * Step 1 of the common Inspector hierarchy: explain the thing.
 *
 * Where the full prose has not been published the summary is shown as a summary and said to be one,
 * because section 9.7 and section 9.12 forbid presenting a one-line description as full prose.
 */
export function ProseIntroduction({
  prose,
  unpublishedNote,
}: {
  prose: ReaderProse;
  unpublishedNote: string;
}) {
  return (
    <>
      <p className={styles.lede}>{prose.summary}</p>
      {prose.full ? (
        <p className={styles.prose}>{prose.full}</p>
      ) : (
        <p className={styles.unpublished}>{unpublishedNote}</p>
      )}
      {prose.typicalActivities.length > 0 && (
        <Section title="Typical activities" empty="None are listed.">
          {prose.typicalActivities.map((activity) => (
            <li key={activity}>{activity}</li>
          ))}
        </Section>
      )}
      {prose.boundaries.length > 0 && (
        <Section title="Boundaries and context" empty="None are listed.">
          {prose.boundaries.map((boundary) => (
            <li key={boundary}>{boundary}</li>
          ))}
        </Section>
      )}
    </>
  );
}

/* ------------------------------------------------------------- catalogue table */

export type CatalogueColumn = { key: string; label: string };
export type CatalogueRow = { key: string; name: string; cells: React.ReactNode[] };

/**
 * The compact browsing table of section 9.4. Selecting a row opens that entry's Inspector.
 *
 * Each catalogue builds its own columns; this component only lays them out, so no generalized
 * column or filter framework is introduced.
 */
export function CatalogueTable({
  caption,
  columns,
  rows,
  selectedKey,
  onSelect,
  empty,
}: {
  caption: string;
  columns: CatalogueColumn[];
  rows: CatalogueRow[];
  selectedKey?: string;
  onSelect: (key: string) => void;
  empty: string;
}) {
  if (rows.length === 0)
    return (
      <div className={styles.catalogue}>
        <p className={styles.resultCount}>{caption}</p>
        <p>{empty}</p>
      </div>
    );
  return (
    <div className={styles.catalogue}>
      <div className={`${styles.tableScroller} ${styles.catalogueScroller}`} tabIndex={0}>
        <table className={styles.catalogueTable}>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              {columns.map((column) => (
                <th key={column.key} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className={selectedKey === row.key ? styles.selectedRow : undefined}
              >
                <th scope="row">
                  <button
                    type="button"
                    aria-current={selectedKey === row.key ? "true" : undefined}
                    onClick={() => onSelect(row.key)}
                  >
                    {row.name}
                  </button>
                </th>
                {row.cells.map((cell, index) => (
                  <td key={columns[index]?.key ?? index}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Access Overview */

/**
 * The Access Overview of section 9.10: Society Level rows, Social Band columns, canonical
 * availability in the cells. Placed last in every Inspector, per the common hierarchy.
 *
 * Above the authored ceiling the row says the content is unauthored. It does not repeat the ceiling's
 * numbers downward, because that would assert availability the canonical content does not carry.
 */
export function AccessOverview({
  grid,
  intro,
  cellLabel,
}: {
  grid: ReferenceAccessGrid;
  intro: string;
  cellLabel: (cell: ReferenceAccessGrid["cells"][number]) => string;
}) {
  const rows = accessOverviewRows(grid, cellLabel);
  return (
    <section className={styles.relationships}>
      <h3>Access Overview</h3>
      <p>{intro}</p>
      <div className={styles.tableScroller} tabIndex={0}>
        <table className={styles.accessTable}>
          <caption>Society Level by Social Band</caption>
          <thead>
            <tr>
              <th scope="col">Society Level</th>
              {grid.socialBands.map((band) => (
                <th key={band.id} scope="col">
                  {band.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.societyLevel}>
                <th scope="row">Level {row.societyLevel}</th>
                {row.authored ? (
                  row.cells.map((cell) => <td key={cell.socialBand}>{cell.label}</td>)
                ) : (
                  <td className={styles.unauthoredCell} colSpan={grid.socialBands.length}>
                    Not yet authored
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.unpublished}>
        Availability is authored up to Society Level {grid.authoredCeiling}. Above that level it is
        not yet authored, which is not the same as unavailable.
      </p>
    </section>
  );
}
