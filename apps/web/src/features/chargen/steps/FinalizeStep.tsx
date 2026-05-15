import { formatPlayerLabel } from "../chargenWizardHelpers";
import type { useChargenWizardState } from "../useChargenWizardState";

type State = ReturnType<typeof useChargenWizardState>;

interface FinalizeStepProps {
  characterName: State["characterName"];
  currentUser: State["currentUser"];
  handleFinalize: State["handleFinalize"];
  isFinalizing: State["isFinalizing"];
  review: State["review"];
  setCharacterName: State["setCharacterName"];
}

export function FinalizeStep({
  characterName,
  currentUser,
  handleFinalize,
  isFinalizing,
  review,
  setCharacterName
}: FinalizeStepProps) {
  return (
    <section
      style={{
        background: "#fbfaf5",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.75rem",
        order: 12,
        padding: "1rem"
      }}
    >
      <h2 style={{ margin: 0 }}>11. Finalize character</h2>
      <div style={{ fontSize: "0.95rem" }}>
        Confirm the name and create the local character record. The signed-in player is stored as
        the creator for attribution.
      </div>
      <div
        style={{
          background: "#f6f5ef",
          border: "1px solid #e7e2d7",
          borderRadius: 10,
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 320px)",
          padding: "1rem"
        }}
      >
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span>Character name</span>
          <input
            onChange={(event) => setCharacterName(event.target.value)}
            placeholder="Leave blank to use the default generated name"
            type="text"
            value={characterName}
          />
        </label>
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <strong>Creator attribution</strong>
          <div>{formatPlayerLabel(currentUser)}</div>
          <button
            disabled={!review.canFinalize || currentUser === undefined || isFinalizing}
            onClick={() => {
              handleFinalize().catch((error) => {
                console.error(error);
              });
            }}
            style={{ width: "fit-content" }}
            type="button"
          >
            {isFinalizing ? "Saving character..." : "Finalize character"}
          </button>
        </div>
      </div>
    </section>
  );
}
