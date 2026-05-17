import type { EncounterParticipant } from "@glantri/domain";
import { roleplayDifficultyOptions } from "@glantri/domain";

import { getPlayerFacingSkillBucketDefinitions } from "@/lib/chargen/chargenBrowse";

import { RoleplayRollCalculationPanel } from "./RoleplayCalculationPanel";
import {
  compactControlStyle,
  compactInputStyle,
  compactSkillInputStyle,
  opponentControlsStyle,
  rollBlockShellStyle,
  rollControlRowStyle,
  rollControlsStackStyle,
  rollControlsStyle,
  rollEditorStyle,
  rollFieldRowStyle,
  rollSkillGridStyle,
} from "./roleplayStyles";
import type {
  RoleplayRollAssignSide,
  RoleplayRollContext,
  RoleplayRollDraft,
  RoleplayRollGmSide,
  SkillOption,
} from "./roleplayRollTypes";

interface RoleplayRollBlockProps {
  applyUnknownSkillDefaultOtherMod: (input: {
    currentValue: string;
    selectedSkill?: SkillOption;
    touched: boolean;
  }) => string;
  comparison?: string;
  context: RoleplayRollContext;
  draft: RoleplayRollDraft;
  index: number;
  onActorParticipantChange: (draftId: string, participantId: string) => void;
  onAssignSkillRoll: (draft: RoleplayRollDraft, side: RoleplayRollAssignSide) => Promise<void> | void;
  onGmRoll: (draft: RoleplayRollDraft, side: RoleplayRollGmSide) => Promise<void> | void;
  onUpdateRollDraft: (draftId: string, patch: Partial<RoleplayRollDraft>) => void;
  roster: EncounterParticipant[];
}

function warningRows(skills: Array<SkillOption | undefined>) {
  return skills
    .filter((skill): skill is SkillOption => Boolean(skill?.warning))
    .map((skill) => (
      <div key={skill.id} style={{ color: "#8a5a00", fontSize: "0.85rem" }}>
        {skill.label}: {skill.warning}
      </div>
    ));
}

