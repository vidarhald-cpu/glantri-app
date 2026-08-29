# Retained Character Ledger and Headless Chargen

## Status and authority

This is the canonical current-behavior reference for retained Characters created through the
headless Pilot foundation. It consumes, without duplicating, [Pilot Skill Rules v1](./pilot-skill-rules-v1.md)
and the [Pilot Skill Content Release v1](./pilot-skill-content-release-v1.md).

Every retained revision pins:

- rules identity `pilot-skill-rules/v1`;
- release identity `content-release:pilot-skills:1`;
- content version `pilot-skills-content/1.0.1`;
- content digest `sha256:f524303b274b546c42daac06b65403957e896f35609d42ce7456ff5781c9f419`;
- the complete Formation/Flex, starting-language, progression, migration, and visibility
  configuration snapshot and its digest; and
- the Character revision, acquisition-ledger, and effective-Skill read-model contract versions.

Missing pinned authority fails closed. A historical Character or snapshot is never silently
recalculated with the newest release.

## Acquisition ledger

Finalization commits immutable events for the starting spoken-language grant, every acquired
learning history, direct Skill ranks, and explicitly acquired Specializations. Each event records
the actor/authority, source and event-time label, target, before/after value, phase, pinned version
envelope, economics or prerequisite evidence where applicable, visibility, and protected
provenance separately from the public explanation.

Learning-history advancement, GM adjustments, migration, rollback, and Profession context changes
append new events and a new Character revision. They never edit or delete the original event.
Relationship-derived competence is calculated and is never written as acquired ranks.

Profession is context only. Changing it creates a context-history revision but leaves histories,
direct ranks, grants, Specialization ownership, costs, relationships, and effective Skills
unchanged.

## Authoritative effective Skill

For every concrete Skill, spoken language, written tradition, and Specialization the server emits
one versioned row:

```text
strongest history G = highest owned history level containing the competency
acquired base A = direct acquisition + explicit grants + G
relationship floor R = strongest floor-rounded incoming Pilot v1 relationship sourced from A
effective Skill E = max(A, R)
relationship-derived contribution = max(0, R - A)
```

All owned history candidates remain in the row. The strongest is identified; every weaker overlap
is retained as suppressed with zero incremental competence. Direct ranks stack on the strongest
history. Pilot v1 remains explicit-directional and non-recursive.

Specialization ownership starts only after positive explicit acquisition. Prerequisite competence
or an incoming relationship may explain eligibility or a candidate, but it cannot create ownership.
An unowned Specialization therefore remains effective `0`.

## Headless finalization and commands

Headless Chargen accepts a normal validated Character build plus one retained Character identity
from the canonical release and a complete configuration snapshot. It validates the mandatory
background/society spoken-language grant, canonical Pilot costs, and Formation/Flex budgets before
one atomic save.

An identical retry with the same idempotency key and payload returns the committed result. Reusing
the key with changed input conflicts. Advancement, Profession context changes, migration apply,
and rollback require the exact current Character revision; stale work writes nothing and must be
re-previewed.

A current Campaign GM or admin may advance an owned history instance. The event records before and
after levels and the marginal Pilot v1 group cost. Original levels, member selections, price facts,
and historical snapshots remain unchanged.

## One active Campaign

A canonical Character has at most one current Campaign roster membership. PostgreSQL enforces the
cross-Campaign uniqueness for Character roster rows, so racing joins cannot create dual
membership. The owner may leave and the current Campaign GM may remove the Character. Only after
that row is removed may another Campaign add it. Scenario, Encounter, and accepted roll snapshots
from the prior Campaign remain immutable.

## Required migration maintenance and lineage

Migration preview is non-mutating and bound to the exact current revision, target envelope, expiry,
and digest. For an actively rostered Character, the current Campaign GM (or audited admin) applies
accepted required maintenance. For an unrostered Character, its owner or an admin may apply it.
This maintenance is not a permanent per-player version fork.

Apply creates a new revision and migration event while retaining the source revision and all
historical acquisitions. Exact rollback is another appended revision and is available only while
the migration revision remains current; later events require a new superseding migration plan so
they cannot be discarded silently.

## Historical snapshots and privacy

New Scenario participant snapshots may pin the exact retained Character revision sequence,
effective-Skill digest, rules identity, and content identity/digest. Later advancement, migration,
rollback, leave, or live Character deletion does not retarget that snapshot. Older snapshot v1
records remain legacy snapshots and are interpreted only from their captured values.

The server projects provenance by perspective:

- owner: own acquisition explanation, excluding unrevealed GM-only/protected payloads;
- current Campaign GM and admin: authorized full audit detail;
- another entitled player: effective value/band and neutral prior-experience wording only;
- uninvolved player: no retained Character projection.

Teacher/contact identities, criminal or secret histories, restricted texts/institutions,
biography details, event counts, private costs, and the existence of a protected source are not
sent merely because they explain a visible competence value.
