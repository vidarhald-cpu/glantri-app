import { CharacterRecoveryAttemptChangedError } from "../offline/repositories/characterRecoveryRepository";

export interface CharacterRecoverySaveFailure<T> {
  competingAttempt: boolean;
  displayedValue: T;
}

export function resolveCharacterRecoverySaveFailure<T>(
  error: unknown,
  attemptedValue: T,
  canonicalValue: T,
): CharacterRecoverySaveFailure<T> {
  const competingAttempt = error instanceof CharacterRecoveryAttemptChangedError;

  return {
    competingAttempt,
    displayedValue: competingAttempt ? attemptedValue : canonicalValue,
  };
}

export function formatCharacterRecoveryCompetition(hasRetainedAttempt: boolean): string {
  return hasRetainedAttempt
    ? "Another recovery attempt for this Character won in another tab. Your changes were not saved and remain in this form. Review or discard the competing recovery before retrying."
    : "Character recovery changed in another tab. Your changes were not saved and remain in this form. Reload before retrying.";
}
