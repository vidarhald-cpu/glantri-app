# Combat Action Rule Inventory

Source document: `docs/source/combat/merged_3968_3980.pdf`

Status: extraction and classification only. Do not implement directly from this document without a follow-up formula/table verification pass against the scanned source pages.

## Extraction Notes

- The source PDF is a 13-page scanned/image PDF. Local text extraction was not available, so this inventory was made from visual page review.
- Page references below use the PDF image page number. The first page is the table of contents; the source text itself begins on PDF page 2.
- Some source tables are partially cut at page edges or continue between pages. Those entries are marked as requiring a second-pass transcription before implementation.
- This document intentionally separates action declaration concepts from resolution rules, because the current app is still building declaration and round-manager workflows before full attack resolution.

## Rule Categories

| Category | Source pages | Implementation meaning |
| --- | --- | --- |
| General combat state | PDF pp. 2-5 | Round timing, phases, OB/DB/Parry modifier semantics, initiative, combat experience, perception |
| Single-round actions | PDF pp. 5-10 | Full-round or one-step actions such as parry, observe, disarm, counter, disengage |
| Two-part actions | PDF pp. 10-12 | Phase 1 / Phase 2 action pairs |
| Extra actions | PDF p. 13 | Concurrent/supporting actions such as speaking and supplemental body-part actions |
| Tables needing canonical data | PDF pp. 4, 6-11 | Combat experience, observe-opponent, offensive parry, disarm, disengage, parry-attack initiative, feint |

## General Combat Rules

| Rule | Source | Classification | Extracted behavior | Implementation status |
| --- | --- | --- | --- | --- |
| OB, DB, and Parry modifiers | PDF p. 2 | Core modifier model | Combat values represent ideal conditions. Situational problems usually reduce OB, DB, or Parry. Modifiers are cumulative and applied to original values through the percentage modifier model. | Partially implemented for encounter-context live modifiers. Needs source-backed review before more combat resolution. |
| Attack defense penalty | PDF p. 2 | Phase modifier | A character who attacks receives a `-4%` DB/Parry modifier during the phase in which the attack occurs. The source applies this broadly against melee, and notes Parry interaction with missiles. | Partially implemented as declaration-generated DB/Parry modifiers for Attack - Parry phase 1 and Parry - Attack phase 2. Needs full action inventory review before broad application. |
| Missile defense | PDF p. 2 | Defense modifier | Dodging missile attacks normally has a `-4%` DB modifier. Cover, such as a shield, can improve the total modifier. | Not implemented. Needs missile/cover model. |
| Body-part prioritization | PDF pp. 2-3 | Defensive declaration / hit-location interaction | Defender can prioritize protection of a body part by choosing a DB bonus from 1 to 4, with a corresponding penalty elsewhere. The modifier depends on what the attacker aimed at or, if no target was declared, a pre-attack random hit-location roll. | Not implemented. Related to current hit-location declaration helpers, but requires a separate protection-priority model. |
| Rounds and phases | PDF p. 3 | Round structure | Combat rounds are about 3 seconds and have Phase 1 and Phase 2. Most characters normally choose one action per round; two-part actions split across phases. | Implemented structurally in round manager. |
| Extra actions | PDF p. 3 and p. 13 | Concurrent action class | Extra actions can occur alongside main actions and may modify main actions or be modified by them. | Not implemented beyond declaration notes. |
| Combat experience | PDF pp. 3-4 | Round-start stress/readiness rule | Characters may roll combat experience at the start of combat. Result can cause panic/passivity or active states with modifiers and later rerolls. Critical damage or similar events can force a new roll. | Not implemented. |
| Initiative | PDF p. 4 | Phase ordering | Initiative is rolled separately for phases when needed. Phase 1 handles single actions and first halves of two-part actions; Phase 2 handles second halves. | Partially implemented with open-ended d6 and ranking in round manager. Needs source reconciliation for final initiative dice/formula. |
| Simultaneous attacks | PDF p. 4 | Clash / morale rule | If two characters attack each other in the same phase, initiative difference determines whether one or both roll Combat Experience or Willpower. The result modifies OB or may prevent the attack. | Not implemented. |
| Perception in combat | PDF pp. 4-5 | Awareness rule | Perception is a normal skill check modified by combat experience, distraction level, and a usual `-4%` modifier when doing non-extra actions. | Not implemented as combat workflow. |

## Single-Round Actions

