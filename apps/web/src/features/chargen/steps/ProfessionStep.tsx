import {
  ProfessionExplanation,
  ProfessionTrainingOverview,
} from "../components/ProfessionTraining";
import { getBadgeStyle } from "../chargenWizardHelpers";
import type { useChargenWizardState } from "../useChargenWizardState";

type State = ReturnType<typeof useChargenWizardState>;

interface ProfessionStepProps {
  activeProfessionPreviewId: State["activeProfessionPreviewId"];
  availableProfessions: State["availableProfessions"];
  handleProfessionChange: State["handleProfessionChange"];
  professionBrowseModel: State["professionBrowseModel"];
  professionCategoryFilter: State["professionCategoryFilter"];
  professionCategoryOptions: State["professionCategoryOptions"];
  professionSearch: State["professionSearch"];
  selectedProfessionCard: State["selectedProfessionCard"];
  selectedProfessionId: State["selectedProfessionId"];
  selectedSociety: State["selectedSociety"];
  selectedSocietyAccess: State["selectedSocietyAccess"];
  setProfessionCategoryFilter: State["setProfessionCategoryFilter"];
  setProfessionSearch: State["setProfessionSearch"];
  setShowProfessionChooser: State["setShowProfessionChooser"];
  showProfessionChooser: State["showProfessionChooser"];
  toggleProfessionPreview: State["toggleProfessionPreview"];
  visibleProfessionCards: State["visibleProfessionCards"];
}

const panelStyle = {
  background: "#f6f5ef",
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  padding: "1rem",
} as const;

/* The collapsed section's own surface: the step's existing panel, with the muted text colour the
   step already uses for secondary prose. Same idiom as `StatsStep.module.css`'s `.placeholder`
   (#577). */
const placeholderStyle = { ...panelStyle, color: "#5e5a50" } as const;

/**
 * Step 5 — choose a Profession, and understand it before any mechanics appear.
 *
 * The order is #372 section 1 and contract section 10.1: the full reader description, then what
 * the Profession can train, then the training routes and the Skills they teach. The detailed
 * acquisition controls live in step 6 and read the same canonical model, so a player never has to
 * re-learn the structure between the two steps.
 */
