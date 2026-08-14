"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  CombatGenericAction,
  CombatGenericActionDuration,
  EncounterSession,
  GlantriCharacteristicKey,
  ScenarioParticipant,
  SkillDefinition,
} from "@glantri/domain";

import { updateGenericCombatActionOnServer } from "@/lib/api/localServiceClient";

const panelStyle = {
  background: "#f6f5ef",
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  boxSizing: "border-box",
  display: "grid",
  gap: "0.75rem",
  maxWidth: "calc(100vw - 2rem)",
  minWidth: 0,
  overflowWrap: "anywhere",
  padding: "1rem",
  width: "100%",
} as const;

const STAT_OPTIONS: Array<{ id: GlantriCharacteristicKey; label: string }> = [
  { id: "cha", label: "Charisma" },
  { id: "com", label: "Comeliness" },
  { id: "con", label: "Constitution" },
  { id: "dex", label: "Dexterity" },
  { id: "health", label: "Health" },
  { id: "int", label: "Intelligence" },
  { id: "lck", label: "Luck" },
  { id: "pow", label: "Power" },
  { id: "siz", label: "Size" },
  { id: "str", label: "Strength" },
  { id: "will", label: "Willpower" },
];

function makeActionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `combat-action-${Date.now()}-${Math.random()}`;
}

function durationLabel(duration: CombatGenericActionDuration): string {
  if (duration.kind === "phase") return duration.phase === "phase1" ? "Phase 1" : "Phase 2";
  if (duration.kind === "round") return "One round";
  if (duration.kind === "rounds") return `${duration.rounds} rounds`;
  return "GM decides";
}

function statusLabel(status: CombatGenericAction["status"]): string {
  return {
    active: "Active",
    cancelled: "Cancelled",
    completed: "Completed",
    declared: "Waiting for GM review",
    interrupted: "Interrupted",
    reviewed: "Reviewed",
  }[status];
}

function itemOptions(participant?: ScenarioParticipant): Array<{ id: string; label: string }> {
  const equipmentState = participant?.snapshot.equipmentState;
  if (!equipmentState || typeof equipmentState !== "object") return [];
  const state = equipmentState as {
    itemsById?: Record<string, { id?: string; name?: string; templateId?: string }>;
    templates?: { templatesById?: Record<string, { name?: string }> };
    templatesById?: Record<string, { name?: string }>;
  };
  const templates = state.templates?.templatesById ?? state.templatesById ?? {};
  return Object.entries(state.itemsById ?? {}).map(([id, item]) => ({
    id,
    label:
      item.name?.trim() ||
      (item.templateId ? templates[item.templateId]?.name : undefined) ||
      "Item",
  }));
}

export interface GenericCombatActionPanelProps {
  encounter: EncounterSession;
  isGm: boolean;
  onEncounterUpdated: (encounter: EncounterSession) => void;
  participantId?: string;
  scenarioParticipants: readonly ScenarioParticipant[];
  skills?: readonly Pick<SkillDefinition, "id" | "name">[];
}

