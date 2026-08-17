"use client";

import type { CombatItemInteractionOptions } from "@/lib/api/encounterClient";

export interface CombatDisarmDeclarationSelection {
  actingItemId: string;
  phase: "phase1" | "phase2";
  targetItemId: string;
  targetParticipantId: string;
}

export function CombatDisarmDeclarationControls(props: {
  actingParticipantId?: string;
  disabled?: boolean;
  method: "proactive" | "reactive_parry";
  onChange: (selection: CombatDisarmDeclarationSelection) => void;
  options?: CombatItemInteractionOptions;
  selection: CombatDisarmDeclarationSelection;
}) {
  const actingActor = props.options?.actors.find(
    (actor) => actor.participantId === props.actingParticipantId,
  );
  const actingWeapons =
    actingActor?.items.filter(
      (item) => item.category === "weapon" && item.weaponDisarm?.capability === "trap",
    ) ?? [];
  const targetActors =
    props.options?.disarmTargets.filter(
      (actor) => actor.participantId !== props.actingParticipantId && actor.items.length > 0,
    ) ?? [];
  const targetActor = targetActors.find(
    (actor) => actor.participantId === props.selection.targetParticipantId,
  );
  const fieldStyle = { display: "grid", gap: "0.2rem" } as const;

  return (
    <section
      aria-label="Disarm declaration"
      style={{
        background: "#f8f6ef",
        border: "1px solid #ded7c7",
        borderRadius: 6,
        display: "grid",
        gap: "0.5rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
        padding: "0.55rem",
      }}
    >
      <strong style={{ gridColumn: "1 / -1" }}>
        {props.method === "proactive" ? "Proactive Disarm" : "Prepared Parry-Disarm"}
      </strong>
      <label style={fieldStyle}>
        <span>Phase</span>
        <select
          disabled={props.disabled}
          onChange={(event) =>
            props.onChange({
              ...props.selection,
              phase: event.target.value as "phase1" | "phase2",
            })
          }
          value={props.selection.phase}
        >
          <option value="phase1">Phase 1</option>
          <option value="phase2">Phase 2</option>
        </select>
      </label>
      <label style={fieldStyle}>
        <span>Trapping weapon</span>
        <select
          disabled={props.disabled || actingWeapons.length === 0}
          onChange={(event) =>
            props.onChange({ ...props.selection, actingItemId: event.target.value })
          }
          value={props.selection.actingItemId}
        >
          <option value="">Choose weapon</option>
          {actingWeapons.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} · control {item.weaponDisarm?.controlRating}
            </option>
          ))}
        </select>
      </label>
      <label style={fieldStyle}>
        <span>Opponent</span>
        <select
          disabled={props.disabled || targetActors.length === 0}
          onChange={(event) =>
            props.onChange({
              ...props.selection,
              targetItemId: "",
              targetParticipantId: event.target.value,
            })
          }
          value={props.selection.targetParticipantId}
        >
          <option value="">Choose opponent</option>
          {targetActors.map((actor) => (
            <option key={actor.participantId} value={actor.participantId}>
              {actor.label}
            </option>
          ))}
        </select>
      </label>
      <label style={fieldStyle}>
        <span>Weapon to disarm</span>
        <select
          disabled={props.disabled || !targetActor}
          onChange={(event) =>
            props.onChange({ ...props.selection, targetItemId: event.target.value })
          }
          value={props.selection.targetItemId}
        >
          <option value="">Choose weapon</option>
          {(targetActor?.items ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} · control {item.weaponDisarm?.controlRating}
            </option>
          ))}
        </select>
      </label>
      {!props.options ? (
        <span style={{ gridColumn: "1 / -1" }}>Loading canonical weapon choices…</span>
      ) : actingWeapons.length === 0 ? (
        <span style={{ color: "#7c2d12", gridColumn: "1 / -1" }}>
          No held weapon has Disarm capability.
        </span>
      ) : null}
    </section>
  );
}