export function ProfessionStep({
  activeProfessionPreviewId,
  availableProfessions,
  handleProfessionChange,
  professionBrowseModel,
  professionCategoryFilter,
  professionCategoryOptions,
  professionSearch,
  selectedProfessionCard,
  selectedProfessionId,
  selectedSociety,
  selectedSocietyAccess,
  setProfessionCategoryFilter,
  setProfessionSearch,
  setShowProfessionChooser,
  showProfessionChooser,
  toggleProfessionPreview,
  visibleProfessionCards,
}: ProfessionStepProps) {
  const activeCategory = professionCategoryOptions.find(
    (category) => category.id === professionCategoryFilter,
  );

  return (
    <section
      style={{
        display: "grid",
        gap: "0.75rem",
        opacity: selectedSocietyAccess ? 1 : 0.6,
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: "0.75rem",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ margin: 0 }}>5. Choose profession</h2>
        {/* Always visible whenever there is anything to choose, like the Stats step's own toggle,
            so a collapsed section is never a dead end. It only reveals or hides. */}
        {availableProfessions.length > 0 ? (
          <button onClick={() => setShowProfessionChooser((current) => !current)} type="button">
            {showProfessionChooser ? "Collapse profession" : "Expand profession"}
          </button>
        ) : null}
      </div>
      <div style={{ fontSize: "0.95rem" }}>
        A Profession is the working life your Character has been trained into. Read what it does and
        what it can teach, then choose. Choosing one grants no ranks and spends no points.
      </div>
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {availableProfessions.length > 0 ? (
          <>
            {selectedProfessionCard && !showProfessionChooser ? (
              <section style={{ ...panelStyle, display: "grid", gap: "0.9rem" }}>
                <div
                  style={{
                    alignItems: "start",
                    display: "grid",
                    gap: "0.75rem",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                  }}
                >
                  <div style={{ display: "grid", gap: "0.45rem" }}>
                    <div
                      style={{
                        alignItems: "center",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                      }}
                    >
                      <strong>{selectedProfessionCard.subtypeName}</strong>
                      {selectedProfessionCard.categoryName ? (
                        <span style={getBadgeStyle()}>{selectedProfessionCard.categoryName}</span>
                      ) : null}
                      {selectedProfessionCard.hasLiteracyFoundation ? (
                        <span style={getBadgeStyle({ muted: true })}>Literacy matters here</span>
                      ) : null}
                    </div>
                    {/* 1. Explain the occupation. */}
                    {selectedProfessionCard.browse ? (
                      <ProfessionExplanation profession={selectedProfessionCard.browse} />
                    ) : (
                      <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                        {selectedProfessionCard.description ??
                          selectedProfessionCard.familyDescription ??
                          ""}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setShowProfessionChooser(true)} type="button">
                    Change profession
                  </button>
                </div>
                {/* 2. What it can train, then 3. how it trains it. */}
                {selectedProfessionCard.browse ? (
                  <ProfessionTrainingOverview
                    model={professionBrowseModel}
                    profession={selectedProfessionCard.browse}
                  />
                ) : null}
              </section>
            ) : showProfessionChooser ? (
              <>
                <div
                  style={{
                    ...panelStyle,
                    alignItems: "end",
                    display: "grid",
                    gap: "0.75rem",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                  }}
                >
                  <label style={{ display: "grid", gap: "0.35rem" }}>
                    <span>Search professions</span>
                    <input
                      onChange={(event) => setProfessionSearch(event.target.value)}
                      placeholder="Search by name, kind of work, or what it does"
                      type="search"
                      value={professionSearch}
                    />
                  </label>
                  {/* The approved browsing roster (rule decision 0012). It narrows the list; it
                      grants nothing and changes no Profession. */}
                  <label style={{ display: "grid", gap: "0.35rem" }}>
                    <span>Kind of work</span>
                    <select
                      onChange={(event) => setProfessionCategoryFilter(event.target.value)}
                      value={professionCategoryFilter}
                    >
                      <option value="all">Every kind of work</option>
                      {professionCategoryOptions.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name} ({category.count})
                        </option>
                      ))}
                    </select>
                  </label>
                  {activeCategory ? (
                    <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                      {activeCategory.belongsHere}
                    </div>
                  ) : null}
                </div>

                {visibleProfessionCards.length > 0 ? (
                  visibleProfessionCards.map((profession) => {
                    const isExpanded = activeProfessionPreviewId === profession.id;

                    return (
                      <section
                        key={profession.id}
                        style={{
                          background: selectedProfessionId === profession.id ? "#fbfaf5" : "#fff",
                          border: "1px solid #d9ddd8",
                          borderRadius: 12,
                          display: "grid",
                          gap: "0.75rem",
                          padding: "1rem",
                        }}
                      >
                        <div
                          style={{
                            alignItems: "start",
                            display: "grid",
                            gap: "0.75rem",
                            gridTemplateColumns: "minmax(0, 1fr) auto",
                          }}
                        >
                          <div style={{ display: "grid", gap: "0.45rem" }}>
                            <label
                              style={{
                                alignItems: "center",
                                cursor: selectedSociety ? "pointer" : "not-allowed",
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "0.75rem",
                              }}
                            >
                              <input
                                checked={selectedProfessionId === profession.id}
                                disabled={!selectedSociety}
                                name="profession"
                                onChange={() => handleProfessionChange(profession.id)}
                                type="radio"
                              />
                              <strong>{profession.subtypeName}</strong>
                              {profession.categoryName ? (
                                <span style={getBadgeStyle()}>{profession.categoryName}</span>
                              ) : null}
                              {selectedProfessionId === profession.id ? (
                                <span style={getBadgeStyle()}>Selected</span>
                              ) : null}
                            </label>
                            <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                              {profession.description ?? profession.familyDescription ?? ""}
                            </div>
                          </div>

                          <button
                            onClick={() => toggleProfessionPreview(profession.id)}
                            type="button"
                          >
                            {isExpanded ? "Hide details" : "Preview"}
                          </button>
                        </div>

                        {isExpanded ? (
                          <div
                            style={{
                              background: "#f6f5ef",
                              border: "1px solid #e7e2d7",
                              borderRadius: 10,
                              display: "grid",
                              gap: "0.9rem",
                              padding: "1rem",
                            }}
                          >
                            {profession.browse ? (
                              <>
                                <ProfessionExplanation profession={profession.browse} />
                                <ProfessionTrainingOverview
                                  model={professionBrowseModel}
                                  profession={profession.browse}
                                  showGroupProse={false}
                                />
                              </>
                            ) : (
                              <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                                This Profession is not yet described in full.
                              </div>
                            )}
                          </div>
                        ) : null}
                      </section>
                    );
                  })
                ) : (
                  <div style={panelStyle}>
                    No professions match that search in this kind of work.
                  </div>
                )}
              </>
            ) : (
              <div style={placeholderStyle}>
                Expand profession to review the available professions.
              </div>
            )}
          </>
        ) : (
          <div style={panelStyle}>Select a rolled profile and civilization first.</div>
        )}
      </div>
    </section>
  );
}
