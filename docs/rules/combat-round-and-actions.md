# Combat Round, Loadout and Actions

This is the reader guide to a Combat round as the application currently runs it: the steps a round
moves through, what you declare, which actions you can actually choose, how your loadout reaches
the fight, and how distance works.

It describes current behaviour. Where a manoeuvre is only partly implemented, this page says so
rather than describing the complete rule.

## Where each thing is documented

| For                                                       | Use                                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| The values on the Character `Equip Items` screen          | [Equip Items Calculations](./combat-loadout-calculations.md)                    |
| Hit, grazing hit, damage lookup, armor, the critical roll | [Glantri Combat To Hit / Damage](./combat-to-hit.md)                            |
| Critical values and effects the app produces              | [Criticals — GM Value Reference](./gm/criticals.md)                             |
| Critical-effect tables and their current boundaries       | [Glantri Critical Effects](./combat-critical-effects.md)                        |
| The check that opens a round                              | [Combat Experience](./combat-experience.md)                                     |
| Declaring Parry and rolling it against an incoming attack | [Parry — Player Rules](./player/parry.md)                                       |
| Validating and proxying a Parry as GM                     | [Parry — GM Procedure](./gm/parry.md)                                           |
| Item ENC, carried load and encumbrance level              | [Equipment & Encumbrance Calculations](./equipment-encumbrance-calculations.md) |

This page does not repeat those. It covers the round, the declaration, and the manoeuvres that have
no page of their own.

## 1. The round

A round runs through a fixed sequence of steps. Both surfaces show the same step; the wording
differs because the GM sees the action to take and the player sees where the round has got to.

| Step | In Player Combat        | The GM's action               |
| ---: | ----------------------- | ----------------------------- |
|    1 | Combat Experience check | Resolve Combat Experience     |
|    2 | Declare action          | Declare action                |
|    3 | Review modifiers        | Declare modifiers             |
|    4 | Phase 1 initiative      | Roll phase 1 initiative       |
|    5 | A1 Attack               | Roll phase 1 attack           |
|    6 | P1 Parry                | Resolve phase 1 parry         |
|    7 | D1 Damage/effects       | Review phase 1 damage/effects |
|    8 | Review phase 2          | Declare phase 2 modifiers     |
|    9 | Phase 2 initiative      | Roll phase 2 initiative       |
|   10 | A2 Attack               | Roll phase 2 attack           |
|   11 | P2 Parry                | Resolve phase 2 parry         |
|   12 | D2 Damage/effects       | Review phase 2 damage/effects |
|   13 | Round summary           | Review round summary          |

Two things follow from that shape and are worth holding on to:

- **A round has two attack phases, Phase 1 and Phase 2.** Which phases your declared action attacks
  in is fixed by the action, not chosen separately — see the action table below.
- **A round opens on the Combat Experience step, before anyone declares.** When a check has become
  due — by schedule, or after a Critical-triggered reset — it is resolved here and the declaration
  controls stay closed until it is, so declarations are never made against a superseded result. Due
  is not expired: the previous Combat Experience stays active until a fresh roll replaces it.