| Action | Source | Classification | Phase/timing | Extracted behavior | Tables / data needed |
| --- | --- | --- | --- | --- | --- |
| Observer motstander | PDF pp. 5-6 | Single-round assessment action | Whole round; may combine with parry or direct counter | Character observes an opponent to find a weak point. If the observer wins the opposed comparison, the result can become a modifier to attack and forced defensive maneuvers against that opponent. Repeated attempts are limited. Mutual modifiers can cancel. | Observe-opponent result table: difference 0-5 -> 0, 6-10 -> +1, 11-15 -> +2, 16+ -> +3. Needs exact source modeling. |
| Parere | PDF p. 6 | Defensive full-round action | Whole round | Character uses the round to parry one or more attacks. Adds one fifth of Dodge, rounded down, to Parry. Two parry weapons or weapon + shield can be combined against one attack, with each contributing at least +1. Can combine with observing. | Requires final Parry calculation and multiple-attack priority logic. |
| Parry awareness and movement | PDF p. 6 | Prerequisite / movement side effect | Whole round | Parry benefit assumes prior awareness of the attack. Multiple attacks must be prioritized logically. A character who only parries must also move backward about 1 meter per round for full DB; otherwise DB is modified by `-2%`. | Needs movement/distance model and multiple attack model. |
| Offensiv parering | PDF p. 7 | Setup / counter-pressure action | Current round setup for next round | Character uses parry as an opening for later attack by unbalancing the opponent through weapon contact. Requires not moving backward, so DB is `-2%` for the whole round. If successful, opponent becomes unbalanced in the next round. | Offensive-parry brawling modifier table: Parry +0..+5 -> 0, +6..+10 -> +1, +11..+15 -> +2, +16+ -> +4. Needs brawling opposed-roll model. |
| Desarmering, method 1 | PDF p. 8 | Reactive disarm | Wait for attack, parry, then disarm | Character waits until attacked, parries, and uses a parry weapon to twist the opponent weapon away. Shield normally cannot be used. If no attack comes, character is passive. | Disarm roll modifier uses parry weapon modifier, damage-modifier difference, and parry-success modifier. Result table: 0-5 no effect, 6-10 unbalanced 1 round, 11-15 disarmed, 16+ disarmed and unbalanced 1 round. |
| Desarmering, method 2 | PDF p. 8 | Proactive disarm attack | Any chosen phase | Character attacks intending to knock or twist the weapon away. Defender must parry with the targeted weapon. Attacker has usual attack-phase DB penalty; if the attack hits, the opposed disarm procedure follows. No direct damage is dealt. If the defender is already unbalanced by offensive parry, attack contact may already exist. | Needs disarm method 2 exact table linkage and attack-hit dependency. |
| Direkte kontring | PDF p. 9 | Direct counterattack | Wait for opponent attack | Martial-arts/fencing-style counter. Character waits for opponent attack, then attacks into it. Uses simultaneous attack rules with modifications. Countering character must roll Combat Experience, not Willpower. If Combat Experience succeeds and the same die would make a Dexterity weapon-skill check above 30, the usual DB penalty can be reduced from `-4%` to `-2%`. | Needs martial/fencing eligibility, simultaneous attack model, and observe-opponent bonus integration. |
| Avbryt nærkamp | PDF pp. 9-10 | Disengage from melee | First in round | If a character tries to escape melee while opponent continues attacking, both roll Dodge adjusted by movement/encumbrance modifier. Difference determines whether the attack continues, whether DB/Parry or attacker OB is modified, or whether defender escapes. | Disengage table is visible but should be second-pass transcribed before implementation. It includes defender roll minus attacker roll bands from `-21` through `21+`. |
| Observere | PDF p. 10 | Awareness action | Whole round | Character spends the round observing and receives a Perception roll for overview. The usual `-4%` action modifier does not apply to this action, but combat experience still does. GM should gate use based on character knowledge, not player knowledge. | Needs perception/combat-experience integration. |
| Vanlige handlinger | PDF p. 10 | Catch-all ordinary action | GM adjudicated within 3 seconds | Covers ordinary actions not otherwise categorized: picking up items, drawing weapons, clothing changes, doors, running, climbing, eating/drinking, etc. GM decides what is possible in a round, whether checks are needed, and how long it takes. Impossible actions may simply waste time. | Needs generic GM-adjudicated action record, not combat resolution first. |

## Two-Part Actions

