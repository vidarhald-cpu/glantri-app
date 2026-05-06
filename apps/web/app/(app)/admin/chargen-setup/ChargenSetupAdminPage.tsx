"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_CHARGEN_RULE_SET,
  type ChargenRuleSet,
  type ChargenRuleSetParameters
} from "@glantri/domain";

import {
  activateChargenRuleSet,
  createChargenRuleSet,
  loadChargenRuleSets,
  type ChargenRuleSetStoreResponse
} from "../../../../src/lib/api/localServiceClient";
import { useCanAccessAdmin } from "../../../../src/lib/auth/SessionUserContext";
import {
  AdminButton,
  AdminMetric,
  AdminPageIntro,
  AdminPanel,
  AdminReadOnlyNotice,
  AdminStatusBadge,
  formatAdminTimestamp
} from "../admin-ui";

type RuleSetFormState = ChargenRuleSetParameters & {
  name: string;
};

function buildFormState(ruleSet: ChargenRuleSet): RuleSetFormState {
  return {
    exchangeCount: ruleSet.exchangeCount,
    flexiblePointFactor: ruleSet.flexiblePointFactor,
    name: `Copy of ${ruleSet.name}`,
    ordinarySkillPoints: ruleSet.ordinarySkillPoints,
    statRollCount: ruleSet.statRollCount
  };
}

function parseNumber(value: string): number {
  return Number(value);
}

function validateForm(form: RuleSetFormState): string | null {
  if (!form.name.trim()) {
    return "Rule set name is required.";
  }

  if (!Number.isInteger(form.statRollCount) || form.statRollCount < 1 || form.statRollCount > 50) {
    return "Stat roll count must be an integer from 1 to 50.";
  }

  if (!Number.isInteger(form.exchangeCount) || form.exchangeCount < 0 || form.exchangeCount > 50) {
    return "Exchange count must be an integer from 0 to 50.";
  }

  if (
    !Number.isInteger(form.ordinarySkillPoints) ||
    form.ordinarySkillPoints < 0 ||
    form.ordinarySkillPoints > 500
  ) {
    return "Ordinary skill points must be an integer from 0 to 500.";
  }

  if (!Number.isFinite(form.flexiblePointFactor) || form.flexiblePointFactor <= 0 || form.flexiblePointFactor > 5) {
    return "Flexible point factor must be greater than 0 and no more than 5.";
  }

  return null;
}

