import type { ChargenGroupTrainingCostShift } from "@glantri/rules-engine";

export interface TrainingCostChange {
  previousTotal: number;
  shift: Exclude<ChargenGroupTrainingCostShift, "ordinary">;
  total: number;
}

/**
 * Shown when a Learning Group training change moved this build's training cost the opposite
 * way to the training itself. Rule decision 0011 makes that canonical: overlapping training
 * does not stack, so new training can supply competence earlier training was priced for.
 *
 * The visible result must never be simply "added training, points spent went down", so this
 * carries the before and after cost together with the reason (Product Owner ruling,
 * 2026-09-27). The classification itself comes from the rules layer; nothing here re-derives
 * it, and nothing here uses implementation vocabulary
 * (`docs/product/chargen-competency-experience-contract.md` section 2).
 */
export function TrainingCostChangeNotice({ change }: { change: TrainingCostChange }) {
  const reduced = change.shift === "reduced-by-overlap";

  return (
    <div
      role="status"
      style={{
        borderTop: "1px solid #e7e2d7",
        color: "#4a4638",
        fontSize: "0.85rem",
        marginTop: "0.35rem",
        paddingTop: "0.35rem",
      }}
    >
      <strong>
        {reduced ? "Training cost went down" : "Training cost went up"}: {change.previousTotal}{" "}
        &rarr; {change.total} ordinary points.
      </strong>{" "}
      {reduced
        ? "Overlapping training does not stack. The new training covers ground the earlier training was already priced for, so this build costs less than before."
        : "Overlapping training does not stack. With that training gone there is less overlap left, so the rest of this build costs more than before."}
    </div>
  );
}
