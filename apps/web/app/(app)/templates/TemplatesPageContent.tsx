"use client";

import { useEffect, useMemo, useState } from "react";

import type { ReusableEntity } from "@glantri/domain";

import {
  createTemplateOnServer,
  loadTemplates
} from "../../../src/lib/api/localServiceClient";
import { getCampaignActorMetadata } from "../../../src/lib/campaigns/campaignActors";

type TemplateKindFilter = "all" | ReusableEntity["kind"];

export default function TemplatesPageContent() {
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [kind, setKind] = useState<ReusableEntity["kind"]>("npc");
  const [kindFilter, setKindFilter] = useState<TemplateKindFilter>("all");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [tags, setTags] = useState("");
  const [templates, setTemplates] = useState<ReusableEntity[]>([]);

  async function refreshTemplates() {
    const nextTemplates = await loadTemplates();
    setTemplates(nextTemplates.filter((template) => getCampaignActorMetadata(template).actorClass === "template"));
  }

  useEffect(() => {
    refreshTemplates()
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load templates.");
      })
      .finally(() => setLoading(false));
  }, []);

  const visibleTemplates = useMemo(
    () => templates.filter((template) => kindFilter === "all" || template.kind === kindFilter),
    [kindFilter, templates]
  );

  async function handleCreateTemplate() {
    try {
      setError(undefined);
      setFeedback(undefined);

      const template = await createTemplateOnServer({
        description,
        kind,
        name,
        snapshot: {
          actorClass: "template",
          roleLabel: roleLabel.trim() || undefined,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        }
      });

      setFeedback(`Created template ${template.name}.`);
      setName("");
      setDescription("");
      setRoleLabel("");
      setTags("");
      await refreshTemplates();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create template.");
    }
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 980 }}>
      <div>
        <h1 style={{ marginBottom: "0.5rem" }}>Templates</h1>
        <p style={{ margin: 0 }}>
          Reusable library archetypes for NPCs, monsters, and animals. Templates are not specific
          campaign individuals.
        </p>
      </div>

      {error ? <div>{error}</div> : null}
      {feedback ? <div>{feedback}</div> : null}

      <section
        style={{
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Create template</h2>
        <input onChange={(event) => setName(event.target.value)} placeholder="Template name" value={name} />
        <textarea
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description"
          rows={3}
          value={description}
        />
        <select
          onChange={(event) => setKind(event.target.value as ReusableEntity["kind"])}
          value={kind}
        >
          <option value="npc">NPC</option>
          <option value="monster">Monster</option>
          <option value="animal">Animal</option>
        </select>
        <input
          onChange={(event) => setRoleLabel(event.target.value)}
          placeholder="Role or use case (optional)"
          value={roleLabel}
        />
        <input
          onChange={(event) => setTags(event.target.value)}
          placeholder="Tags (comma-separated, optional)"
          value={tags}
        />
        <div>
          <button onClick={() => void handleCreateTemplate()} type="button">
            Create template
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            justifyContent: "space-between"
          }}
        >
          <h2 style={{ margin: 0 }}>Library</h2>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>Type</span>
            <select
              onChange={(event) => setKindFilter(event.target.value as TemplateKindFilter)}
              value={kindFilter}
            >
              <option value="all">All</option>
              <option value="npc">NPC</option>
              <option value="monster">Monster</option>
              <option value="animal">Animal</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div>Loading templates...</div>
        ) : visibleTemplates.length > 0 ? (
          visibleTemplates.map((template) => {
            const metadata = getCampaignActorMetadata(template);

            return (
              <div
                key={template.id}
                style={{
                  border: "1px solid #d9ddd8",
                  borderRadius: 12,
                  display: "grid",
                  gap: "0.35rem",
                  padding: "1rem"
                }}
              >
                <strong>{template.name}</strong>
                <div>{template.kind}</div>
                <div>{template.description || "No description yet."}</div>
                {metadata.roleLabel ? <div>Use: {metadata.roleLabel}</div> : null}
                {metadata.tags?.length ? <div>Tags: {metadata.tags.join(", ")}</div> : null}
              </div>
            );
          })
        ) : (
          <div
            style={{
              background: "#f6f5ef",
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              padding: "1rem"
            }}
          >
            No templates match the current library view.
          </div>
        )}
      </section>
    </section>
  );
}
