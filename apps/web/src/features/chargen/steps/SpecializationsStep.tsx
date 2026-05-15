import {
  getBadgeStyle,
  getRowActionFeedbackKey,
  getRuleStatusColor,
  getSpecializationPurchaseState,
  getSpecializationRowMessages
} from "../chargenWizardHelpers";
import type { useChargenWizardState } from "../useChargenWizardState";

type State = ReturnType<typeof useChargenWizardState>;

interface SpecializationsStepProps {
  handleAllocateSpecialization: State["handleAllocateSpecialization"];
  handleRemoveSpecialization: State["handleRemoveSpecialization"];
  rowActionFeedback: State["rowActionFeedback"];
  setShowAllSpecializations: State["setShowAllSpecializations"];
  setShowSpecializations: State["setShowSpecializations"];
  setSpecializationSearch: State["setSpecializationSearch"];
  showAllSpecializations: State["showAllSpecializations"];
  showSpecializations: State["showSpecializations"];
  skillAllocationContext: State["skillAllocationContext"];
  specializationFilterActive: State["specializationFilterActive"];
  specializationRows: State["specializationRows"];
  specializationSearch: State["specializationSearch"];
  visibleSpecializationRows: State["visibleSpecializationRows"];
}

export function SpecializationsStep({
  handleAllocateSpecialization,
  handleRemoveSpecialization,
  rowActionFeedback,
  setShowAllSpecializations,
  setShowSpecializations,
  setSpecializationSearch,
  showAllSpecializations,
  showSpecializations,
  skillAllocationContext,
  specializationFilterActive,
  specializationRows,
  specializationSearch,
  visibleSpecializationRows
}: SpecializationsStepProps) {
  return (
    <section
      style={{
        background: "#fbfaf5",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "1rem",
        order: 8,
        padding: "1rem"
      }}
    >
      <h2 style={{ margin: 0 }}>8. Specializations</h2>

      <div style={{ fontSize: "0.95rem" }}>
        Specializations use flexible points and are gated by the parent skill. The default list
        hides distant blocked rows so parentless entries do not overwhelm the page.
      </div>
      <div
        style={{
          alignItems: "end",
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "minmax(220px, 1fr) auto auto"
        }}
      >
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span>Search specializations</span>
          <input
            onChange={(event) => setSpecializationSearch(event.target.value)}
            placeholder="Search specialization name"
            type="search"
            value={specializationSearch}
          />
        </label>
        <label
          style={{
            alignItems: "center",
            display: "flex",
            gap: "0.5rem",
            justifySelf: "start"
          }}
        >
          <input
            checked={showAllSpecializations}
            onChange={(event) => setShowAllSpecializations(event.target.checked)}
            type="checkbox"
          />
          Show all blocked rows
        </label>
        <button onClick={() => setShowSpecializations((current) => !current)} type="button">
          {showSpecializations || specializationFilterActive ? "Collapse" : "Expand"}
        </button>
      </div>

      <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
        Showing {visibleSpecializationRows.length} of {specializationRows.length} specialization
        rows.
      </div>

      {showSpecializations || specializationFilterActive ? (
        <div
          style={{
            border: "1px solid #e7e2d7",
            borderRadius: 10,
            overflowX: "auto"
          }}
        >
          <div
            style={{
              borderBottom: "1px solid #e7e2d7",
              color: "#5e5a50",
              display: "grid",
              fontSize: "0.8rem",
              gap: "0.75rem",
              gridTemplateColumns:
                "minmax(180px, 2fr) minmax(160px, 1.6fr) repeat(2, minmax(88px, 104px)) minmax(150px, 1fr)",
              padding: "0.75rem 1rem"
            }}
          >
            <strong>Specialization</strong>
            <strong>Parent skill</strong>
            <strong>Parent level</strong>
            <strong>Flexible</strong>
            <strong>Actions</strong>
          </div>

          {visibleSpecializationRows.map((row) => {
            const purchaseState = getSpecializationPurchaseState({
              skillAllocationContext,
              specializationId: row.specialization.id
            });
            const { feedback: rowFeedback, statusItems: ruleStatusItems } =
              getSpecializationRowMessages({
                evaluation: row.evaluation,
                persistedRowFeedback: rowActionFeedback[
                  getRowActionFeedbackKey(row.specialization.id, "specialization")
                ],
                purchaseState
              });

            return (
              <div
                key={row.specialization.id}
                style={{
                  borderTop: "1px solid #f0eadf",
                  display: "grid",
                  gap: "0.35rem",
                  opacity:
                    !row.evaluation.isAllowed && row.parentSkillLevel === 0 && row.specializationLevel === 0
                      ? 0.72
                      : 1,
                  padding: "0.75rem 1rem"
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    display: "grid",
                    gap: "0.75rem",
                    gridTemplateColumns:
                      "minmax(180px, 2fr) minmax(160px, 1.6fr) repeat(2, minmax(88px, 104px)) minmax(150px, 1fr)"
                  }}
                >
                  <div style={{ display: "grid", gap: "0.25rem" }}>
                    <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      <span>{row.specialization.name}</span>
                      <span style={getBadgeStyle({ muted: true })}>Specialization</span>
                    </div>
                    {row.grantedSourceLabel ? (
                      <div style={{ color: "#5e5a50", fontSize: "0.8rem" }}>
                        {row.grantedSourceLabel}
                      </div>
                    ) : null}
                    {purchaseState.nextCost !== undefined ? (
                      <div style={{ color: "#5e5a50", fontSize: "0.8rem" }}>
                        Next cost {purchaseState.nextCost} flexible points
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <div>{row.parentSkillName}</div>
                    <div style={{ color: "#5e5a50", fontSize: "0.8rem" }}>
                      Needs level {row.specialization.minimumParentLevel}
                    </div>
                  </div>
                  <div>{row.parentSkillLevel}</div>
                  <div>
                    <div>{row.secondaryRanks}</div>
                    {row.grantedSpecializationLevel > 0 ? (
                      <div style={{ color: "#5e5a50", fontSize: "0.8rem" }}>
                        +{row.grantedSpecializationLevel} derived preview
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    <button
                      aria-label={`Add ${row.specialization.name}`}
                      disabled={!purchaseState.canAllocate}
                      onClick={() => handleAllocateSpecialization(row.specialization.id)}
                      type="button"
                    >
                      +
                    </button>
                    <button
                      aria-label={`Remove ${row.specialization.name}`}
                      disabled={!skillAllocationContext}
                      onClick={() => handleRemoveSpecialization(row.specialization.id)}
                      type="button"
                    >
                      -
                    </button>
                  </div>
                </div>
                {ruleStatusItems.map((status) => (
                  <div
                    key={`${row.specialization.id}-${status.tone}-${status.message}`}
                    role="status"
                    style={{
                      color: getRuleStatusColor(status.tone),
                      fontSize: "0.85rem"
                    }}
                  >
                    {status.message}
                  </div>
                ))}
                {rowFeedback ? (
                  <div role="status" style={{ color: "#7a4b00", fontSize: "0.85rem" }}>
                    {rowFeedback}
                  </div>
                ) : null}
              </div>
            );
          })}

          {visibleSpecializationRows.length === 0 ? (
            <div style={{ padding: "1rem" }}>
              No specializations match the current search or visibility setting.
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
