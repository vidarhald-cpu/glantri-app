import type { useChargenWizardState } from "../useChargenWizardState";
import type { SkillBrowseTypeFilter, SkillVisibilityFilter } from "@/lib/chargen/chargenBrowse";

type State = ReturnType<typeof useChargenWizardState>;

interface OtherSkillsStepProps {
  otherSkillFilterActive: State["otherSkillFilterActive"];
  otherSkillTypeOptions: State["otherSkillTypeOptions"];
  renderSkillRowsTable: State["renderSkillRowsTable"];
  setShowOtherSkills: State["setShowOtherSkills"];
  setSkillSearch: State["setSkillSearch"];
  setSkillTypeFilter: State["setSkillTypeFilter"];
  setSkillVisibilityFilter: State["setSkillVisibilityFilter"];
  showOtherSkills: State["showOtherSkills"];
  skillSearch: State["skillSearch"];
  skillTypeFilter: State["skillTypeFilter"];
  skillVisibilityFilter: State["skillVisibilityFilter"];
  visibleOtherSkillRows: State["visibleOtherSkillRows"];
}

export function OtherSkillsStep({
  otherSkillFilterActive,
  otherSkillTypeOptions,
  renderSkillRowsTable,
  setShowOtherSkills,
  setSkillSearch,
  setSkillTypeFilter,
  setSkillVisibilityFilter,
  showOtherSkills,
  skillSearch,
  skillTypeFilter,
  skillVisibilityFilter,
  visibleOtherSkillRows
}: OtherSkillsStepProps) {
  return (
    <section
      style={{
        background: "#fbfaf5",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.75rem",
        order: 7,
        padding: "1rem"
      }}
    >
      <h2 style={{ margin: 0 }}>7. Other skills</h2>
      <div style={{ display: "grid", gap: "0.75rem" }}>
        <div
          style={{
            alignItems: "start",
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "minmax(0, 1fr) auto"
          }}
        >
          <div style={{ display: "grid", gap: "0.3rem" }}>
            <div style={{ fontSize: "0.9rem" }}>Other skills use flexible points</div>
            <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
              {visibleOtherSkillRows.length} other skill
              {visibleOtherSkillRows.length === 1 ? "" : "s"} visible
            </div>
          </div>
          <button onClick={() => setShowOtherSkills((current) => !current)} type="button">
            {showOtherSkills || (otherSkillFilterActive && visibleOtherSkillRows.length > 0)
              ? "Collapse"
              : "Expand"}
          </button>
        </div>
      </div>

      {showOtherSkills || (otherSkillFilterActive && visibleOtherSkillRows.length > 0) ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div
            style={{
              alignItems: "end",
              background: "#f6f5ef",
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns:
                "minmax(220px, 1fr) minmax(180px, 220px) minmax(180px, 240px)",
              padding: "1rem"
            }}
          >
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>Search skills</span>
              <input
                className="other-skill-search-input"
                onChange={(event) => setSkillSearch(event.target.value)}
                placeholder="Search by skill name"
                type="search"
                value={skillSearch}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>Show</span>
              <select
                onChange={(event) =>
                  setSkillVisibilityFilter(event.target.value as SkillVisibilityFilter)
                }
                value={skillVisibilityFilter}
              >
                <option value="all">All visible skills</option>
                <option value="purchasable">Purchasable now</option>
                <option value="owned">Owned</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>Skill category</span>
              <select
                onChange={(event) =>
                  setSkillTypeFilter(event.target.value as SkillBrowseTypeFilter)
                }
                value={skillTypeFilter}
              >
                <option value="all">All categories</option>
                {otherSkillTypeOptions.map((definition) => (
                  <option key={definition.id} value={definition.id}>
                    {definition.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {renderSkillRowsTable({
            emptyMessage: "No other skills match the current search or filter.",
            rows: visibleOtherSkillRows,
            showOutsideNormalAccessBadge: true,
            showTypeBadge: true
          })}
        </div>
      ) : null}
      <style jsx>{`
        .other-skill-search-input {
          appearance: none;
          -webkit-appearance: none;
          font-family: inherit;
          font-size: 1rem;
          line-height: 1.4;
          padding: 0.5rem;
        }

        .other-skill-search-input::placeholder {
          color: #6b6558;
          font-family: inherit;
          font-size: 1rem;
          line-height: 1.4;
          opacity: 1;
        }
      `}</style>
    </section>
  );
}
