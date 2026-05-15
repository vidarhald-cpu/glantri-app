import { getBadgeStyle, formatPreviewList } from "../chargenWizardHelpers";
import type { useChargenWizardState } from "../useChargenWizardState";

type State = ReturnType<typeof useChargenWizardState>;

interface ProfessionStepProps {
  activeProfessionPreviewId: State["activeProfessionPreviewId"];
  availableProfessions: State["availableProfessions"];
  availableProfessionCards: State["availableProfessionCards"];
  handleProfessionChange: State["handleProfessionChange"];
  professionFamilyFilter: State["professionFamilyFilter"];
  professionFamilyOptions: State["professionFamilyOptions"];
  professionSearch: State["professionSearch"];
  selectedProfessionCard: State["selectedProfessionCard"];
  selectedProfessionId: State["selectedProfessionId"];
  selectedSociety: State["selectedSociety"];
  selectedSocietyAccess: State["selectedSocietyAccess"];
  setProfessionFamilyFilter: State["setProfessionFamilyFilter"];
  setProfessionSearch: State["setProfessionSearch"];
  setShowProfessionChooser: State["setShowProfessionChooser"];
  showProfessionChooser: State["showProfessionChooser"];
  toggleProfessionPreview: State["toggleProfessionPreview"];
  visibleProfessionCards: State["visibleProfessionCards"];
}

