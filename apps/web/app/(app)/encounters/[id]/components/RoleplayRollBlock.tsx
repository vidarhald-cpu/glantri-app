import { roleplayDifficultyOptions } from "@glantri/domain";

import { getPlayerFacingSkillBucketDefinitions } from "@/lib/chargen/chargenBrowse";

import { RoleplayCalculationPanel } from "./RoleplayCalculationPanel";
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
} from "./roleplayStyles";
import type {
  RoleplayRollAssignSide,
  RoleplayRollContext,
  RoleplayRollDraft,
  RoleplayRollGmSide,
} from "./roleplayRollTypes";

interface RoleplayRollBlockProps {
  comparison?: string;
  context: RoleplayRollContext;
  draft: RoleplayRollDraft;
  index: number;
  onActorParticipantChange: (draftId: string, participantId: string) => void;
  onAssignSkillRoll: (draft: RoleplayRollDraft, side: RoleplayRollAssignSide) => Promise<void> | void;
  onGmRoll: (draft: RoleplayRollDraft, side: RoleplayRollGmSide) => Promise<void> | void;
  onUpdateRollDraft: (draftId: string, patch: Partial<RoleplayRollDraft>) => void;
  roster: Array<{ id: string; label: string }>;
}

export function RoleplayRollBlock({
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
  const actorLocked = Boolean(draft.actorRoll);
  const opponentLocked = Boolean(draft.opponentRoll);

  return (
    <div style={rollBlockShellStyle}>
      <strong>Roll {index + 1}</strong>
      <section style={rollEditorStyle}>
        <div style={rollControlsStackStyle}>
          <section style={rollControlsStyle}>
            <strong>Actor</strong>
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
                  onChange={(event) => onUpdateRollDraft(draft.id, { otherModInput: event.target.value })}
                  step={1}
                  style={{ ...compactInputStyle, width: "4.5rem" }}
                  type="number"
                  value={draft.otherModInput}
                />
              </label>
            </div>
            <div style={rollFieldRowStyle}>
              <label style={compactControlStyle}>
                <span>Character</span>
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
              </label>
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
                  onChange={(event) => onUpdateRollDraft(draft.id, { skillId: event.target.value })}
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {actorLocked ? <span style={{ color: "#5e5a50" }}>Rolled</span> : null}
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
              <strong>Opponent</strong>
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
                    onChange={(event) => onUpdateRollDraft(draft.id, { opponentOtherModInput: event.target.value })}
                    step={1}
                    style={{ ...compactInputStyle, width: "4.5rem" }}
                    type="number"
                    value={draft.opponentOtherModInput}
                  />
                </label>
              </div>
              <div style={rollFieldRowStyle}>
                <label style={compactControlStyle}>
                  <span>Opponent</span>
                  <select
                    aria-label={`Roleplay roll ${index + 1} opponent block participant`}
                    disabled={opponentLocked}
                    onChange={(event) => {
                      onUpdateRollDraft(draft.id, {
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
                </label>
                <label style={compactControlStyle}>
                  <span>Category</span>
                  <select
                    aria-label={`Roleplay roll ${index + 1} opponent skill category`}
                    disabled={opponentLocked}
                    onChange={(event) => {
                      const nextCategoryId = event.target.value as RoleplayRollDraft["opponentSkillCategoryId"];
                      onUpdateRollDraft(draft.id, {
                        opponentSkillCategoryId: nextCategoryId,
                        opponentRoll: undefined,
                        opponentSkillId: "",
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
                    onChange={(event) => onUpdateRollDraft(draft.id, { opponentSkillId: event.target.value })}
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {opponentLocked ? <span style={{ color: "#5e5a50" }}>Rolled</span> : null}
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
        <RoleplayCalculationPanel
          actorDifficulty={draft.difficulty === "none" || context.isOpposed ? undefined : draft.difficulty}
          actorMainPreview={context.preview}
          actorPendingLabels={context.preview?.pendingModifierLabels}
          actorSupportPreview={context.supportPreview}
          comparison={comparison}
          opponentMainPreview={context.opponentPreview}
          opponentOpen={Boolean(context.opponent && draft.opponentBlockOpen)}
          opponentPendingLabels={context.opponentPreview?.pendingModifierLabels}
          opponentSupportPreview={context.opponentSupportPreview}
        />
      </section>
    </div>
  );
}