export function GenericCombatActionPanel({
  encounter,
  isGm,
  onEncounterUpdated,
  participantId,
  scenarioParticipants,
  skills = [],
}: GenericCombatActionPanelProps) {
  const actions = encounter.combatRoundState?.genericActions ?? [];
  const [actionId, setActionId] = useState(makeActionId);
  const [preset, setPreset] = useState<"look_around" | "other">("look_around");
  const [intent, setIntent] = useState("");
  const [durationKind, setDurationKind] = useState<CombatGenericActionDuration["kind"]>("round");
  const [durationPhase, setDurationPhase] = useState<"phase1" | "phase2">("phase1");
  const [rounds, setRounds] = useState(2);
  const [rollKind, setRollKind] = useState<"none" | "skill" | "stat">("skill");
  const [skillId, setSkillId] = useState("perception");
  const [statId, setStatId] = useState<GlantriCharacteristicKey>("con");
  const [difficulty, setDifficulty] = useState(26);
  const [referenceKind, setReferenceKind] = useState<
    "none" | "participant" | "item" | "environment"
  >("none");
  const [referenceParticipantId, setReferenceParticipantId] = useState("");
  const [itemId, setItemId] = useState("");
  const [environmentDescription, setEnvironmentDescription] = useState("");
  const [selectedActionId, setSelectedActionId] = useState(actions[0]?.id ?? "");
  const [reviewDurationKind, setReviewDurationKind] =
    useState<CombatGenericActionDuration["kind"]>("round");
  const [reviewDurationPhase, setReviewDurationPhase] = useState<"phase1" | "phase2">("phase1");
  const [reviewRounds, setReviewRounds] = useState(2);
  const [reviewDifficulty, setReviewDifficulty] = useState(26);
  const [resultText, setResultText] = useState("");
  const [resultAudience, setResultAudience] = useState<string[]>(
    participantId ? [participantId] : [],
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const selectedAction = actions.find((action) => action.id === selectedActionId) ?? actions[0];
  const ownerScenarioParticipant = scenarioParticipants.find((candidate) =>
    encounter.participants.some(
      (member) =>
        member.id === participantId &&
        (member.scenarioParticipantId === candidate.id ||
          member.characterId === candidate.characterId),
    ),
  );
  const canonicalItems = useMemo(
    () => itemOptions(ownerScenarioParticipant),
    [ownerScenarioParticipant],
  );
  const participantOptions = encounter.combatRoundState?.participants ?? [];

  useEffect(() => {
    if (!selectedAction) return;
    setSelectedActionId(selectedAction.id);
    setReviewDurationKind(selectedAction.duration.kind);
    setReviewDurationPhase(
      selectedAction.duration.kind === "phase" ? selectedAction.duration.phase : "phase1",
    );
    setReviewRounds(selectedAction.duration.kind === "rounds" ? selectedAction.duration.rounds : 2);
    setReviewDifficulty(selectedAction.rollRequest?.difficulty ?? 26);
    setResultAudience([selectedAction.ownerParticipantId]);
  }, [selectedAction]);

  const buildDuration = (
    kind: CombatGenericActionDuration["kind"],
    count: number,
    phase: "phase1" | "phase2",
  ): CombatGenericActionDuration =>
    kind === "phase"
      ? { kind, phase }
      : kind === "rounds"
        ? { kind, rounds: Math.max(2, count) }
        : { kind };

  async function mutate(input: Parameters<typeof updateGenericCombatActionOnServer>[0]) {
    setBusy(true);
    setFeedback(undefined);
    try {
      const next = await updateGenericCombatActionOnServer(input);
      onEncounterUpdated(next);
      setFeedback("Combat action updated.");
      return next;
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to update the Combat action.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function declareAction() {
    if (!participantId) return;
    const chosenRollKind = preset === "look_around" ? "skill" : rollKind;
    const next = await mutate({
      actionId,
      difficulty: chosenRollKind === "none" ? undefined : difficulty,
      duration: buildDuration(durationKind, rounds, durationPhase),
      encounterId: encounter.id,
      environmentDescription: referenceKind === "environment" ? environmentDescription : undefined,
      expectedRevision: encounter.updatedAt,
      intent,
      itemId: referenceKind === "item" ? itemId : undefined,
      operation: "declare",
      participantId,
      preset: preset === "look_around" ? "look_around" : undefined,
      referenceKind: referenceKind === "none" ? undefined : referenceKind,
      referenceParticipantId: referenceKind === "participant" ? referenceParticipantId : undefined,
      rollKind: chosenRollKind === "none" ? undefined : chosenRollKind,
      skillId:
        chosenRollKind === "skill"
          ? preset === "look_around"
            ? "perception"
            : skillId
          : undefined,
      statId: chosenRollKind === "stat" ? statId : undefined,
    });
    if (next) {
      setActionId(makeActionId());
      setIntent("");
    }
  }

  async function operate(
    operation: "review" | "activate" | "roll" | "resolve" | "interrupt" | "cancel",
  ) {
    if (!selectedAction) return;
    await mutate({
      actionId: selectedAction.id,
      difficulty: operation === "review" ? reviewDifficulty : undefined,
      duration:
        operation === "review"
          ? buildDuration(reviewDurationKind, reviewRounds, reviewDurationPhase)
          : undefined,
      encounterId: encounter.id,
      expectedRevision: encounter.updatedAt,
      operation,
      preset: selectedAction.preset,
      resultText: operation === "resolve" ? resultText : undefined,
      rollKind: operation === "review" ? selectedAction.rollRequest?.basis.kind : undefined,
      skillId:
        operation === "review" && selectedAction.rollRequest?.basis.kind === "skill"
          ? selectedAction.rollRequest.basis.skillId
          : undefined,
      statId:
        operation === "review" && selectedAction.rollRequest?.basis.kind === "stat"
          ? selectedAction.rollRequest.basis.statId
          : undefined,
      visibleToParticipantIds: operation === "resolve" ? resultAudience : undefined,
    });
  }

  return (
    <section aria-labelledby="generic-combat-action-heading" style={panelStyle}>
      <h2 id="generic-combat-action-heading" style={{ margin: 0 }}>
        Actions and tasks
      </h2>
      <div>
        Describe a deliberate action. A roll measures the attempt; only the GM decides what it
        reveals or changes.
      </div>

      {!isGm || participantId ? (
        <div style={{ display: "grid", gap: "0.65rem" }}>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>Generic action</span>
            <select
              value={preset}
              onChange={(event) => {
                const next = event.target.value as "look_around" | "other";
                setPreset(next);
                if (next === "look_around") {
                  setRollKind("skill");
                  setSkillId("perception");
                }
              }}
            >
              <option value="look_around">Look around</option>
              <option value="other">Other action</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>What do you intend to do?</span>
            <textarea
              maxLength={2000}
              onChange={(event) => setIntent(event.target.value)}
              rows={3}
              value={intent}
            />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <label>
              <span>Time </span>
              <select
                value={durationKind}
                onChange={(event) =>
                  setDurationKind(event.target.value as CombatGenericActionDuration["kind"])
                }
              >
                <option value="phase">One phase</option>
                <option value="round">One round</option>
                <option value="rounds">Several rounds</option>
                <option value="gm_decided">GM decides</option>
              </select>
            </label>
            {durationKind === "phase" ? (
              <label>
                <span>Phase </span>
                <select
                  onChange={(event) => setDurationPhase(event.target.value as "phase1" | "phase2")}
                  value={durationPhase}
                >
                  <option value="phase1">Phase 1</option>
                  <option value="phase2">Phase 2</option>
                </select>
              </label>
            ) : null}
            {durationKind === "rounds" ? (
              <label>
                <span>Rounds </span>
                <input
                  min={2}
                  onChange={(event) => setRounds(Number(event.target.value))}
                  type="number"
                  value={rounds}
                />
              </label>
            ) : null}
            {preset !== "look_around" ? (
              <label>
                <span>Roll </span>
                <select
                  value={rollKind}
                  onChange={(event) => setRollKind(event.target.value as typeof rollKind)}
                >
                  <option value="none">No roll</option>
                  <option value="skill">Skill</option>
                  <option value="stat">Stat</option>
                </select>
              </label>
            ) : (
              <strong>Perception</strong>
            )}
            {preset === "look_around" || rollKind !== "none" ? (
              <label>
                <span>Difficulty </span>
                <input
                  aria-label="Action Difficulty"
                  min={1}
                  max={200}
                  onChange={(event) => setDifficulty(Number(event.target.value))}
                  type="number"
                  value={difficulty}
                />
              </label>
            ) : null}
          </div>
          {preset !== "look_around" && rollKind === "skill" ? (
            <label>
              <span>Skill </span>
              <select value={skillId} onChange={(event) => setSkillId(event.target.value)}>
                {skills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {preset !== "look_around" && rollKind === "stat" ? (
            <label>
              <span>Stat </span>
              <select
                value={statId}
                onChange={(event) => setStatId(event.target.value as GlantriCharacteristicKey)}
              >
                {STAT_OPTIONS.map((stat) => (
                  <option key={stat.id} value={stat.id}>
                    {stat.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            <span>Reference </span>
            <select
              value={referenceKind}
              onChange={(event) => setReferenceKind(event.target.value as typeof referenceKind)}
            >
              <option value="none">None</option>
              <option value="participant">Participant</option>
              <option value="item">Item</option>
              <option value="environment">Environment</option>
            </select>
          </label>
          {referenceKind === "participant" ? (
            <select
              aria-label="Referenced participant"
              value={referenceParticipantId}
              onChange={(event) => setReferenceParticipantId(event.target.value)}
            >
              <option value="">Choose participant</option>
              {participantOptions.map((entry) => (
                <option key={entry.participantId} value={entry.participantId}>
                  {entry.label}
                </option>
              ))}
            </select>
          ) : null}
          {referenceKind === "item" ? (
            <select
              aria-label="Referenced Item"
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
            >
              <option value="">Choose Item</option>
              {canonicalItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          ) : null}
          {referenceKind === "environment" ? (
            <input
              aria-label="Environment reference"
              maxLength={500}
              onChange={(event) => setEnvironmentDescription(event.target.value)}
              value={environmentDescription}
            />
          ) : null}
          <button
            disabled={busy || !intent.trim()}
            onClick={() => void declareAction()}
            type="button"
          >
            Declare generic action
          </button>
        </div>
      ) : null}

      {actions.length > 0 ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <label>
            <span>Current task </span>
            <select
              value={selectedAction?.id ?? ""}
              onChange={(event) => {
                const action = actions.find((candidate) => candidate.id === event.target.value);
                setSelectedActionId(event.target.value);
                if (action) {
                  setReviewDurationKind(action.duration.kind);
                  setReviewDurationPhase(
                    action.duration.kind === "phase" ? action.duration.phase : "phase1",
                  );
                  setReviewRounds(action.duration.kind === "rounds" ? action.duration.rounds : 2);
                  setReviewDifficulty(action.rollRequest?.difficulty ?? 26);
                  setResultAudience([action.ownerParticipantId]);
                }
              }}
            >
              {actions.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.intent}
                </option>
              ))}
            </select>
          </label>
          {selectedAction ? (
            <article style={{ display: "grid", gap: "0.4rem" }}>
              <strong>
                {selectedAction.preset === "look_around" ? "Look around" : selectedAction.intent}
              </strong>
              {selectedAction.preset === "look_around" ? <div>{selectedAction.intent}</div> : null}
              <div>
                {statusLabel(selectedAction.status)} · {durationLabel(selectedAction.duration)}
              </div>
              {selectedAction.rollRequest ? (
                <div>
                  {selectedAction.rollRequest.basis.kind === "skill"
                    ? selectedAction.rollRequest.basis.skillLabel
                    : selectedAction.rollRequest.basis.statLabel}{" "}
                  · Difficulty {selectedAction.rollRequest.difficulty}
                </div>
              ) : (
                <div>No roll</div>
              )}
              {selectedAction.progress.totalRounds ? (
                <div>
                  Progress: {selectedAction.progress.completedRounds} of{" "}
                  {selectedAction.progress.totalRounds} rounds
                </div>
              ) : null}
              {selectedAction.reference ? (
                <div>
                  Reference:{" "}
                  {selectedAction.reference.kind === "environment"
                    ? selectedAction.reference.description
                    : selectedAction.reference.label}
                </div>
              ) : null}
              {selectedAction.rollResult ? (
                <div>
                  Roll: {selectedAction.rollResult.calculationText} ·{" "}
                  {selectedAction.rollResult.success ? "Success" : "Not successful"}
                </div>
              ) : null}
              {selectedAction.resolution ? (
                <div>
                  <strong>Result:</strong> {selectedAction.resolution.text}
                </div>
              ) : null}
              {isGm && selectedAction.status === "declared" ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  <select
                    aria-label="Reviewed duration"
                    value={reviewDurationKind}
                    onChange={(event) =>
                      setReviewDurationKind(
                        event.target.value as CombatGenericActionDuration["kind"],
                      )
                    }
                  >
                    <option value="phase">One phase</option>
                    <option value="round">One round</option>
                    <option value="rounds">Several rounds</option>
                    <option value="gm_decided">GM decides</option>
                  </select>
                  {reviewDurationKind === "phase" ? (
                    <select
                      aria-label="Reviewed phase"
                      onChange={(event) =>
                        setReviewDurationPhase(event.target.value as "phase1" | "phase2")
                      }
                      value={reviewDurationPhase}
                    >
                      <option value="phase1">Phase 1</option>
                      <option value="phase2">Phase 2</option>
                    </select>
                  ) : null}
                  {reviewDurationKind === "rounds" ? (
                    <input
                      aria-label="Reviewed rounds"
                      min={2}
                      onChange={(event) => setReviewRounds(Number(event.target.value))}
                      type="number"
                      value={reviewRounds}
                    />
                  ) : null}
                  {selectedAction.rollRequest ? (
                    <input
                      aria-label="Reviewed Difficulty"
                      min={1}
                      max={200}
                      onChange={(event) => setReviewDifficulty(Number(event.target.value))}
                      type="number"
                      value={reviewDifficulty}
                    />
                  ) : null}
                  <button disabled={busy} onClick={() => void operate("review")} type="button">
                    Review action
                  </button>
                </div>
              ) : null}
              {isGm && selectedAction.status === "reviewed" ? (
                <button disabled={busy} onClick={() => void operate("activate")} type="button">
                  Start action
                </button>
              ) : null}
              {selectedAction.status === "active" &&
              selectedAction.rollRequest &&
              !selectedAction.rollResult ? (
                <button disabled={busy} onClick={() => void operate("roll")} type="button">
                  Roll{" "}
                  {selectedAction.rollRequest.basis.kind === "skill"
                    ? selectedAction.rollRequest.basis.skillLabel
                    : selectedAction.rollRequest.basis.statLabel}
                </button>
              ) : null}
              {isGm && selectedAction.status === "active" ? (
                <div style={{ display: "grid", gap: "0.4rem" }}>
                  <label>
                    <span>Player-safe result</span>
                    <textarea
                      maxLength={4000}
                      onChange={(event) => setResultText(event.target.value)}
                      rows={3}
                      value={resultText}
                    />
                  </label>
                  <fieldset>
                    <legend>Who receives this result?</legend>
                    {participantOptions.map((entry) => (
                      <label key={entry.participantId} style={{ marginRight: "0.75rem" }}>
                        <input
                          checked={resultAudience.includes(entry.participantId)}
                          onChange={(event) =>
                            setResultAudience((current) =>
                              event.target.checked
                                ? [...new Set([...current, entry.participantId])]
                                : current.filter((id) => id !== entry.participantId),
                            )
                          }
                          type="checkbox"
                        />{" "}
                        {entry.label}
                      </label>
                    ))}
                  </fieldset>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    <button
                      disabled={busy || !resultText.trim()}
                      onClick={() => void operate("resolve")}
                      type="button"
                    >
                      Resolve action
                    </button>
                    <button disabled={busy} onClick={() => void operate("interrupt")} type="button">
                      Interrupt
                    </button>
                    <button disabled={busy} onClick={() => void operate("cancel")} type="button">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          ) : null}
        </div>
      ) : (
        <div>No actions or tasks have been declared.</div>
      )}
      {feedback ? <div role="status">{feedback}</div> : null}
    </section>
  );
}
