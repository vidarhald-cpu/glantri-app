export function isCombatViewRevisionAtLeast(input: {
  acceptedUpdatedAt?: string;
  candidateUpdatedAt?: string;
}): boolean {
  if (!input.acceptedUpdatedAt || !input.candidateUpdatedAt) return true;
  return Date.parse(input.candidateUpdatedAt) >= Date.parse(input.acceptedUpdatedAt);
}

export function isCombatViewRevisionUnchanged(input: {
  acceptedUpdatedAt?: string;
  candidateUpdatedAt?: string;
}): boolean {
  return Boolean(input.acceptedUpdatedAt && input.candidateUpdatedAt === input.acceptedUpdatedAt);
}
