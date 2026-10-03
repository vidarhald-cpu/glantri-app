import type { CombatRoundEndPublicMoment } from "@glantri/domain";

const momentLabels: Record<CombatRoundEndPublicMoment["kind"], string> = {
  active_timed_effect: "Active timed effect",
  countdown_checkpoint: "Countdown / checkpoint",
  expiration: "Expiration",
  due_check: "Check due",
  result: "Result",
};

export function RoundEndEffectsChronology(input: {
  moments: readonly CombatRoundEndPublicMoment[];
}) {
  if (input.moments.length === 0) return null;

  return (
    <section aria-label="Round End Effects chronology" style={{ display: "grid", gap: "0.3rem" }}>
      <strong>Round End Effects</strong>
      <ol style={{ margin: 0, paddingLeft: "1.2rem" }}>
        {input.moments.map((moment) => (
          <li key={moment.key}>
            <span style={{ color: "#5e5a50" }}>{momentLabels[moment.kind]}: </span>
            <span>{moment.label}</span>
            {moment.previous || moment.next ? (
              <span>
                {" · "}
                {moment.previous ?? "—"}
                {moment.next ? ` → ${moment.next}` : ""}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
