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

/** Keeps a previously accepted encounter when an overlapping refresh resolves out of order. */
export function selectLatestCombatViewRevision<T extends { readonly updatedAt: string }>(input: {
  accepted?: T;
  candidate: T;
}): T {
  if (
    input.accepted &&
    !isCombatViewRevisionAtLeast({
      acceptedUpdatedAt: input.accepted.updatedAt,
      candidateUpdatedAt: input.candidate.updatedAt,
    })
  ) {
    return input.accepted;
  }

  return input.candidate;
}
