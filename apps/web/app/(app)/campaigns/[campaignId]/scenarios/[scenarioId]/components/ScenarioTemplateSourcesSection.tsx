"use client";

import type { ScenarioParticipant } from "@glantri/domain";

import type { TemplateSource } from "./scenarioScreenTypes";

interface ScenarioTemplateSourcesSectionProps {
  onCreateTemporaryActor: () => void;
  onSelectedTemplateSourceIdChange: (value: string) => void;
  onTemporaryActorCountChange: (value: number) => void;
  onTemporaryActorNameChange: (value: string) => void;
  onTemporaryActorRoleChange: (value: ScenarioParticipant["role"]) => void;
  selectedTemplateSource?: TemplateSource;
  temporaryActorCount: number;
  temporaryActorName: string;
  temporaryActorRole: ScenarioParticipant["role"];
  templateSources: TemplateSource[];
}

export function ScenarioTemplateSourcesSection({
  onCreateTemporaryActor,
  onSelectedTemplateSourceIdChange,
  onTemporaryActorCountChange,
  onTemporaryActorNameChange,
  onTemporaryActorRoleChange,
  selectedTemplateSource,
  temporaryActorCount,
  temporaryActorName,
  temporaryActorRole,
  templateSources
}: ScenarioTemplateSourcesSectionProps) {
  return (
    <section
      style={{
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.75rem",
        padding: "1rem"
      }}
    >
      <h2 style={{ margin: 0 }}>Template sources</h2>
      <p style={{ margin: 0 }}>
        Templates create scenario-local temporary actors. The template itself is not an active
        scenario participant.
      </p>
      {templateSources.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            maxHeight: "28rem",
            overflowY: "auto"
          }}
        >
          <select
            onChange={(event) => onSelectedTemplateSourceIdChange(event.target.value)}
            style={{ minWidth: 240 }}
            value={selectedTemplateSource?.entity.id ?? ""}
          >
            {templateSources.map((source) => (
              <option key={source.entity.id} value={source.entity.id}>
                {source.label}
              </option>
            ))}
          </select>
          <input
            onChange={(event) => onTemporaryActorNameChange(event.target.value)}
            placeholder="Temporary actor name override"
            style={{ minWidth: 240 }}
            value={temporaryActorName}
          />
          <select
            onChange={(event) => onTemporaryActorRoleChange(event.target.value as ScenarioParticipant["role"])}
            value={temporaryActorRole}
          >
            <option value="npc">NPC</option>
            <option value="monster">Monster</option>
            <option value="animal">Animal</option>
            <option value="neutral">Neutral</option>
            <option value="ally">Ally</option>
            <option value="enemy">Enemy</option>
          </select>
          <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
            <span>Count</span>
            <input
              aria-label="Temporary actor count"
              max={1}
              min={1}
              onChange={(event) =>
                onTemporaryActorCountChange(Math.min(1, Math.max(1, Number(event.target.value) || 1)))
              }
              style={{ width: "4rem" }}
              title="Bulk temporary actor creation is planned; this pass supports one actor at a time."
              type="number"
              value={temporaryActorCount}
            />
          </label>
          <button onClick={onCreateTemporaryActor} type="button">
            Create temporary actor
          </button>
        </div>
      ) : (
        <div>No template sources are available.</div>
      )}
    </section>
  );
}