The round ends on the round summary, which is also where declared distance preferences are
resolved — see [section 6](#6-distance).

## 2. Declaring your round

Player Combat and the GM's Combat inspector use the same declaration form. Anything below that a
player can declare, the GM can also declare as a proxy for a participant they control.

A declaration records your **intended plan for the whole round**. It does not assert that the plan
is possible in the current situation: the GM and the resolution rules decide feasibility. The form
stays permissive on purpose.

A declaration has:

- one **primary action**;
- at most one **secondary action**;
- a **movement intent**;
- **distance intentions** against one or more opponents;
- and, for the actions that attack, a **target** and an **attack source** per attacking phase.

### 2.1 Primary actions you can choose

These thirteen options are what the primary action selector offers, in the order it offers them.

| Option                 | What declaring it does                                                                                              | Attacks in                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Single attack          | One attack, with a parry context for the same phase.                                                                | Phase 1                   |
| Reactive attack        | One attack held to the second phase.                                                                                | Phase 2                   |
| Double Attack          | Two attacks, which must name the **same** opponent in both phases.                                                  | Both                      |
| Feint - Attack         | A Phase 1 feint, then a Phase 2 attack on the **same** opponent. See [section 7.3](#73-feint---attack).             | Phase 2                   |
| Adjust Distance-Attack | Spend the round making the distance you want, then attack. See [section 7.4](#74-adjust-distance-attack).           | Phase 2                   |
| Offensive Parry        | Meet one named opponent's attack and try to take control of the engagement. See [section 7.1](#71-offensive-parry). | —                         |
| Parry                  | Spend the round on defence. See [Parry — Player Rules](./player/parry.md).                                          | —                         |
| Parry - Disarm         | Disarm off a successful parry of an incoming attack. See [section 7.2](#72-disarm-and-parry---disarm).              | —                         |
| Disarm                 | Disarm off your own attack or an existing hold. See [section 7.2](#72-disarm-and-parry---disarm).                   | The declared Disarm phase |
| Break Off Engagement   | Try to get clear of the melee. See [section 7.5](#75-break-off-engagement).                                         | —                         |
| Pass                   | Deliberately take no primary action. This is not the same as an unfinished declaration.                             | —                         |
| Perform Task           | Spend the round on a substantial task instead of fighting. You describe the task; the GM adjudicates it.            | —                         |
| Move only              | Move and do nothing else.                                                                                           | —                         |

**Counterattack cannot currently be declared.** It is a recognised action name that the application
deliberately does not offer, so it does not appear in the selector at all. The generic `Other`
action is likewise not offered on either surface.

### 2.2 Secondary actions you can choose

| Option           | Notes                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| Observe Opponent | Needs an opponent of its own, and only combines with **Parry** or **Pass**. See [section 8](#8-observe-opponent). |
| Pass             | Deliberately no secondary action.                                                                                 |
| Talk / Shout     | What your character says, with an utterance type. It carries no mechanical effect.                                |
| Equip / Unequip  | Records an intended equipment change in a short text field.                                                       |
| Small Action     | A limited activity attempted alongside the primary action. The GM may rule it impossible or penalise it.          |

Pass, Talk / Shout, Equip / Unequip and Small Action combine with **every** available primary
action. Observe Opponent does not: with any primary action other than Parry or Pass the declaration
is refused, naming both choices — for example `Single attack cannot be combined with Observe
Opponent. Choose a compatible primary action or remove the secondary action.` Equally, choosing
Observe Opponent first narrows the primary selector to exactly **Parry** and **Pass**.

A secondary action on its own is not a declaration: without a primary action it is refused with a
message asking you to choose a compatible primary action.

An `Equip / Unequip` declaration **records an intention; it does not change your equipment.** The
actual change happens through the ordinary Item controls and GM adjudication — see
[section 5](#5-items-in-the-fight).

### 2.3 Movement and distance intentions

The movement selector offers: **Maintain distance to opponent** (the default), **Step**,
**Advance**, **Withdraw**, **Run**, **Take cover**.

**No available primary action restricts your movement choice in the current version.** Every
primary action accepts every kind of movement the declaration supports, so movement never closes
off an action, and an action never closes off a movement.

Separately from movement, you may hold position or set a preferred distance against one or more
visible opponents. Those are intentions for the **next** round, not this one — see
[section 6](#6-distance).

### 2.4 What a refused declaration tells you

The declaration is checked before it is accepted, and the message names the thing to fix:

| You will see                                                               | Because                                                           |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `Select a target for Phase 1.` / `Select targets for Phase 1 and Phase 2.` | An attacking phase has no target.                                 |
| `Double Attack must target the same opponent in both phases.`              | The two phases name different opponents.                          |
| `Feint and attack must target the same opponent.`                          | Same, for Feint - Attack.                                         |
| `Select an opponent to counter with Offensive Parry.`                      | Offensive Parry names no opponent.                                |
| `Select an opponent to observe.` / `Select an active opponent to observe.` | Observe Opponent has no target, or the target has left the fight. |
| `Observe Opponent cannot target the acting participant.`                   | You cannot observe yourself.                                      |
| `Select an attack source for Phase 1.`                                     | See [section 3](#3-attack-source).                                |

### 2.5 The parry context is currently Single attack only

Declaring a parry source, incoming attack side and parry direction alongside your own attack is
available on **Single attack** and nowhere else. With any other primary action the parry context
reports `Parry context applies to Single attack in this first pass.` This is a current boundary, not
a rule that the other actions cannot be parried from: an **incoming** parry is a separate
defender-owned roll, which the [player Parry page](./player/parry.md) covers and which does not
depend on what you declared.

## 3. Attack source

Every attacking phase needs an **attack source**: the weapon or the unarmed attack the phase will
resolve through. **You choose it explicitly.** The application will not pick one for you, and a
declaration submitted without one for an attacking phase is refused — the server answers
`Phase 1 attack source is required.`

The `Attack source` selector behaves like this:

- If you have a **ready weapon**, it is offered and **preselected**, so an ordinary armed
  declaration needs no extra choice.
- If you have **no ready weapon**, nothing is preselected. The selector starts empty and you must
  choose.

### 3.1 Punch and Kick are always available

**Punch** and **Kick** are intrinsic attack sources. They are offered on both the player and the GM
surface as `Punch · Unarmed` and `Kick · Unarmed`, beside any ready weapon, and they need **no Item
at all** — nothing to own, nothing to draw, nothing to equip. A character with no weapon can
declare and resolve an attack.

They resolve through the character's **Brawling** competency and their own authored attack stats, so
the declared row shows a real initiative, OB, DMB and so on, exactly as a weapon row does. Punch and
Kick are the only unarmed sources the application accepts.

Two consequences at the table:

- **Nothing is ever implicitly unarmed at declaration.** With a weapon ready, that weapon stays
  preselected and Punch and Kick sit beside it as choices you have to make deliberately.
- **A weapon feint needs a weapon.** Feint - Attack with the weapon method requires a weapon as the
  Phase 1 source and is refused with `Select a weapon for the weapon feint.` if you give it an
  unarmed one. The movement method has no such requirement.

### 3.2 You cannot attack and parry with the same thing

Within one phase, the attack source and the parry source must differ. Choosing `Auto` as the parry
source picks the first available source that is not the attack source, preferring a ready shield,
then an off-hand weapon, then the main hand. If none is free you will see
`No available parry source is free from the current attack source.`, and naming the attack source
explicitly as the parry source gives
`The same item/source cannot be used for both attack and parry in the same phase.`

## 4. Loadout in the fight

Combat does **not** read your character's live equipment. It reads the **equipment projection
captured for this Scenario participant** — the loadout and Item identities as they were when the
participant was prepared. Declarations use those captured identities, so changing your character's
equipment mid-Scenario does not silently change what a Combat already in progress resolves with.

The participant's equipment therefore has a status:

| Status      | What it means                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Current     | `Ready for play and matches the Character’s current equipment.`                                                |
| Stale       | `The Character’s current equipment changed since this Scenario was prepared. Update it before play continues.` |
| Unavailable | `Prepare this participant’s equipment before play continues.`                                                  |

**When it is not current, the GM must reconcile it before dependent play continues.** Only the GM
can: the refresh is on the participant assignment grid on the Scenario page. Until then a player
sees `Committed equipment is out of date. Ask the GM to refresh it.` and the GM sees the same fact
phrased as their own action.

Reconciling re-captures the current equipment onto the participant. It is not a repair of a broken
Combat — it is the ordinary way a mid-Scenario equipment change is brought into play.

The derived combat values themselves — OB, DMB, DB, DM, Parry, initiative, movement, encumbrance —
are the Equip Items values, and [Equip Items Calculations](./combat-loadout-calculations.md) is
their reference.

## 5. Items in the fight

`Items in this Combat` lists what the acting participant can do with an Item this round:

| Operation      | Meaning                  |
| -------------- | ------------------------ |
| Draw / ready   | Bring an Item into use.  |
| Stow / unequip | Put an Item away.        |
| Drop           | Let an Item fall.        |
| Pick up        | Take up a present Item.  |
| Pass / give    | Hand an Item to someone. |
| Use / interact | Use an Item.             |

Each Item shows where it currently is — `Equipped`, `Held · On person`, `Stowed`, or
`Present · Unheld` — and each declared Item action carries its own status through
`Waiting for GM review`, `Reviewed — waiting to act`, `In progress`, and then `Completed`,
`Interrupted` or `Cancelled`. A Combat with nothing to interact with says so — `No available Items.`
to a player, `No supported Items for this participant.` to the GM. An empty panel is a resolved
state, not a pending one.

**Item interactions and canonical Disarm both depend on the participant's equipment projection
being current.** If it is stale the panel reports
`Scenario equipment changed outside play. The GM must reconcile it before dependent play can
continue.` and they stay unavailable until the GM reconciles. This is the same reconciliation as
[section 4](#4-loadout-in-the-fight) — Disarm needs to know exactly which Item is in whose hand, so
it cannot run against a loadout the application knows to be out of date.

## 6. Distance

Distance is shared between a **pair** of participants: one number for both of you, from **0 to 8**.

- Where no distance has been set, it is **materialised from weapon reach** — the longest preferred
  distance across the wielded weapons of both participants. With no usable weapon distance data it
  falls back to **2** and records that it did.
- Those defaults are **live immediately**. The GM saves distance changes only to override or edit
  them.
- The GM can set any pair distance by hand, in a participant-by-participant matrix. Players see the
  current distance to their selected target as read-only text, not the matrix.

### 6.1 Fighting outside your weapon's distance

Using a weapon away from its preferred distance generates a visible Skill/OB modifier for that
phase's attack: **−2 per step away from the nearest preferred distance.** It is created when the
declaration or modifier review is committed, and both the GM and the player see it before the
attack is rolled.

Count the steps from the current distance to the **nearest** distance your weapon prefers, then
read the modifier. Distance runs `0` to `8`, so eight steps is the widest gap there is and the
table is complete:

| Steps from the nearest preferred distance | Modifier |
| ----------------------------------------: | -------: |
|                      0 (you are at reach) |        0 |
|                                         1 |       −2 |
|                                         2 |       −4 |
|                                         3 |       −6 |
|                                         4 |       −8 |
|                                         5 |      −10 |
|                                         6 |      −12 |
|                                         7 |      −14 |
|                                         8 |      −16 |

**Count to the nearest preferred distance, not to the weapon's best one.** A weapon that prefers
more than one distance is penalised from whichever of them is closest, so it has no penalty at any
of them:

| Preferred | Actual | Steps | Modifier |
| --------- | -----: | ----: | -------: |
| 3         |      3 |     0 |        0 |
| 3         |      4 |     1 |       −2 |
| 3         |      1 |     2 |       −4 |
| 3         |      0 |     3 |       −6 |
| 1 or 2    |      4 |     2 |       −4 |
| 3 or 4    |      1 |     2 |       −4 |
| 3 or 4    |      4 |     0 |        0 |
| 2 or 6    |      4 |     2 |       −4 |

The last row is the case worth remembering: a weapon preferring `2` or `6`, used at `4`, is two
steps from both and takes `−4` — being between two preferred distances is not the same as being at
one.

Where the application has no usable preferred-distance data for the weapon, it generates **no
distance modifier at all** rather than guessing a reach.

This modifier applies to **attack rolls only**. It does not touch DB or Parry, the damage lookup,
initiative, the critical roll, armor, or the weapon's base OB.

### 6.2 Changing distance between rounds

A declared distance preference does **not** change this round's distance, and so does not change
this round's distance modifier. Preferences are collected at the round summary and resolved once
per pair:

- preferences that **match** propose that distance with no contest;
- a one-sided or conflicting preference creates **one Dodge control contest** for the pair, with a
  roll required from each contesting participant;
- each participant rolls their own, or the GM proxies either side;
- the **higher** final Dodge result sets the pair's distance for the next round;
- a **tie keeps the current distance**, unless the GM overrides the proposal.

The GM reviews each pair, can see which rolls are outstanding, can override the final distance
anywhere in 0–8, and commits the result. The new distance carries into the next round.

## 7. The manoeuvres

### 7.1 Offensive Parry

Declaring Offensive Parry names **one** opponent and costs you a generated **DB/Parry −2%** for the
declared round. Re-committing the declaration replaces that modifier rather than stacking it.

Then: any qualifying attack by that named opponent against you creates an Offensive Parry task.
**The source attack does not have to hit** — you are asked to roll whether it hit or missed. If
that parry succeeds, you and the opponent each roll **Brawling**, and the higher final total wins;
**equal totals produce no winner.**

If you win, two things are created:

- **Continued Contact** — a relationship in which you control the engagement; and
- **Unbalanced** on the opponent — a **−2%** condition that the application applies combat-wide, to
  initiative, to attack and to-hit, to DB and ordinary parry, and to non-Dodge manoeuvre checks.

While Continued Contact is active, it replaces the ordinary round-end distance contest **for that
pair only**: you simply choose the next engagement distance, and the other participant gets no
opposing roll. Everyone else resolves distance normally.

The round in which contact is established has no maintenance contest. From the round after that,
each round end first runs a maintenance contest: both of you roll ordinary Brawling, the
**Unbalanced −2% is excluded from the affected participant's roll for this purpose only**, and a
strictly higher controller total maintains contact. A higher affected-participant total **or a
tie** breaks it and removes Unbalanced.

The parry-quality values are percentages, not flat skill points: the workbook table applies them
with every other eligible percentage contribution. Base Brawling 15 with `+2%` resolves to
effective skill 18.

**Not implemented:** there is no conditional Phase 2 follow-up attack, no second-weapon rule, and no
automatic shortening of attack distance. Forward movement and forced-retreat consequences are also
not implemented.

### 7.2 Disarm and Parry - Disarm

Disarm comes in two methods, which is what the two action names are:

- **Parry - Disarm** — reactive. You must be prepared, there must be an incoming attack, and your
  parry must succeed. A failed parry, no incoming attack, or no preparation each stop the attempt.
- **Disarm** — proactive. It needs either your own attack to **hit**, or an already active
  Continued Contact. A missed proactive attack stops the attempt.

The acting weapon must be one that can trap. A successful reactive parry also earns a contact
quality modifier from how good the parry was:

| Successful parry margin | Contact quality |
| ----------------------- | --------------: |
| 0–5                     |              +0 |
| 6–10                    |              +1 |
| 11–15                   |              +2 |
| 16 or more              |              +4 |

Both sides then roll, each choosing a skill — their weapon skill or Parry — and a characteristic —
Strength or Dexterity. The result is read from the difference in the disarming character's favour:

| Difference | Result                            |
| ---------- | --------------------------------- |
| 5 or less  | No effect                         |
| 6–10       | Unbalanced (1 round)              |
| 11–15      | Disarmed                          |
| 16 or more | Disarmed and Unbalanced (1 round) |

A holder win or a tie cannot produce an effect. The Unbalanced this creates is the same **−2%**
condition described in [section 7.1](#71-offensive-parry), and it expires after one round.

Disarm reads which Item is in which hand, so it is one of the things that needs the equipment
projection to be current — see [section 5](#5-items-in-the-fight).

### 7.3 Feint - Attack

Feint - Attack declares a Phase 1 feint and a Phase 2 attack against the **same** opponent, and you
choose a **method**:

- **movement** — you roll **Dodge**;
- **weapon** — you roll the Phase 1 weapon's combat skill, and a weapon is required as the Phase 1
  source.

Your opponent resists with their **highest close-combat skill**, excluding Dodge and Parry,
recalculated with **Intelligence** in place of that skill's ordinary linked characteristic. A
defender with no such skill cannot be feinted, and the declaration is refused.

The GM first rules whether the feint is feasible at all — possible, possible with an adjustment, or
impossible. Then both sides roll, and the difference (your final total minus theirs) is read from:

| Difference  | Your Phase 1 DB/Parry | Their Phase 2 OB/DB |
| ----------- | --------------------: | ------------------: |
| −16 or less |                    −4 |                  +2 |
| −15 to −6   |                    −2 |                   0 |
| −5 to 0     |                    −1 |                   0 |
| +1 to +10   |                     0 |                  −2 |
| +11 or more |                     0 |                  −4 |

Both columns are percentage modifiers, applied through the ordinary workbook adjustment. Reading
them together: a feint you lose badly costs you your own defence and hands your opponent an
advantage; a feint you win strips theirs. A feint is never free — only the two strongest bands in
your favour leave your own Phase 1 defence untouched.

### 7.4 Adjust Distance-Attack

Adjust Distance-Attack spends the round making the distance you want and then attacking in Phase 2.
It is a whole-round tactic in its own right, not an attack plus a movement preference.

You name a target and the distance you want. Your opponent may simply allow it, in which case you
get it. Otherwise both of you roll Dodge:

| Outcome                     | Resulting distance |
| --------------------------- | ------------------ |
| Opponent allows             | Requested distance |
| Your margin is 1 or more    | Requested distance |
| A tie, or the opponent wins | Current distance   |

A tie goes to the opponent: an unopposed-equal roll does not move you.

### 7.5 Break Off Engagement

Break Off Engagement is an attempt to get clear of the melee, not simply backward movement. You and
the engaging attacker both roll Dodge, and the result is read from your result minus theirs:

| Difference  | Result                              |
| ----------- | ----------------------------------- |
| −21 or less | Attack continues; your DB/Parry −4% |
| −20 to −16  | Attack continues; your DB/Parry −3% |
| −15 to −11  | Attack continues; your DB/Parry −2% |
| −10 to 0    | Attack continues                    |
| +1 to +5    | You break off                       |
| +6 to +10   | You break off; attacker OB −1%      |
| +11 to +15  | You break off; attacker OB −2%      |
| +16 to +20  | You break off; attacker OB −3%      |
| +21 or more | You break off; attacker OB −4%      |

The GM reviews the proposal, may adjust either side, and commits it. A committed escape changes the
pair's engagement to disengaged.

## 8. Observe Opponent

Observe Opponent is the one secondary action with a mechanical result of its own. It is
**directional**: observing someone is not the same as being observed by them, and you may hold
independent observation relationships with several opponents at once.

A round counts toward an observation only if **both** hold:

- you declared **Pass** or **Parry** as your primary action, with Observe Opponent against that
  opponent; and
- **no attack by that opponent resolved as a hit against you** during the round.

A hit costs you that round's progress only. It does not erase rounds already banked, and a miss
does not cost you anything. Progress advances at the round summary.

The rounds you need depend on how many attempts against that opponent you have already completed:

| Completed attempts | Qualifying rounds needed |
| ------------------ | -----------------------: |
| 0                  |                        3 |
| 1                  |                        6 |
| 2 or more          |                       10 |

When you reach the threshold you get one roll — yours alone; **the opponent is never told, gets no
task, and sees no result.** Both sides are rolled, as one opposed open-ended `1d20` contest. Each
side uses the better of Dodge or their highest applicable close-combat skill, recalculated with
**Intelligence** in place of its ordinary linked characteristic.

Your margin gives:

| Margin                | Bonus |
| --------------------- | ----: |
| A tie, a loss, or 0–5 |   +0% |
| 6–10                  |   +1% |
| 11–15                 |   +2% |
| 16 or more            |   +3% |

Every completed attempt resets progress and counts as one more completed attempt, so the next one
is longer. The relationship **keeps the best bonus you have ever earned** against that opponent: a
later weak or failed attempt cannot reduce it.

The bonus is specific to that opponent, and eligible **once**, in whichever direction applies:

- your **OB** or offensive manoeuvre against them; or
- your **DB, Parry, Dodge** or defensive manoeuvre against an action by them.

It does nothing against anyone else, and a reverse relationship — them observing you — is evaluated
entirely separately.

**Not available in the current version:** estimated opponent OB or DMB, hit chance, safe-zone
insight, reading declarations, Observe combined with a direct counter, or any other secondary action
alongside Observe.

## 9. Current boundaries

Honest limits, so nothing here is read as more than it is:

- **Counterattack cannot be declared**, and the generic `Other` action is not offered.
- **A declaration is an intention.** It is not checked against the physical situation, and the
  application does not simulate terrain, coordinates, facing, pathing or line of sight. Feasibility
  is the GM's and the resolution rules'.
- **Encounter visibility and awareness are not modelled.** Targeting is limited to participants the
  surface offers, not to what a character would actually know.
- **Equip / Unequip and Small Action are declarations, not resolutions.** The GM adjudicates them
  through the ordinary controls.
- **Perform Task does not resolve a skill roll inside Combat.** The GM assigns required rolls,
  timing and progress and uses the existing roll facility.
- **Offensive Parry has no Phase 2 follow-up attack** and no forced-movement consequences.
- Critical effects are documented with their own current boundaries in
  [Glantri Critical Effects](./combat-critical-effects.md) and
  [Criticals — GM Value Reference](./gm/criticals.md).
