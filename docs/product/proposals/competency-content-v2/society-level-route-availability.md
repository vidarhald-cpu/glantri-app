# Why the same Profession teaches different things in different places

> **Status: NON-CANONICAL PRODUCT OWNER PROPOSAL — awaiting review.**
> This is the player-facing explanation of the Society-Level availability model proposed in this
> folder. It is not registered with Chargen, not projected into canonical content, and does not
> replace any approved catalogue. It is written to be read by a player, not by the build.

## The short version

A Profession is **one occupation everywhere**. A Smith in a great trading city and a Smith in a
hill village are both Smiths: same Profession, same identity, same name on the sheet.

What changes between them is **which ways of learning are actually available** where they live.

So the question is never "is this a different Profession here?" It is always "**who is there to
teach it, and where?**"

## Three ideas, and they are separate

**Your Profession** is your occupational identity. It is stable across every society in the setting.
Nothing about where you grew up changes what a Mason is.

**A Learning Group** is a coherent body of training — a curriculum somebody teaches and somebody
practises. "Ordinary stone apprenticeship." "Watch and guard instruction." "Campaign service." A
Learning Group is a _route_: a way you got taught, not a shopping list of Skills that happen to suit
your job.

**Your Society Level and Social Band** decide **which of those routes exist around you**. They do
not touch your Profession, and they do not touch what any Skill is or does.

## The rule that matters most

> **A route being unavailable does not make a Skill unavailable.**

This is the part that is easy to get backwards, so it is worth stating plainly.

If the great masons' lodge that teaches "Ordinary stone apprenticeship" does not exist in your
society, that does **not** mean nobody in your society can learn Masonry. It means **that particular
way in** is closed. Masonry is still available through **every other route that does exist** — the
building site, the quarry, whatever else in your world genuinely teaches it.

A Skill is available to you if **any** valid route reaches it. Not the best route. Not the usual
route. Any of them. The game takes the union of everything actually open to you.

The practical consequence: a less developed society usually offers **fewer ways** to learn a thing,
and often **narrower** ones — but it very rarely locks a competency away entirely. Where it does,
that is a deliberate statement about the society, not a side effect of a missing school.

## What you will actually notice at the table

- **Your Profession looks the same.** The name, the identity and the concept do not shift.
- **The training on offer looks different.** Two Soldiers from different societies may have learned
  genuinely different things, because their societies field genuinely different forces.
- **Fewer routes, not a shorter list of Skills.** Where a route is missing, look for the other way
  in before assuming the competency is out of reach.
- **You are never charged twice.** If two routes both teach you the same thing, you pay for it once,
  and **the order you buy them in makes no difference to the final cost**. Overlap between routes is
  deliberate; it exists so that a narrow society can still reach a competency by a different road.

## Where a restriction is written down

A restriction is recorded **at the most general level where it is genuinely true**, and no higher.

If a whole curriculum simply does not exist in a society — nobody teaches close-order drill, because
there is no close-order force — the restriction belongs to the **Learning Group**. It is true of that
training wherever the training would be, and writing it once keeps it honest.

If the curriculum exists but one occupation cannot reach it there — the training is real, but not
open to that trade in that place — the restriction belongs to that **Profession's route** into the
group. That is the contextual exception, and it is deliberately the narrower tool.

There is no third thing. In particular, **there is no society-specific version of a Profession**. You
will never find "Hill-Village Mason" beside "Mason"; there is one Mason, reached by whichever routes
exist around her.

## The core route

Every Profession has at least one **defining core route** — the training it is not that Profession
without. A Mason without a masonry practice is not a Mason. Some Professions offer a small set of
alternative cores, because the occupation genuinely has more than one honest way in, and a named
track may refine or replace its parent's core.

This is what keeps the model honest under narrow availability. A society that cannot support any of
a Profession's core routes does not get a thinner version of that Profession — it does not support
that Profession at all, and the game says so. No table-level override is needed to make that work.

## An example

**P46 Mason**, in a society that supports the full envelope:

- Ordinary stone apprenticeship — the core route
- Building-site practice, working with the other trades
- Design-and-survey practice, setting out the work

**P46 Mason**, in a society with no formal building trade:

- Ordinary stone apprenticeship — the core route, still present, or the society has no Masons
- The site and design routes are simply not there

The second Mason is not a lesser Mason or a different Profession. She learned in fewer places. The
Skills her society's remaining routes reach are still hers to take.

## Which routes a low Society Level actually withholds

The model above is settled. **Which individual routes a low Society Level withholds is now authored**,
for the Society Level 1-2 boundary and the Social Bands inside it, in
[Society Level and Social Band route availability](society-level-availability-v2.md). That report is
generated from the same source the build checks, so the numbers in it cannot drift away from the
data.

What it authors, in the model's own vocabulary and nothing else:

- **51 of the 95 Learning Groups carry an inherent minimum.** 28 first exist at Society Level 2, and
  23 do not exist at Society Level 1 or 2. The other 44 are available everywhere.
- **Four Profession routes carry a restriction of their own**, where the curriculum exists but that
  occupation cannot reach it by that road.
- **Seven direct routes carry their own restriction.**
- **No society-specific Profession anywhere.** A society that supports none of a Profession's core
  routes simply has no one of that Profession, and the build says so rather than thinning the
  Profession.

The practical shape of it: a Society Level 1 learner reaches 80 of the 131 base Skills across 42
Professions, a Society Level 2 trades-and-guilds learner 110 across 63, and the catalogue opens fully
from Society Level 3.

## What is still deliberately not decided here

**Where a route's floor sits above Society Level 2 is not authored.** A restriction recorded at
Society Level 3 means only "not at Society Level 1 or 2"; whether the real floor is 3, 4, 5 or 6 is a
later decision, and the build refuses a higher claim so that one cannot be made here by accident.

**Eight route gaps are flagged, not closed.** Each is a Skill that plausibly belongs low down but
whose every route happens to require more:
[Trade](society-level-availability-v2.md#trade--no-route-at-society-level-1),
[Teaching](society-level-availability-v2.md#teaching--no-route-at-society-level-1), Leadership and
[five others](society-level-availability-v2.md#flagged-route-gaps). Closing one would mean adding a
route to reach a coverage target, which is exactly what the ruling rules out. They are reported for a
Product Owner to look at.
