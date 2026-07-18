export interface AdjustDistanceAdjustmentDraft {
  note: string;
  participantId: string;
  value: string;
}

export interface AdjustDistanceAdjustmentDraftHandle {
  getDraft: () => AdjustDistanceAdjustmentDraft;
}

export interface AdjustDistanceGmAdjustmentRequest {
  notes?: string;
  participantId?: string;
  value: number;
}

/**
 * Build the API request from the draft that was visible at confirmation time.
 * Blank and non-numeric values intentionally remain invalid numbers so the
 * server can return the canonical integer-validation error.
 */
export function buildAdjustDistanceGmAdjustmentRequest(
  draft: AdjustDistanceAdjustmentDraft,
): AdjustDistanceGmAdjustmentRequest {
  const valueText = draft.value.trim();
  return {
    notes: draft.note.trim() || undefined,
    participantId: draft.participantId || undefined,
    value: valueText === "" ? Number.NaN : Number(valueText),
  };
}
