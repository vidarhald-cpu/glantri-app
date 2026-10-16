import { formatPlayerLabel } from "../chargenWizardHelpers";
import { FeedbackPanel } from "../components";
import type { useChargenWizardState } from "../useChargenWizardState";

const BLOCKING_REASONS_ID = "chargen-finalize-blocking-reasons";

/**
 * The rules engine emits this exact string from `primaryAllocation/review.ts`
 * whenever `coreRouteStatus.isSelectionValid` is false, and that flag covers two
 * structurally different situations: a core-route choice is genuinely owed, or
 * no applicable route exists at all. #635 measured the second situation on
 * Scythians + "Scribe and Copyist", where `applicableRoutes` is empty and the
 * string would instruct the player to select one of zero options.
 *
 * It is therefore withheld in that one situation, and never reworded. The
 * literal is duplicated here only to recognise the engine's own message;
 * `FinalizeStep.rulesBinding.test.ts` fails if the engine stops emitting it.
 */
export const CORE_ROUTE_SELECTION_ERROR =
  "Select one applicable Profession core route before finalizing.";

type State = ReturnType<typeof useChargenWizardState>;

interface FinalizeStepProps {
  characterName: State["characterName"];
  coreRouteStatus: State["coreRouteStatus"];
  currentUser: State["currentUser"];
  handleFinalize: State["handleFinalize"];
  isFinalizing: State["isFinalizing"];
  review: State["review"];
  setCharacterName: State["setCharacterName"];
}

export function FinalizeStep({
  characterName,
  coreRouteStatus,
  currentUser,
  handleFinalize,
  isFinalizing,
  review,
  setCharacterName,
}: FinalizeStepProps) {
  // #636: the step used to gate on `review.canFinalize` alone and never read
  // `review.errors`, so a blocked player saw a disabled button and no reason.
  // These are the reasons the rules engine already produced for this draft;
  // they are surfaced verbatim and nothing here changes what gates finalizing.
  const hasNoApplicableCoreRoute = coreRouteStatus.applicableRoutes.length === 0;
  const blockingReasons = review.canFinalize
    ? []
    : review.errors.filter(
        (error) => !(hasNoApplicableCoreRoute && error === CORE_ROUTE_SELECTION_ERROR),
      );
  return (
    <section
      style={{
        background: "#fbfaf5",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.75rem",
        order: 12,
        padding: "1rem",
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
          padding: "1rem",
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
            aria-describedby={blockingReasons.length > 0 ? BLOCKING_REASONS_ID : undefined}
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
      {blockingReasons.length > 0 ? (
        <div id={BLOCKING_REASONS_ID} role="status">
          <FeedbackPanel messages={blockingReasons} />
        </div>
      ) : null}
    </section>
  );
}
