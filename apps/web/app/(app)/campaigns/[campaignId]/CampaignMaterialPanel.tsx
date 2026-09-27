"use client";

import { useEffect, useMemo, useState } from "react";

import type { Scenario } from "@glantri/domain";

import { ArtifactPanel } from "@/features/artifacts";
import Link from "next/link";
import { buildCampaignWorkspaceHref } from "@/lib/campaigns/workspace";

import { materialSources, type MaterialEntry, type MaterialView } from "./materialSources";
import styles from "./CampaignMaterialPanel.module.css";

const viewLabels: Record<MaterialView, string> = {
  all: "All material",
  scenario: "Scenario material",
  unattached: "Unattached",
  "shared-artifacts": "Shared Artifacts",
};

export function CampaignMaterialPanel({
  campaignId,
  scenarios,
}: {
  campaignId: string;
  scenarios: Scenario[];
}) {
  const [entries, setEntries] = useState<MaterialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string>();
  const [view, setView] = useState<MaterialView>("all");
  const [scenarioId, setScenarioId] = useState("");
  const [category, setCategory] = useState("");
  const [facetFilters, setFacetFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const facets = materialSources.flatMap((source) => source.filters ?? []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    void Promise.all(
      materialSources.map((source) =>
        source.load({
          campaignId,
          scenarios,
          onMaterialChanged: () => setRefreshToken((value) => value + 1),
        }),
      ),
    )
      .then((groups) => {
        if (active) setEntries(groups.flat().sort((a, b) => a.title.localeCompare(b.title)));
      })
      .catch((caught) => {
        if (active)
          setError(caught instanceof Error ? caught.message : "Campaign Material is unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [campaignId, scenarios, refreshToken]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter(
      (entry) =>
        entry.views.includes(view) &&
        (!scenarioId || entry.scenarioIds.includes(scenarioId)) &&
        (!category || entry.category === category) &&
        Object.entries(facetFilters).every(
          ([key, value]) => !value || entry.facets[key] === value,
        ) &&
        (!query || entry.searchText.includes(query)),
    );
  }, [category, entries, facetFilters, scenarioId, search, view]);

  const selected = filtered.find((entry) => entry.key === selectedKey) ?? filtered[0];
  const activeFilters = [
    ...(view === "all"
      ? []
      : [{ label: `View: ${viewLabels[view]}`, clear: () => setView("all") }]),
    ...(scenarioId
      ? [
          {
            label: `Scenario: ${scenarios.find((scenario) => scenario.id === scenarioId)?.name ?? "Selected"}`,
            clear: () => setScenarioId(""),
          },
        ]
      : []),
    ...(category
      ? [
          {
            label: `Category: ${materialSources.find((source) => source.category === category)?.label ?? category}`,
            clear: () => setCategory(""),
          },
        ]
      : []),
    ...(search ? [{ label: `Search: ${search}`, clear: () => setSearch("") }] : []),
    ...facets.flatMap((facet) => {
      const value = facetFilters[facet.key];
      return value
        ? [
            {
              label: `${facet.label}: ${facet.options.find((option) => option.value === value)?.label ?? value}`,
              clear: () => setFacetFilters((current) => ({ ...current, [facet.key]: "" })),
            },
          ]
        : [];
    }),
  ];

  return (
    <section aria-label="Campaign Material" className={styles.surface}>
      <div className={styles.intro}>
        <div>
          <h2>Campaign Material</h2>
          <p>
            Find Campaign resources and inspect their current use. Open each domain’s editor to
            change it.
          </p>
          <p>
            Canonical editor:{" "}
            <Link href={buildCampaignWorkspaceHref({ campaignId, tab: "items" })}>Items</Link>
          </p>
        </div>
      </div>

      <div className={styles.controls}>
        <label>
          Search material
          <input onChange={(event) => setSearch(event.target.value)} type="search" value={search} />
        </label>
        <label>
          View
          <select onChange={(event) => setView(event.target.value as MaterialView)} value={view}>
            {Object.entries(viewLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Scenario
          <select onChange={(event) => setScenarioId(event.target.value)} value={scenarioId}>
            <option value="">All Scenarios</option>
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>
        </label>
        <details className={styles.moreFilters}>
          <summary>Filters</summary>
          <label>
            Category
            <select onChange={(event) => setCategory(event.target.value)} value={category}>
              <option value="">All categories</option>
              {materialSources.map((source) => (
                <option key={source.category} value={source.category}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
          {facets.map((facet) => (
            <label key={facet.key}>
              {facet.label}
              <select
                onChange={(event) =>
                  setFacetFilters((current) => ({ ...current, [facet.key]: event.target.value }))
                }
                value={facetFilters[facet.key] ?? ""}
              >
                <option value="">All</option>
                {facet.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </details>
      </div>

      {activeFilters.length ? (
        <ul aria-label="Active material filters" className={styles.chips}>
          {activeFilters.map((filter) => (
            <li key={filter.label}>
              <button onClick={filter.clear} type="button">
                {filter.label} ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {view === "shared-artifacts" ? (
        <p className={styles.context}>
          Only Artifact Campaign access is represented here. Item and Map player knowledge is
          outside this view.
        </p>
      ) : view === "unattached" ? (
        <p className={styles.context}>
          Material without a recorded Scenario use. Unassigned Items and Maps can remain in the
          Campaign library intentionally.
        </p>
      ) : null}

      {error ? <p role="alert">{error}</p> : null}
      {loading ? <p aria-busy="true">Loading Campaign Material…</p> : null}

      {!loading && !error ? (
        <div className={styles.layout}>
          <div aria-label="Material list" className={styles.listPane}>
            <p aria-live="polite">
              {filtered.length} of {entries.length} material entries
            </p>
            {filtered.length ? (
              <ul className={styles.list}>
                {filtered.map((entry) => (
                  <li key={entry.key}>
                    <button
                      aria-pressed={selected?.key === entry.key}
                      className={styles.entryButton}
                      onClick={() => setSelectedKey(entry.key)}
                      type="button"
                    >
                      <span className={styles.entryCategory}>{entry.categoryLabel}</span>
                      <strong>{entry.title}</strong>
                      {entry.description ? <span>{entry.description}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No material matches these filters.</p>
            )}
          </div>
          <aside
            aria-label="Material Inspector"
            className={styles.inspector}
            key={selected?.key ?? "empty"}
          >
            {selected ? (
              <>
                <span className={styles.entryCategory}>{selected.categoryLabel}</span>
                <h3>{selected.title}</h3>
                {selected.renderInspector()}
              </>
            ) : (
              <p>Select material from the list to inspect it.</p>
            )}
          </aside>
        </div>
      ) : null}

      <div className={styles.intake} id="campaign-artifacts">
        <ArtifactPanel
          campaignId={campaignId}
          intakeOnly
          onChanged={() => setRefreshToken((value) => value + 1)}
          scenarios={scenarios}
        />
      </div>
    </section>
  );
}
