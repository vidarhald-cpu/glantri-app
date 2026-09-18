import Link from "next/link";

import type { CharacterRecoveryEnvelope } from "../offline/glantriDexie";
import {
  formatCharacterRecoveryField,
  getCharacterRecoveryCandidateRevision,
} from "../offline/repositories/characterRecoveryRepository";

interface CharacterRecoveryCandidateListProps {
  envelope: CharacterRecoveryEnvelope;
  onDiscard?: (candidateAttemptId: string, candidateRevision: string) => void;
  onReview?: (candidateAttemptId: string) => void;
  reviewHref?: string;
  reviewingCandidateAttemptId?: string;
}

export function CharacterRecoveryCandidateList({
  envelope,
  onDiscard,
  onReview,
  reviewHref,
  reviewingCandidateAttemptId,
}: CharacterRecoveryCandidateListProps) {
  const candidates = envelope.competingCandidates ?? [];

  if (candidates.length === 0) {
    return null;
  }

  return (
    <div aria-label="Competing recovery candidates" style={{ display: "grid", gap: "0.75rem" }}>
      {candidates.map((candidate) => {
        const fields = [
          ...new Set(candidate.patch.map((entry) => formatCharacterRecoveryField(entry.path))),
        ];
        const reviewing = reviewingCandidateAttemptId === candidate.saveAttempt.id;

        return (
          <section
            key={candidate.saveAttempt.id}
            style={{
              background: "#fffdf8",
              border: "1px solid #dfc98e",
              borderRadius: 10,
              display: "grid",
              gap: "0.5rem",
              padding: "0.75rem",
            }}
          >
            <strong>Competing rejected save — {fields.join(", ")}</strong>
            <span>
              {candidate.relationshipToPrimary === "overlapping"
                ? "This candidate changes a field also changed by the primary recovery. It requires an explicit choice and is never merged automatically."
                : "This candidate changes fields separate from the primary recovery. It remains separate until you deliberately resolve it."}
            </span>
            <span>
              From {candidate.sourceSurface} · {candidate.sourceAction} ·{" "}
              {new Date(candidate.saveAttempt.attemptedAt).toLocaleString()} ·{" "}
              {candidate.reconciliation === "conflict"
                ? "Conflict needs review"
                : "Ready for review"}
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              {onReview ? (
                <button
                  disabled={reviewing}
                  onClick={() => onReview(candidate.saveAttempt.id)}
                  type="button"
                >
                  {reviewing ? "Reviewing rejected candidate" : "Review rejected candidate"}
                </button>
              ) : reviewHref ? (
                <Link href={reviewHref}>Review rejected candidate</Link>
              ) : null}
              {onDiscard ? (
                <button
                  onClick={() =>
                    onDiscard(
                      candidate.saveAttempt.id,
                      getCharacterRecoveryCandidateRevision(candidate),
                    )
                  }
                  type="button"
                >
                  Discard rejected candidate
                </button>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
