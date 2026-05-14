import type { RoleplayCalculationPreview, RoleplayDifficulty } from "@glantri/domain";

import { calculationLineStyle, rollPreviewStyle } from "./roleplayStyles";

function RollCalculationPreview({
  cleanPendingText = false,
  label,
  pendingLabels,
  preview,
  showPendingLabels = true,
}: {
  cleanPendingText?: boolean;
  label: string;
  pendingLabels?: string[];
  preview?: RoleplayCalculationPreview;
  showPendingLabels?: boolean;
}) {
  const formulaText = preview
    ? cleanPendingText
      ? preview.formulaText.replace(" = pending", " = —")
      : preview.formulaText
    : "—";

  return (
    <div style={calculationLineStyle}>
      <strong>{label}:</strong> {formulaText}
      {showPendingLabels && preview && pendingLabels && pendingLabels.length > 0 ? (
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

export function RoleplayRollCalculationPanel({
  actorDifficulty,
  actorLabel = "Actor",
  actorMainPreview,
  actorPendingLabels,
  actorSupportPreview,
  cleanPendingText = false,
  comparison,
  opponentMainPreview,
  opponentLabel = "Opponent",
  opponentOpen,
  opponentPendingLabels,
  showPendingLabels = true,
  opponentSupportPreview,
}: {
  actorDifficulty?: RoleplayDifficulty;
  actorLabel?: string;
  actorMainPreview?: RoleplayCalculationPreview;
  actorPendingLabels?: string[];
  actorSupportPreview?: RoleplayCalculationPreview;
  cleanPendingText?: boolean;
  comparison?: string;
  opponentMainPreview?: RoleplayCalculationPreview;
  opponentLabel?: string;
  opponentOpen: boolean;
  opponentPendingLabels?: string[];
  showPendingLabels?: boolean;
  opponentSupportPreview?: RoleplayCalculationPreview;
}) {
  return (
    <div style={rollPreviewStyle}>
      <strong>Calculation</strong>
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <strong>{actorLabel}</strong>
        <RollCalculationPreview cleanPendingText={cleanPendingText} label="Support" preview={actorSupportPreview} />
        <RollCalculationPreview
          cleanPendingText={cleanPendingText}
          label="Main"
          pendingLabels={actorPendingLabels}
          preview={actorMainPreview}
          showPendingLabels={showPendingLabels}
        />
        <RoleplayRollResultLine difficulty={actorDifficulty} preview={actorMainPreview} />
      </div>
      {opponentOpen ? (
        <div style={{ borderTop: "1px solid #eee8dc", display: "grid", gap: "0.25rem", paddingTop: "0.45rem" }}>
          <strong>{opponentLabel}</strong>
          <RollCalculationPreview cleanPendingText={cleanPendingText} label="Support" preview={opponentSupportPreview} />
          <RollCalculationPreview
            cleanPendingText={cleanPendingText}
            label="Main"
            pendingLabels={opponentPendingLabels}
            preview={opponentMainPreview}
            showPendingLabels={showPendingLabels}
          />
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

export const RoleplayCalculationPanel = RoleplayRollCalculationPanel;
