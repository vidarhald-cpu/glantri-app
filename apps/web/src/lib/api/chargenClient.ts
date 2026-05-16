import type { ChargenRuleSet, ChargenRuleSetParameters } from "@glantri/domain";
import type { ChargenRuleSetStoreResponse } from "@glantri/shared";

import { sendJson } from "./apiClient";

export type { ChargenRuleSetStoreResponse };

export async function loadChargenRuleSets(): Promise<ChargenRuleSetStoreResponse> {
  return sendJson<ChargenRuleSetStoreResponse>("/chargen/rule-sets", {
    method: "GET"
  });
}

export async function loadActiveChargenRuleSet(): Promise<ChargenRuleSet> {
  const payload = await sendJson<{ activeRuleSet: ChargenRuleSet }>("/chargen/rule-sets/active", {
    method: "GET"
  });

  return payload.activeRuleSet;
}

export async function createChargenRuleSet(input: {
  name: string;
  parameters: ChargenRuleSetParameters;
}): Promise<ChargenRuleSetStoreResponse> {
  return sendJson<ChargenRuleSetStoreResponse>("/chargen/rule-sets", {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export async function activateChargenRuleSet(ruleSetId: string): Promise<ChargenRuleSetStoreResponse> {
  return sendJson<ChargenRuleSetStoreResponse>(`/chargen/rule-sets/${ruleSetId}/activate`, {
    body: JSON.stringify({}),
    method: "POST"
  });
}