export function ProfessionStep({
  activeProfessionPreviewId,
  availableProfessions,
  availableProfessionCards,
  handleProfessionChange,
  professionFamilyFilter,
  professionFamilyOptions,
  professionSearch,
  selectedProfessionCard,
  selectedProfessionId,
  selectedSociety,
  selectedSocietyAccess,
  setProfessionFamilyFilter,
  setProfessionSearch,
  setShowProfessionChooser,
  showProfessionChooser,
  toggleProfessionPreview,
  visibleProfessionCards
}: ProfessionStepProps) {
  return (
    <section
      style={{
        display: "grid",
        gap: "0.75rem",
        opacity: selectedSocietyAccess ? 1 : 0.6
      }}
    >
      <h2 style={{ margin: 0 }}>5. Choose profession</h2>
      <div style={{ fontSize: "0.95rem" }}>
        Pick a profession subtype, then review the included profession packages. Favored package
        preview shows likely reach, not a direct grant by itself.
      </div>
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {availableProfessions.length > 0 ? (
          <>
            {selectedProfessionCard && !showProfessionChooser ? (
              <section
                style={{
                  background: "#f6f5ef",
                  border: "1px solid #d9ddd8",
                  borderRadius: 12,
                  display: "grid",
                  gap: "0.75rem",
                  padding: "1rem"
                }}
              >
                <div
                  style={{
                    alignItems: "start",
                    display: "grid",
                    gap: "0.75rem",
                    gridTemplateColumns: "minmax(0, 1fr) auto"
                  }}
                >
                  <div style={{ display: "grid", gap: "0.35rem" }}>
                    <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      <strong>{selectedProfessionCard.subtypeName}</strong>
                      <span style={getBadgeStyle()}>{selectedProfessionCard.familyName}</span>
                    </div>
                    <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                      {selectedProfessionCard.description ??
                        selectedProfessionCard.familyDescription ??
                        "No notes yet."}
                    </div>
                  </div>
                  <button onClick={() => setShowProfessionChooser(true)} type="button">
                    Change profession
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  <span style={getBadgeStyle({ muted: true })}>
                    Core reach {selectedProfessionCard.summary.totalEffectiveCoreReachableSkills}
                  </span>
                  <span style={getBadgeStyle({ muted: true })}>
                    Favored reach {selectedProfessionCard.summary.totalEffectiveFavoredReachableSkills}
                  </span>
                  <span style={getBadgeStyle({ muted: true })}>
                    Included training packages {selectedProfessionCard.normalAccessGroupNames.length}
                  </span>
                  {selectedProfessionCard.hasLiteracyFoundation ? (
                    <span style={getBadgeStyle()}>Literacy matters here</span>
                  ) : null}
                </div>
                <div style={{ display: "grid", gap: "0.35rem", fontSize: "0.9rem" }}>
                  <div>
                    Included training packages:{" "}
                    {formatPreviewList(selectedProfessionCard.normalAccessGroupNames)}
                  </div>
                  <div>
                    Favored direct skills worth watching:{" "}
                    {formatPreviewList(selectedProfessionCard.favoredDirectOnlySkillNames)}
                  </div>
                  {selectedProfessionCard.hasLiteracyFoundation ? (
                    <div>
                      Literacy foundation: this profession path reaches{" "}
                      {selectedProfessionCard.literacyGatedReachableSkillCount} literacy-linked
                      skill
                      {selectedProfessionCard.literacyGatedReachableSkillCount === 1 ? "" : "s"}.
                    </div>
                  ) : null}
                </div>
              </section>
            ) : (
              <>
                <div
                  style={{
                    alignItems: "end",
                    background: "#f6f5ef",
                    border: "1px solid #d9ddd8",
                    borderRadius: 12,
                    display: "grid",
                    gap: "0.75rem",
                    gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 280px)",
                    padding: "1rem"
                  }}
                >
                  <label style={{ display: "grid", gap: "0.35rem" }}>
                    <span>Search professions</span>
                    <input
                      onChange={(event) => setProfessionSearch(event.target.value)}
                      placeholder="Search by subtype, family, or notes"
                      type="search"
                      value={professionSearch}
                    />
                  </label>
                  <label style={{ display: "grid", gap: "0.35rem" }}>
                    <span>Family</span>
                    <select
                      onChange={(event) => setProfessionFamilyFilter(event.target.value)}
                      value={professionFamilyFilter}
                    >
                      <option value="all">All families</option>
                      {professionFamilyOptions.map((familyName) => (
                        <option key={familyName} value={familyName}>
                          {familyName}
                        </option>
                      ))}
                    </select>
                  </label>
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
                          padding: "1rem"
                        }}
                      >
                        <div
                          style={{
                            alignItems: "start",
                            display: "grid",
                            gap: "0.75rem",
                            gridTemplateColumns: "minmax(0, 1fr) auto"
                          }}
                        >
                          <div style={{ display: "grid", gap: "0.45rem" }}>
                            <label
                              style={{
                                alignItems: "center",
                                cursor: selectedSociety ? "pointer" : "not-allowed",
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "0.75rem"
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
                              <span style={getBadgeStyle()}>{profession.familyName}</span>
                              {selectedProfessionId === profession.id ? (
                                <span style={getBadgeStyle()}>Selected</span>
                              ) : null}
                            </label>
                            <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                              {profession.description ?? profession.familyDescription ?? "No notes yet."}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                              <span style={getBadgeStyle({ muted: true })}>
                                Core reach {profession.summary.totalEffectiveCoreReachableSkills}
                              </span>
                              <span style={getBadgeStyle({ muted: true })}>
                                Favored reach {profession.summary.totalEffectiveFavoredReachableSkills}
                              </span>
                              <span style={getBadgeStyle({ muted: true })}>
                                Included training packages {profession.normalAccessGroupNames.length}
                              </span>
                              {profession.hasLiteracyFoundation ? (
                                <span style={getBadgeStyle()}>Literacy matters here</span>
                              ) : null}
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
                              gap: "0.75rem",
                              padding: "1rem"
                            }}
                          >
                            <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                              Skill areas organize the allocation view. Inside each area, you may
                              have included training packages, and those packages open into the
                              actual skills you can raise.
                            </div>
                            <div style={{ display: "grid", gap: "0.35rem" }}>
                              <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                                <strong>Included profession package</strong>
                                <span style={getBadgeStyle()}>Direct grant</span>
                              </div>
                              <div>
                                Included training packages: {formatPreviewList(profession.coreGroupNames)}
                              </div>
                              <div>
                                Actual reachable skills (
                                {profession.summary.totalEffectiveCoreReachableSkills}):{" "}
                                {formatPreviewList(profession.coreReachableSkillNames)}
                              </div>
                            </div>
                            <div style={{ display: "grid", gap: "0.35rem" }}>
                              <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                                <strong>Favored package preview</strong>
                                <span style={getBadgeStyle({ muted: true })}>Preview only</span>
                              </div>
                              <div>
                                Included training packages: {formatPreviewList(profession.favoredGroupNames)}
                              </div>
                              <div>
                                Actual reachable skills (
                                {profession.summary.totalEffectiveFavoredReachableSkills}):{" "}
                                {formatPreviewList(profession.favoredReachableSkillNames)}
                              </div>
                            </div>
                            <div style={{ display: "grid", gap: "0.35rem" }}>
                              <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                                <strong>Normal-access skill areas in this society</strong>
                                <span style={getBadgeStyle({ muted: true })}>Allocation view</span>
                              </div>
                              <div>
                                Buckets include: {formatPreviewList(profession.normalAccessGroupNames)}
                              </div>
                            </div>
                            {profession.hasLiteracyFoundation ? (
                              <div style={{ display: "grid", gap: "0.35rem" }}>
                                <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                                  <strong>Literacy foundation</strong>
                                  <span style={getBadgeStyle()}>Important</span>
                                </div>
                                <div>
                                  This profession path reaches {profession.literacyGatedReachableSkillCount} literacy-linked skill
                                  {profession.literacyGatedReachableSkillCount === 1 ? "" : "s"}.
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </section>
                    );
                  })
                ) : (
                  <div
                    style={{
                      background: "#f6f5ef",
                      border: "1px solid #d9ddd8",
                      borderRadius: 12,
                      padding: "1rem"
                    }}
                  >
                    No professions match the current family filter and search text.
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div
            style={{
              background: "#f6f5ef",
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              padding: "1rem"
            }}
          >
            Select a rolled profile and civilization first.
          </div>
        )}
      </div>
    </section>
  );
}
