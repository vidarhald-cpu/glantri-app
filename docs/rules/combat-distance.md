# Combat Distance

Combat distance is shared pairwise encounter state.

- Each active participant pair has one unordered distance edge.
- Distance is an integer from `0` to `8`.
- Melee distances are `0` through `4`.
- A to B and B to A always resolve to the same edge.

Missing pair distances are materialized into combat state from weapon reach. The default is the
longest preferred distance across the active/wielded weapons of both participants. Current imported
weapon data stores this as weapon `range`; optional `preferredDistances` metadata is also supported.
Weapon initiative metadata is a separate combat value and is never used as distance reach.
If no usable weapon distance metadata is available, the app falls back to distance `2` and records a
note.
Whole-number decimal source values such as `3.0` are parsed as distance `3`; fractional values such
as `2.5` are treated as invalid unless a source rule explicitly defines rounding.

The GM can set pair distance manually. A GM-set edge overrides the weapon default and is command
backed, so Clear restores the previous edge or removes the GM-set edge if no previous edge existed.
Displayed default distances are rule-active immediately; the GM only saves matrix changes for
overrides/edits, not to activate defaults.
In the GM Combat screen, distance editing is presented as a compact participant-by-participant
matrix below the Combat inspector. Participant names form the row and column axes. Row labels are
left aligned and truncated when needed; column labels are compact, rotated, and truncated so each
label lands above its narrow numeric column, with the full name in the browser tooltip. Matrix cells
use subtle hairline borders, diagonal cells remain `—`, and editing one mirrored pair updates the
shared draft value. Save distance changes commits each changed pair through the existing
command-backed distance update. Source/default notes may be available as secondary tooltip/debug
context, but they are not shown as noisy primary combat rows.

Normal Phase 1 and Phase 2 panels show the current distance to the selected target as compact
read-only text in a small right-side Target-row meta area. Player Combat shows the same read-only
distance for the player's selected visible target and does not expose the full matrix or editing
controls in this slice.

During declaration and combat-action modifier review, using a weapon outside its preferred distance
creates a generated Skill/OB modifier for the relevant A1/A2 attack:

- penalty is `-2` per range step outside the nearest preferred distance
- preferred `[3]`, actual `3` gives no modifier
- preferred `[3]`, actual `4` gives `-2`
- preferred `[3]`, actual `1` gives `-4`
- preferred `[1, 2]`, actual `4` gives `-4`
- preferred `[3, 4]`, actual `1` gives `-4`

The generated row is a phase-scoped combat action modifier in the Skill/OB bucket. It is created
when the action declaration or modifier review is committed, using the committed phase target,
phase weapon, and current pair distance, then shown to GM and player review before the attack roll.
The attack roll consumes the visible Skill/OB row through the existing OB total; the late
attack-roll route must not create a second hidden distance modifier. Clear/undo of the attack does
not remove the declaration-time row unless an older command explicitly recorded that it created the
row. Distance modifiers apply to attack rolls only; they do not affect DB/Parry, damage lookup,
initiative, critical rolls, armor, or base weapon OB.

Examples:

- Broad sword preferred `2`, actual `3` gives Skill/OB `-2`
- Long sword preferred `3`, actual `3` gives no modifier
- Long sword preferred `3`, actual `5` gives Skill/OB `-4`

Declared desired distance is separate from actual pair distance. During declaration, a participant
may hold position or set preferred distances from `0` to `8` against one or more visible opponents;
the UI emphasizes melee zones `0` through `4`. A common default is the acting participant's active
attacking weapon preferred distance against the selected attack target when that metadata is
available. The GM may proxy declarations.

Distance intentions do not change current-round attack distance and therefore do not change
current-round distance OB modifiers. At SU / round-end review, declared preferences are collected
into shared round-level distance-control items keyed by unordered participant pair. Each pair is
created and resolved at most once per round:

- matching preferences propose that distance without a contest
- one-sided or conflicting preferences create a Dodge control contest
- Dodge control uses the participant Dodge total supplied by the combat snapshot plus current
  General/Fatigue modifiers; unavailable Dodge falls back to `+0` with a warning
- the higher final Dodge result sets that pair's distance for the next round
- ties keep the current distance unless the GM overrides the proposal

The GM reviews each pair proposal in the shared Round distance control section, may roll pending
contests, may override the final distance from `0` to `8`, and commits the result as a
command-backed `round_end_review` distance edge. The edge is updated at SU commit and is carried
into the next round; GM manual distance edits remain available.

Full coordinates, facing, pathing, terrain legality, and tactical geometry remain future work.
