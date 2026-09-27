import type { ChargenGroupTrainingCostShift } from "@glantri/rules-engine";

export interface TrainingCostChange {
  previousTotal: number;
  shift: Exclude<ChargenGroupTrainingCostShift, "ordinary">;
  total: number;
}

/**
 * Shown when a Learning Group training change moved this build's training cost the opposite
 * way to the training itself. Every such movement comes from the way training in one Skill
 * carries over to related Skills, so the points needed elsewhere in the build change with it
 * (canonical rule 2; rule decision 0011). This is a different rule from the one that makes a
 * single rank free because stronger training already teaches the same Skill, and the wording
 * here must not be read as citing that one (Product Owner ruling, 2026-09-27, on #385-QA-5).
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
        ? "This training also improves related skills, so some points previously needed elsewhere are no longer needed."
        : "Removing this training also removes its benefit to related skills, so more points are needed elsewhere."}
    </div>
  );
}
