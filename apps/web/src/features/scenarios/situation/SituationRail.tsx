"use client";

import { useId, useMemo, useState } from "react";

export interface SituationRailRow {
  /** Sparse secondary cue: a small type or state hint, per §8.1. */
  cue?: string;
  id: string;
  label: string;
  /** Extra text matched by the rail's simple search but not rendered. */
  searchText?: string;
}

export interface SituationRailFilter<TFilterId extends string> {
  id: TFilterId;
  label: string;
}

const rowButtonStyle = {
  background: "none",
  border: 0,
  borderRadius: 6,
  cursor: "pointer",
  display: "grid",
  gap: "0.1rem",
  justifyItems: "start",
  padding: "0.3rem 0.4rem",
  textAlign: "left",
  width: "100%",
} as const;

/**
 * One narrow Situation selector rail: a heading, simple search, optional simple
 * filters, and sparse selectable rows. It is a selector, not a detail card list
 * (Player Play V1 §8.1) — everything substantial belongs in the Inspector.
 */
export function SituationRail<TFilterId extends string>({
  emptyMessage,
  filters,
  onSelect,
  rows,
  searchLabel,
  selectedId,
  title,
}: {
  emptyMessage: string;
  filters?: {
    activeId: TFilterId;
    label: string;
    onChange: (next: TFilterId) => void;
    options: SituationRailFilter<TFilterId>[];
  };
  onSelect: (id: string) => void;
  rows: SituationRailRow[];
  searchLabel: string;
  selectedId?: string;
  title: string;
}) {
  const headingId = useId();
  const searchId = useId();
  const [query, setQuery] = useState("");

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) =>
      `${row.label} ${row.cue ?? ""} ${row.searchText ?? ""}`
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [query, rows]);

  return (
    <section aria-labelledby={headingId} className="glantri-panel glantri-panel--muted">
      <h3 className="glantri-section-heading" id={headingId} style={{ margin: 0 }}>
        {title}
      </h3>
      <label className="glantri-helper-text" htmlFor={searchId}>
        {searchLabel}
      </label>
      <input
        id={searchId}
        onChange={(event) => setQuery(event.target.value)}
        type="search"
        value={query}
      />
      {filters ? (
        <div aria-label={filters.label} className="glantri-actions" role="group">
          {filters.options.map((option) => (
            <button
              aria-pressed={filters.activeId === option.id}
              key={option.id}
              onClick={() => filters.onChange(option.id)}
              style={{
                border: "var(--glantri-border-subtle)",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: "0.8rem",
                padding: "0.1rem 0.55rem",
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {visibleRows.length ? (
        <ul style={{ display: "grid", gap: "0.15rem", listStyle: "none", margin: 0, padding: 0 }}>
          {visibleRows.map((row) => (
            <li key={row.id}>
              <button
                aria-current={selectedId === row.id ? "true" : undefined}
                aria-label={row.label}
                onClick={() => onSelect(row.id)}
                style={{
                  ...rowButtonStyle,
                  background: selectedId === row.id ? "#eef2ec" : "none",
                }}
                type="button"
              >
                <span style={{ fontWeight: 600 }}>{row.label}</span>
                {row.cue ? <span className="glantri-helper-text">{row.cue}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="glantri-helper-text" style={{ margin: 0 }}>
          {emptyMessage}
        </p>
      )}
    </section>
  );
}
