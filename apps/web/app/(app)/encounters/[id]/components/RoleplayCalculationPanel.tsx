import type { RoleplayCalculationPreview, RoleplayDifficulty } from "@glantri/domain";

import { calculationLineStyle, rollPreviewStyle } from "./roleplayStyles";

function RollCalculationPreview({
  label,
  pendingLabels,
  preview,
}: {
  label: string;
  pendingLabels?: string[];
  preview?: RoleplayCalculationPreview;
}) {
  return (
    <div style={calculationLineStyle}>
      <strong>{label}:</strong> {preview?.formulaText ?? "—"}
      {preview && pendingLabels && pendingLabels.length > 0 ? (
        <span> · Pending: {pendingLabels.join(", ")}</span>
      ) : null}
    </div>
  );
}

function getPreviewResultLabel(input: {
  comparison?: string;
  difficulty?: RoleplayDifficulty;
  preview?: RoleplayCalculationPreview;
}): string {
  if (input.comparison) {
    return input.comparison;
  }

  const preview = input.preview;

  if (!preview) {
    return "—";
  }

  if (preview.fumble) {
    return preview.resultText ?? "FUMBLE";
  }

  if (preview.autoSuccess) {
    return preview.resultText ?? "Automatic success";
  }

  if (preview.resultText) {
    return preview.resultText;
  }

  return preview.achievedSuccessLevel?.label ?? "—";
}

function RoleplayRollResultLine({
  comparison,
  difficulty,
  label = "Result",
  preview,
}: {
  comparison?: string;
  difficulty?: RoleplayDifficulty;
  label?: string;
  preview?: RoleplayCalculationPreview;
}) {
  return <div><strong>{label}:</strong> {getPreviewResultLabel({ comparison, difficulty, preview })}</div>;
}

export function RoleplayCalculationPanel({
  actorDifficulty,
  actorMainPreview,
  actorPendingLabels,
  actorSupportPreview,
  comparison,
  opponentMainPreview,
  opponentOpen,
  opponentPendingLabels,
  opponentSupportPreview,
}: {
  actorDifficulty?: RoleplayDifficulty;
  actorMainPreview?: RoleplayCalculationPreview;
  actorPendingLabels?: string[];
  actorSupportPreview?: RoleplayCalculationPreview;
  comparison?: string;
  opponentMainPreview?: RoleplayCalculationPreview;
  opponentOpen: boolean;
  opponentPendingLabels?: string[];
  opponentSupportPreview?: RoleplayCalculationPreview;
}) {
  return (
    <div style={rollPreviewStyle}>
      <strong>Calculation</strong>
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <strong>Actor</strong>
        <RollCalculationPreview label="Support" preview={actorSupportPreview} />
        <RollCalculationPreview label="Main" pendingLabels={actorPendingLabels} preview={actorMainPreview} />
        <RoleplayRollResultLine difficulty={actorDifficulty} preview={actorMainPreview} />
      </div>
      {opponentOpen ? (
        <div style={{ borderTop: "1px solid #eee8dc", display: "grid", gap: "0.25rem", paddingTop: "0.45rem" }}>
          <strong>Opponent</strong>
          <RollCalculationPreview label="Support" preview={opponentSupportPreview} />
          <RollCalculationPreview label="Main" pendingLabels={opponentPendingLabels} preview={opponentMainPreview} />
          <RoleplayRollResultLine preview={opponentMainPreview} />
        </div>
      ) : null}
      {comparison ? (
        <div style={{ borderTop: "1px solid #eee8dc", paddingTop: "0.45rem" }}>
          <RoleplayRollResultLine comparison={comparison} label="Comparison" />
        </div>
      ) : null}
    </div>
  );
}
