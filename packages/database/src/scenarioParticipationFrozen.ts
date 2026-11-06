/**
 * The refusal a Scenario participation write gets from a running Encounter (#845, ruling #850).
 *
 * It lives in its own module because both sides need it and neither may import the other: the
 * repository throws it, and `services/scenarioService.ts` — which the repository is imported *by*
 * — re-exports it so an API route can answer `409` with its message instead of flattening it into
 * a generic `400`. A class in either of those files would be a cycle.
 *
 * Deliberately not one of `ScenarioPersistenceError`'s codes. Both of those mean "someone else
 * wrote first", and a client may retry them. This is not a race: it holds for as long as the
 * Encounter is running, the retry that fixes it is a different action, and the message says which.
 */
export class ScenarioParticipationFrozenError extends Error {
  constructor(
    readonly code: "encounter_participant_set_frozen",
    message: string,
    /** The running Encounters that hold this participant, for evidence rather than for display. */
    readonly encounterIds: readonly string[],
  ) {
    super(message);
    this.name = "ScenarioParticipationFrozenError";
  }
}