export function RoleplayRollBlock({
  applyUnknownSkillDefaultOtherMod,
  comparison,
  context,
  draft,
  index,
  onActorParticipantChange,
  onAssignSkillRoll,
  onGmRoll,
  onUpdateRollDraft,
  roster,
}: RoleplayRollBlockProps) {
  const categoryOptions = getPlayerFacingSkillBucketDefinitions().filter((category) =>
    context.allSkillOptions.some((skill) => skill.categoryId === category.id)
  );
  const supportCategoryOptions = getPlayerFacingSkillBucketDefinitions().filter((category) =>
    context.allSkillOptions.some((skill) => skill.categoryId === category.id)
  );
  const opponentCategoryOptions = getPlayerFacingSkillBucketDefinitions().filter((category) =>
    context.allOpponentSkillOptions.some((skill) => skill.categoryId === category.id)
  );
  const opponentSupportCategoryOptions = getPlayerFacingSkillBucketDefinitions().filter((category) =>
    context.allOpponentSkillOptions.some((skill) => skill.categoryId === category.id)
  );
  const actorLocked = Boolean(draft.actorRoll || context.actorExternalResult);
  const opponentLocked = Boolean(draft.opponentRoll || context.opponentExternalResult);
  const actorStatus = context.actorExternalResult
    ? "Result received"
    : draft.actorRoll
      ? "Rolled"
      : context.matchingPendingRoll
        ? "Assigned · Pending player roll"
        : undefined;
  const opponentStatus = context.opponentExternalResult
    ? "Result received"
    : draft.opponentRoll
      ? "Rolled"
      : context.matchingOpponentPendingRoll
        ? "Assigned · Pending player roll"
        : undefined;

  return (
    <div style={rollBlockShellStyle}>
      <section style={rollEditorStyle}>
        <div style={rollControlsStackStyle}>
          <section style={rollControlsStyle}>
            <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
              <strong>Roll {index + 1}</strong>
              <select
                aria-label={`Roleplay roll ${index + 1} participant`}
                disabled={actorLocked}
                onChange={(event) => onActorParticipantChange(draft.id, event.target.value)}
                style={compactInputStyle}
                value={context.participant?.id ?? ""}
              >
                {roster.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={rollControlRowStyle}>
              <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
                <input
                  checked={draft.silent}
                  disabled={actorLocked}
                  onChange={(event) => onUpdateRollDraft(draft.id, { silent: event.target.checked })}
                  type="checkbox"
                />
                Silent
              </label>
              <span>Use:</span>
              <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
                <input
                  checked={draft.useGenMod}
                  disabled={actorLocked}
                  onChange={(event) => onUpdateRollDraft(draft.id, { useGenMod: event.target.checked })}
                  type="checkbox"
                />
                Gen
              </label>
              <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
                <input
                  checked={draft.useObSkillMod}
                  disabled={actorLocked}
                  onChange={(event) => onUpdateRollDraft(draft.id, { useObSkillMod: event.target.checked })}
                  type="checkbox"
                />
                OB/Skill
              </label>
              <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
                <input
                  checked={draft.useDbMod}
                  disabled={actorLocked}
                  onChange={(event) => onUpdateRollDraft(draft.id, { useDbMod: event.target.checked })}
                  type="checkbox"
                />
                DB
              </label>
              <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
                Other
                <input
                  aria-label={`Roleplay roll ${index + 1} Other mod`}
                  disabled={actorLocked}
                  onChange={(event) =>
                    onUpdateRollDraft(draft.id, {
                      otherModInput: event.target.value,
                      otherModTouched: true,
                    })
                  }
                  step={1}
                  style={{ ...compactInputStyle, width: "4.5rem" }}
                  type="number"
                  value={context.actorOtherModInput}
                />
              </label>
            </div>
            <div style={rollSkillGridStyle}>
              <label style={compactControlStyle}>
                <span>Category</span>
                <select
                  aria-label={`Roleplay roll ${index + 1} skill category`}
                  disabled={actorLocked}
                  onChange={(event) => {
                    const nextCategoryId = event.target.value as RoleplayRollDraft["skillCategoryId"];
                    const nextSkillOptions =
                      nextCategoryId === "all"
                        ? context.allSkillOptions
                        : context.allSkillOptions.filter((skill) => skill.categoryId === nextCategoryId);

                    onUpdateRollDraft(draft.id, {
                      otherModInput: applyUnknownSkillDefaultOtherMod({
                        currentValue: draft.otherModInput,
                        selectedSkill: nextSkillOptions[0],
                        touched: draft.otherModTouched,
                      }),
                      skillCategoryId: nextCategoryId,
                      skillId: nextSkillOptions[0]?.id ?? "",
                    });
                  }}
                  style={compactInputStyle}
                  value={draft.skillCategoryId}
                >
                  <option value="all">All categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={compactControlStyle}>
                <span>Skill</span>
                <select
                  aria-label={`Roleplay roll ${index + 1} skill`}
                  disabled={actorLocked || context.skillOptions.length === 0}
                  onChange={(event) =>
                    onUpdateRollDraft(draft.id, {
                      otherModInput: applyUnknownSkillDefaultOtherMod({
                        currentValue: draft.otherModInput,
                        selectedSkill: context.skillOptions.find((skill) => skill.id === event.target.value),
                        touched: draft.otherModTouched,
                      }),
                      skillId: event.target.value,
                    })
                  }
                  style={compactSkillInputStyle}
                  value={context.selectedSkill?.id ?? ""}
                >
                  {context.skillOptions.length > 0 ? (
                    context.skillOptions.map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {skill.label} ({skill.value ?? 0})
                      </option>
                    ))
                  ) : (
                    <option value="">No skills available</option>
                  )}
                </select>
              </label>
              <label style={compactControlStyle}>
                <span>Support category</span>
                <select
                  aria-label={`Roleplay roll ${index + 1} support skill category`}
                  disabled={actorLocked}
                  onChange={(event) => {
                    const nextCategoryId = event.target.value as RoleplayRollDraft["supportSkillCategoryId"];
                    onUpdateRollDraft(draft.id, {
                      supportSkillCategoryId: nextCategoryId,
                      supportSkillId: "",
                    });
                  }}
                  style={compactInputStyle}
                  value={draft.supportSkillCategoryId}
                >
                  <option value="all">All categories</option>
                  {supportCategoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={compactControlStyle}>
                <span>Support</span>
                <select
                  aria-label={`Roleplay roll ${index + 1} support skill`}
                  disabled={actorLocked}
                  onChange={(event) => onUpdateRollDraft(draft.id, { supportSkillId: event.target.value })}
                  style={compactSkillInputStyle}
                  value={context.selectedSupportSkill?.id ?? ""}
                >
                  <option value="">No support skill</option>
                  {context.supportSkillOptions.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.label} ({skill.value ?? 0})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={rollFieldRowStyle}>
              <label style={compactControlStyle}>
                <span>Level</span>
                <select
                  aria-label={`Roleplay roll ${index + 1} difficulty`}
                  disabled={actorLocked}
                  onChange={(event) => {
                    const nextDifficulty = event.target.value as RoleplayRollDraft["difficulty"];
                    onUpdateRollDraft(draft.id, {
                      difficulty: nextDifficulty,
                      opponentBlockOpen: nextDifficulty === "none" ? draft.opponentBlockOpen : false,
                      opponentOtherModInput: nextDifficulty === "none" ? draft.opponentOtherModInput : "0",
                      opponentOtherModTouched: nextDifficulty === "none" ? draft.opponentOtherModTouched : false,
                      opponentParticipantId: nextDifficulty === "none" ? draft.opponentParticipantId : "",
                      opponentRoll: undefined,
                      opponentSkillCategoryId: "all",
                      opponentSkillId: "",
                      opponentSupportSkillCategoryId: "all",
                      opponentSupportSkillId: "",
                    });
                  }}
                  style={compactInputStyle}
                  value={draft.difficulty}
                >
                  <option value="none">No level</option>
                  {roleplayDifficultyOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={compactControlStyle}>
                <span>Opponent</span>
                <select
                  aria-label={`Roleplay roll ${index + 1} opponent`}
                  disabled={actorLocked}
                  onChange={(event) => {
                    onUpdateRollDraft(draft.id, {
                      difficulty: "none",
                      opponentBlockOpen: Boolean(event.target.value) && draft.opponentBlockOpen,
                      opponentOtherModInput: "0",
                      opponentOtherModTouched: false,
                      opponentParticipantId: event.target.value,
                      opponentRoll: undefined,
                      opponentSkillCategoryId: "all",
                      opponentSkillId: "",
                      opponentSupportSkillCategoryId: "all",
                      opponentSupportSkillId: "",
                    });
                  }}
                  style={compactInputStyle}
                  value={context.opponent?.id ?? ""}
                >
                  <option value="">No opponent</option>
                  {roster.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {warningRows([context.selectedSkill, context.selectedSupportSkill])}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {actorStatus ? <span style={{ color: "#5e5a50" }}>{actorStatus}</span> : null}
              {!context.opponent || draft.opponentBlockOpen ? (
                <button
                  disabled={actorLocked || !context.participant || !context.selectedSkill}
                  onClick={() => void onAssignSkillRoll(draft, "actor")}
                  type="button"
                >
                  Assign
                </button>
              ) : null}
              {!context.opponent || draft.opponentBlockOpen ? (
                <button
                  disabled={actorLocked || !context.participant || !context.selectedSkill}
                  onClick={() => void onGmRoll(draft, "actor")}
                  type="button"
                >
                  GM Roll
                </button>
              ) : !draft.opponentBlockOpen ? (
                <button
                  disabled={actorLocked || !context.opponent}
                  onClick={() => {
                    onUpdateRollDraft(draft.id, {
                      opponentBlockOpen: true,
                      opponentSkillId: "",
                      opponentRoll: undefined,
                    });
                  }}
                  type="button"
                >
                  Open opponent block
                </button>
              ) : null}
            </div>
            {context.isOpposed ? (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <button
                  disabled={
                    actorLocked ||
                    opponentLocked ||
                    !context.participant ||
                    !context.selectedSkill ||
                    !context.selectedOpponentSkill
                  }
                  onClick={() => void onGmRoll(draft, "both")}
                  type="button"
                >
                  GM Roll both
                </button>
              </div>
            ) : null}
          </section>
          {context.opponent && draft.opponentBlockOpen ? (
            <section style={opponentControlsStyle}>
              <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
                <strong>Opponent</strong>
                <select
                  aria-label={`Roleplay roll ${index + 1} opponent block participant`}
                  disabled={opponentLocked}
                  onChange={(event) => {
                    onUpdateRollDraft(draft.id, {
                      opponentOtherModInput: "0",
                      opponentOtherModTouched: false,
                      opponentParticipantId: event.target.value,
                      opponentRoll: undefined,
                      opponentSkillCategoryId: "all",
                      opponentSkillId: "",
                      opponentSupportSkillCategoryId: "all",
                      opponentSupportSkillId: "",
                    });
                  }}
                  style={compactInputStyle}
                  value={context.opponent.id}
                >
                  {roster.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={rollControlRowStyle}>
                <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
                  <input
                    checked={draft.opponentSilent}
                    disabled={opponentLocked}
                    onChange={(event) => onUpdateRollDraft(draft.id, { opponentSilent: event.target.checked })}
                    type="checkbox"
                  />
                  Silent
                </label>
                <span>Use:</span>
                <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
                  <input
                    checked={draft.opponentUseGenMod}
                    disabled={opponentLocked}
                    onChange={(event) => onUpdateRollDraft(draft.id, { opponentUseGenMod: event.target.checked })}
                    type="checkbox"
                  />
                  Gen
                </label>
                <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
                  <input
                    checked={draft.opponentUseObSkillMod}
                    disabled={opponentLocked}
                    onChange={(event) => onUpdateRollDraft(draft.id, { opponentUseObSkillMod: event.target.checked })}
                    type="checkbox"
                  />
                  OB/Skill
                </label>
                <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
                  <input
                    checked={draft.opponentUseDbMod}
                    disabled={opponentLocked}
                    onChange={(event) => onUpdateRollDraft(draft.id, { opponentUseDbMod: event.target.checked })}
                    type="checkbox"
                  />
                  DB
                </label>
                <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
                  Other
                  <input
                    aria-label={`Roleplay roll ${index + 1} opponent Other mod`}
                    disabled={opponentLocked}
                    onChange={(event) =>
                      onUpdateRollDraft(draft.id, {
                        opponentOtherModInput: event.target.value,
                        opponentOtherModTouched: true,
                      })
                    }
                    step={1}
                    style={{ ...compactInputStyle, width: "4.5rem" }}
                    type="number"
                    value={context.opponentOtherModInput}
                  />
                </label>
              </div>
              <div style={rollSkillGridStyle}>
                <label style={compactControlStyle}>
                  <span>Category</span>
                  <select
                    aria-label={`Roleplay roll ${index + 1} opponent skill category`}
                    disabled={opponentLocked}
                    onChange={(event) => {
                      const nextCategoryId = event.target.value as RoleplayRollDraft["opponentSkillCategoryId"];
                      const nextSkillOptions =
                        nextCategoryId === "all"
                          ? context.allOpponentSkillOptions
                          : context.allOpponentSkillOptions.filter((skill) => skill.categoryId === nextCategoryId);
                      onUpdateRollDraft(draft.id, {
                        opponentOtherModInput: applyUnknownSkillDefaultOtherMod({
                          currentValue: draft.opponentOtherModInput,
                          selectedSkill: nextSkillOptions[0],
                          touched: draft.opponentOtherModTouched,
                        }),
                        opponentRoll: undefined,
                        opponentSkillCategoryId: nextCategoryId,
                        opponentSkillId: nextSkillOptions[0]?.id ?? "",
                      });
                    }}
                    style={compactInputStyle}
                    value={draft.opponentSkillCategoryId}
                  >
                    <option value="all">All categories</option>
                    {opponentCategoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={compactControlStyle}>
                  <span>Skill</span>
                  <select
                    aria-label={`Roleplay roll ${index + 1} opponent skill`}
                    disabled={opponentLocked || context.opponentSkillOptions.length === 0}
                    onChange={(event) =>
                      onUpdateRollDraft(draft.id, {
                        opponentOtherModInput: applyUnknownSkillDefaultOtherMod({
                          currentValue: draft.opponentOtherModInput,
                          selectedSkill: context.opponentSkillOptions.find((skill) => skill.id === event.target.value),
                          touched: draft.opponentOtherModTouched,
                        }),
                        opponentSkillId: event.target.value,
                      })
                    }
                    style={compactSkillInputStyle}
                    value={context.selectedOpponentSkill?.id ?? ""}
                  >
                    <option value="">Choose skill</option>
                    {context.opponentSkillOptions.length > 0 ? (
                      context.opponentSkillOptions.map((skill) => (
                        <option key={skill.id} value={skill.id}>
                          {skill.label} ({skill.value ?? 0})
                        </option>
                      ))
                    ) : (
                      <option value="">No opponent skill</option>
                    )}
                  </select>
                </label>
                <label style={compactControlStyle}>
                  <span>Support category</span>
                  <select
                    aria-label={`Roleplay roll ${index + 1} opponent support skill category`}
                    disabled={opponentLocked}
                    onChange={(event) => {
                      const nextCategoryId = event.target.value as RoleplayRollDraft["opponentSupportSkillCategoryId"];
                      onUpdateRollDraft(draft.id, {
                        opponentSupportSkillCategoryId: nextCategoryId,
                        opponentSupportSkillId: "",
                      });
                    }}
                    style={compactInputStyle}
                    value={draft.opponentSupportSkillCategoryId}
                  >
                    <option value="all">All categories</option>
                    {opponentSupportCategoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={compactControlStyle}>
                  <span>Support</span>
                  <select
                    aria-label={`Roleplay roll ${index + 1} opponent support skill`}
                    disabled={opponentLocked}
                    onChange={(event) => onUpdateRollDraft(draft.id, { opponentSupportSkillId: event.target.value })}
                    style={compactSkillInputStyle}
                    value={context.selectedOpponentSupportSkill?.id ?? ""}
                  >
                    <option value="">No support skill</option>
                    {context.opponentSupportSkillOptions.map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {skill.label} ({skill.value ?? 0})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {warningRows([context.selectedOpponentSkill, context.selectedOpponentSupportSkill])}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {opponentStatus ? <span style={{ color: "#5e5a50" }}>{opponentStatus}</span> : null}
                <button
                  disabled={opponentLocked || !context.opponent || !context.selectedOpponentSkill}
                  onClick={() => void onAssignSkillRoll(draft, "opponent")}
                  type="button"
                >
                  Assign
                </button>
                <button
                  disabled={opponentLocked || !context.opponent || !context.selectedOpponentSkill}
                  onClick={() => void onGmRoll(draft, "opponent")}
                  type="button"
                >
                  GM Roll
                </button>
              </div>
            </section>
          ) : null}
        </div>
        <RoleplayRollCalculationPanel
          actorDifficulty={draft.difficulty === "none" || context.isOpposed ? undefined : draft.difficulty}
          actorLabel={`Actor — ${context.participant?.label ?? "Actor"}`}
          actorMainPreview={context.preview}
          actorPendingLabels={context.preview?.pendingModifierLabels}
          actorSupportPreview={context.supportPreview}
          comparison={comparison}
          opponentMainPreview={context.opponentPreview}
          opponentLabel={`Opponent — ${context.opponent?.label ?? "Opponent"}`}
          opponentOpen={Boolean(context.opponent && draft.opponentBlockOpen)}
          opponentPendingLabels={context.opponentPreview?.pendingModifierLabels}
          opponentSupportPreview={context.opponentSupportPreview}
        />
      </section>
    </div>
  );
}