export default function ChargenSetupAdminPage() {
  const canEdit = useCanAccessAdmin();
  const [store, setStore] = useState<ChargenRuleSetStoreResponse>({
    activeRuleSet: DEFAULT_CHARGEN_RULE_SET,
    ruleSets: [DEFAULT_CHARGEN_RULE_SET]
  });
  const [form, setForm] = useState<RuleSetFormState>(buildFormState(DEFAULT_CHARGEN_RULE_SET));
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadChargenRuleSets()
      .then((loadedStore) => {
        if (cancelled) {
          return;
        }

        setStore(loadedStore);
        setForm(buildFormState(loadedStore.activeRuleSet));
      })
      .catch((error) => {
        if (!cancelled) {
          setFeedback(error instanceof Error ? error.message : "Unable to load chargen rule sets.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateRuleSet() {
    const validationError = validateForm(form);

    if (validationError) {
      setFeedback(validationError);
      return;
    }

    setSaving(true);

    try {
      const updatedStore = await createChargenRuleSet({
        name: form.name,
        parameters: {
          exchangeCount: form.exchangeCount,
          flexiblePointFactor: form.flexiblePointFactor,
          ordinarySkillPoints: form.ordinarySkillPoints,
          statRollCount: form.statRollCount
        }
      });

      setStore(updatedStore);
      setForm(buildFormState(updatedStore.activeRuleSet));
      setFeedback(`Created rule set "${form.name.trim()}". Activate it when ready.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to create rule set.");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivateRuleSet(ruleSetId: string) {
    setSaving(true);

    try {
      const updatedStore = await activateChargenRuleSet(ruleSetId);

      setStore(updatedStore);
      setForm(buildFormState(updatedStore.activeRuleSet));
      setFeedback(`Activated "${updatedStore.activeRuleSet.name}".`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to activate rule set.");
    } finally {
      setSaving(false);
    }
  }

  const activeRuleSet = store.activeRuleSet;

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Chargen Setup"
        summary="Manage named chargen rule sets. Chargen uses the active set, while finalized characters keep a snapshot of the set they used."
        title="Chargen Setup"
      />

      <AdminPanel
        subtitle="The active rule set is the default for new Chargen sessions. Existing characters keep their recorded snapshot."
        title="Active Rule Set"
      >
        {loading ? (
          <div>Loading rule sets...</div>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <AdminStatusBadge tone="success">Active</AdminStatusBadge>
              <strong>{activeRuleSet.name}</strong>
            </div>
            <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
              <AdminMetric label="Stat rolls" value={activeRuleSet.statRollCount} />
              <AdminMetric label="Exchanges" value={activeRuleSet.exchangeCount} />
              <AdminMetric label="Ordinary points" value={activeRuleSet.ordinarySkillPoints} />
              <AdminMetric label="Flexible factor" value={activeRuleSet.flexiblePointFactor} />
            </div>
          </div>
        )}
      </AdminPanel>

      <AdminPanel
        subtitle="Create a new rule set rather than editing historical ones in place. The form starts as a copy of the active rule set."
        title="Create Rule Set"
      >
        <div style={{ display: "grid", gap: "0.85rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            Name
            <input
              disabled={!canEdit || saving}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              value={form.name}
            />
          </label>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            3d6 stat roll count
            <input
              disabled={!canEdit || saving}
              min={1}
              max={50}
              onChange={(event) =>
                setForm((current) => ({ ...current, statRollCount: parseNumber(event.target.value) }))
              }
              type="number"
              value={form.statRollCount}
            />
          </label>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            Stat exchanges
            <input
              disabled={!canEdit || saving}
              min={0}
              max={50}
              onChange={(event) =>
                setForm((current) => ({ ...current, exchangeCount: parseNumber(event.target.value) }))
              }
              type="number"
              value={form.exchangeCount}
            />
          </label>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            Ordinary skill points
            <input
              disabled={!canEdit || saving}
              min={0}
              max={500}
              onChange={(event) =>
                setForm((current) => ({ ...current, ordinarySkillPoints: parseNumber(event.target.value) }))
              }
              type="number"
              value={form.ordinarySkillPoints}
            />
          </label>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            Flexible point factor
            <input
              disabled={!canEdit || saving}
              max={5}
              min={0.1}
              onChange={(event) =>
                setForm((current) => ({ ...current, flexiblePointFactor: parseNumber(event.target.value) }))
              }
              step={0.1}
              type="number"
              value={form.flexiblePointFactor}
            />
          </label>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1rem" }}>
          <AdminButton disabled={!canEdit || saving} onClick={() => void handleCreateRuleSet()}>
            Create Rule Set
          </AdminButton>
          <AdminButton
            disabled={saving}
            onClick={() => setForm(buildFormState(activeRuleSet))}
            variant="ghost"
          >
            Copy Active Values
          </AdminButton>
        </div>
        {!canEdit ? (
          <div style={{ marginTop: "1rem" }}>
            <AdminReadOnlyNotice message="Only Admin and GM roles can create or activate chargen rule sets." />
          </div>
        ) : null}
        {feedback ? <div style={{ color: "#5f543a", marginTop: "0.85rem" }}>{feedback}</div> : null}
      </AdminPanel>

      <AdminPanel
        subtitle="Historical rule sets remain visible so old character assumptions can be reviewed."
        title="Rule Set History"
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", minWidth: 760, width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(85, 73, 48, 0.14)", textAlign: "left" }}>
                <th style={{ padding: "0.55rem 0.75rem 0.55rem 0" }}>Name</th>
                <th style={{ padding: "0.55rem 0.75rem 0.55rem 0" }}>Stat rolls</th>
                <th style={{ padding: "0.55rem 0.75rem 0.55rem 0" }}>Exchanges</th>
                <th style={{ padding: "0.55rem 0.75rem 0.55rem 0" }}>Ordinary</th>
                <th style={{ padding: "0.55rem 0.75rem 0.55rem 0" }}>Flexible factor</th>
                <th style={{ padding: "0.55rem 0.75rem 0.55rem 0" }}>Created</th>
                <th style={{ padding: "0.55rem 0.75rem 0.55rem 0" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {store.ruleSets.map((ruleSet) => (
                <tr key={ruleSet.id} style={{ borderBottom: "1px solid rgba(85, 73, 48, 0.08)" }}>
                  <td style={{ padding: "0.65rem 0.75rem 0.65rem 0" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      <strong>{ruleSet.name}</strong>
                      {ruleSet.isActive ? <AdminStatusBadge tone="success">Active</AdminStatusBadge> : null}
                    </div>
                  </td>
                  <td style={{ padding: "0.65rem 0.75rem 0.65rem 0" }}>{ruleSet.statRollCount}</td>
                  <td style={{ padding: "0.65rem 0.75rem 0.65rem 0" }}>{ruleSet.exchangeCount}</td>
                  <td style={{ padding: "0.65rem 0.75rem 0.65rem 0" }}>{ruleSet.ordinarySkillPoints}</td>
                  <td style={{ padding: "0.65rem 0.75rem 0.65rem 0" }}>{ruleSet.flexiblePointFactor}</td>
                  <td style={{ padding: "0.65rem 0.75rem 0.65rem 0" }}>
                    {formatAdminTimestamp(ruleSet.createdAt)}
                  </td>
                  <td style={{ padding: "0.65rem 0.75rem 0.65rem 0" }}>
                    {ruleSet.isActive ? (
                      "Current"
                    ) : (
                      <AdminButton
                        disabled={!canEdit || saving}
                        onClick={() => void handleActivateRuleSet(ruleSet.id)}
                        variant="secondary"
                      >
                        Activate
                      </AdminButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </section>
  );
}