| Action | Source | Classification | Phase 1 | Phase 2 | Extracted behavior | Tables / data needed |
| --- | --- | --- | --- | --- | --- | --- |
| Angrip - parer | PDF p. 10 | Standard two-part action | Attack | Parry if needed | Character attacks early, then may parry late. Initiative is in Phase 1. Character has `-4%` DB/Parry in Phase 1. Source calls this the standard attack and references special simultaneous-attack rules. | Attack-phase DB/Parry modifier; simultaneous attack rules. |
| Parer - angrip | PDF p. 11 | Defensive-then-attack action | Parry | Attack | Useful for slower characters: parry first, then attack in Phase 2. Initiative occurs in Phase 2. Character has `-4%` DB/Parry in Phase 2. If no attack comes in Phase 1, character remains passive. | Phase 2 DB/Parry `-4` is implemented as a generated declaration modifier. Phase 2 initiative modifier table remains future work based on Phase 1 attack/parry result. |
| Parer - angrip initiative table | PDF p. 11 | Phase-2 initiative modifier table | Result of Phase 1 | Initiative modifier Phase 2 | Visible rows: no hit/no parry needed -> +6; no hit/parry +6..infinity -> +6; no hit/parry +0..5 -> 0; hit -> -3; critical hit -> -6. | Needs exact model for "parry +6..infinity" and critical/combat-experience reset. |
| Finte - angrip | PDF pp. 11-12 | Feint then attack | Feint | Attack | Character feints plausibly to unbalance opponent. Feinter rolls Dodge if movement-based or relevant combat skill with Dexterity if weapon-based. Defender rolls highest melee skill with Intelligence. Result can modify defender OB/DB and attacker DB/Parry. If defender attacks in Phase 1, use initiative and simultaneous attack rules. | Feint table visible on PDF p. 11; should be canonicalized before implementation. |
| Juster avstand - angrip | PDF p. 12 | Distance adjustment then attack | Distance maneuver | Attack from intended or wrong distance | Character adjusts distance before attacking. Automatic if opponent does not oppose; otherwise both roll Dodge with movement/encumbrance modifier. GM may apply 0-4% situational modifier to either side. Moving closer gives `-2%` DB in Phase 1. If successful, Phase 2 attack uses correct distance; if not, attacker may still attack from wrong distance. | Needs distance/weapon-reach model and movement modifier source. |
| Angrip - Angrip | PDF p. 12 | Double attack | Attack | Attack | Character may attack the same opponent twice, typically with two weapons, some weapons usable twice, or unarmed strikes/kicks. Main rule: `-1%` OB to both attacks and `-4%` DB in both phases. Character can abort after Phase 1, then has only `-2%` DB in Phase 2. | Implemented for declaration-generated phase modifiers: Skill/OB `-1` and DB/Parry `-4` in both phases. Dual-wield/unarmed eligibility, abort handling, and attack resolution remain future work. |

## Extra Actions

| Action | Source | Classification | Extracted behavior | Tables / data needed |
| --- | --- | --- | --- | --- |
| Snakke | PDF p. 13 | Extra/concurrent communication | Speaking, shouting warnings, and issuing orders are usually possible while acting, but GM should apply negative modifiers to other actions depending on concentration cost. Source suggests `-1%` to `-4%` is reasonable. Speech is limited by a 3-second round and by what the character actually knows. | Needs GM-applied situational modifiers and information-visibility discipline. |
| Justere avstand | PDF p. 13 | Extra movement/distance action | Characters can try to adjust distance during a round. It has no effect in the current round; if opposed, use the same Dodge/movement-modifier check as Juster avstand - angrip at the end of the round. Winner sets the new distance. If the two-part action already used this contest, do not roll again. | Needs distance state and movement contest model. |
| Supplerende almindelige handlinger | PDF p. 13 | Supplemental ordinary action | Supplemental actions use a different body part than the main action, such as drawing a weapon while speaking or moving. They can combine with other extra or ordinary actions when plausible. GM should apply negative modifiers to all affected actions. | Needs generic supplemental action records and GM situational modifiers. |

## Source Tables To Canonicalize Later

| Table | Source | Current extraction status | Notes |
| --- | --- | --- | --- |
| Combat experience result table | PDF p. 4 | Readable | Panic/passive/active state, modifier, reroll timing. |
| Simultaneous attack Combat Experience / Willpower table | PDF p. 4 | Readable | Maps roll result to no attack or OB modifier. |
| Observe-opponent modifier table | PDF p. 6 | Readable | Difference-to-modifier table, 0..+3. |
| Offensive parry brawling modifier table | PDF p. 7 | Readable | Parry margin to brawling modifier, capped at +4. |
| Disarm modifier and result tables | PDF p. 8 | Mostly readable | Result table readable; modifier inputs need exact modeling. |
| Disengage from melee table | PDF p. 9 | Mostly readable | Table continues near bottom edge; second-pass transcription recommended. |
| Parry-attack Phase 2 initiative table | PDF p. 11 | Readable | Result of Phase 1 attack/parry determines Phase 2 initiative modifier. |
| Feint table | PDF p. 11 | Mostly readable | Table rows visible; should be canonicalized before use. |

## Implementation Boundary For Next Passes

- Do not wire these action rules directly into the current combat declaration UI yet.
- First useful implementation candidates are generated phase modifiers for the action catalogue already present in the UI:
  - `Angrip - parer`
  - `Parer - angrip`
  - `Angrip - Angrip`
- Before implementing any numeric rule, create a structured table source with page reference, exact bands, and tests.
- Distance, perception, combat experience, simultaneous attack, disarm, and feint all require supporting state that does not yet exist in the encounter round model.

## Open Questions / Ambiguities

- The source uses percentage-style modifiers throughout, but each future implementation should confirm whether a value is a raw modifier input to the workbook percentage helper or a direct roll modifier.
- Missile defense and multiple-attack parry rules reference adjustment tables not included in this extracted action source.
- Distance/reach rules depend on weapon reach and movement modifiers; this source references those concepts but does not fully define their data model.
- Some Norwegian/English mixed table labels should be preserved in canonical table metadata so future implementation can trace back to the scanned text.
