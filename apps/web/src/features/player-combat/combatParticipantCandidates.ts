import { getCombatDistanceParticipantAliases } from "@glantri/domain";

export interface CombatParticipantRosterEntry {
  characterId?: string;
  id: string;
  label: string;
  scenarioParticipantId?: string;
}

export type CombatParticipantCandidatePurpose =
  | "attack_target"
  | "maneuver_target"
  | "distance_opponent"
  | "parry_source"
  | "effect_target"
  | "gm_participant_selector"
  | "player_perspective_selector";

export interface CombatParticipantCandidate {
  participantId: string;
  characterId?: string;
  displayName: string;
  relationship: "self" | "ally" | "opponent" | "neutral" | "unknown";
  visible: boolean;
  targetable: boolean;
  selectable: boolean;
  disabledReason?: string;
}

export interface CombatParticipantCandidateInput {
  activeParticipantIds?: ReadonlySet<string>;
  actingParticipantId?: string;
  allowedParticipantIds?: ReadonlySet<string> | readonly string[];
  encounter: { participants: readonly CombatParticipantRosterEntry[] };
  phase?: "phase1" | "phase2";
  purpose: CombatParticipantCandidatePurpose;
  revision?: string;
  viewerParticipantId?: string;
  visibleParticipantIds?: ReadonlySet<string>;
}

function aliasesForParticipant(participant: CombatParticipantRosterEntry): string[] {
  return getCombatDistanceParticipantAliases(participant);
}

function aliasesInclude(aliases: readonly string[], id: string | undefined): boolean {
  return Boolean(id && aliases.includes(id));
}

function asSet(
  values: ReadonlySet<string> | readonly string[] | undefined,
): ReadonlySet<string> | undefined {
  return values ? (values instanceof Set ? values : new Set(values)) : undefined;
}

/**
 * Projects selectable combat participants from the encounter roster only.
 *
 * Declaration state, combat-log events and current tasks are intentionally not
 * inputs: a legal opponent must be available while the declaration window is
 * open.  The encounter response is already viewer-safe; the optional visible
 * alias set preserves any finer-grained visibility policy without coupling
 * candidates to progression.
 */
export function buildCombatParticipantCandidates(
  input: CombatParticipantCandidateInput,
): CombatParticipantCandidate[] {
  const allowed = asSet(input.allowedParticipantIds);
  const active = asSet(input.activeParticipantIds);
  const visible = input.visibleParticipantIds;

  return input.encounter.participants
    .map((participant) => {
      const aliases = aliasesForParticipant(participant);
      const isSelf = aliasesInclude(aliases, input.actingParticipantId);
      const isVisible = !visible || aliases.some((alias) => visible.has(alias));
      const isAllowed = !allowed || aliases.some((alias) => allowed.has(alias));
      const isActive = !active || aliases.some((alias) => active.has(alias));
      const targetPurpose =
        input.purpose === "attack_target" ||
        input.purpose === "maneuver_target" ||
        input.purpose === "distance_opponent" ||
        input.purpose === "effect_target" ||
        input.purpose === "parry_source";
      const targetable = targetPurpose && !isSelf && isVisible && isAllowed && isActive;
      const selectable = isVisible && isAllowed && isActive && (!targetPurpose || !isSelf);

      return {
        characterId: participant.characterId,
        disabledReason: !isVisible
          ? "Hidden from this viewer"
          : !isActive
            ? "Inactive participant"
            : !isAllowed
              ? "Not part of this encounter"
              : targetPurpose && isSelf
                ? "Cannot target self"
                : undefined,
        displayName: participant.label,
        participantId: participant.id,
        relationship: isSelf ? "self" : "opponent",
        selectable,
        targetable,
        visible: isVisible,
      } satisfies CombatParticipantCandidate;
    })
    .sort((left, right) => {
      const byName = left.displayName.localeCompare(right.displayName);
      return byName || left.participantId.localeCompare(right.participantId);
    });
}
