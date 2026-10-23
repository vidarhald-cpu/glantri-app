import { expect, test } from "@playwright/test";

/**
 * Forgejo #745 — rendered proof for the Learning Group re-paragraphing pass.
 *
 * #745 is permitted exactly one edit: inserting a `\n\n` paragraph boundary where a paragraph ran
 * two unrelated subjects together. Its standard is that the prose with paragraph whitespace
 * normalized stays textually identical, and that the result is materially easier to read. The
 * first half is proven at source by the digest in
 * `packages/content/src/proposals/competencyContentV2/competencyContentV2ReaderProse.test.ts`.
 * This spec proves the second half where only a browser can: each case asserts the number of
 * boundaries a reader actually SEES, and asserts that the rendered text with its whitespace
 * normalized is the baseline prose character for character.
 *
 * Both assertions are needed together. The rendered count alone would pass on reworded prose, and
 * the normalized text alone would pass on a build where #743's `white-space: pre-line` had
 * regressed and every boundary collapsed back to a space — the exact defect #743 fixed.
 *
 * `normalizedProse` below was measured at `233b39c6`, BEFORE this lane's edit, which is why
 * matching it proves the words did not move.
 *
 * K25 was added after the fact, by a Product Owner ruling on this lane's independent QA finding
 * F2: its third paragraph announced two other things, delivered two, and then ran a third subject
 * on behind them. Its `normalizedProse` is likewise the `233b39c6` baseline, so this case proves
 * the correction moved a boundary and not a word.
 *
 * The last case is a record this lane considered and deliberately left as one paragraph. It is
 * here so that the floor this lane raised cannot be mistaken for a mandate to split everything:
 * a regression that splits it fails this spec.
 */

test.use({ storageState: "e2e/.auth/player.json" });

type Case = {
  id: string;
  name: string;
  slug: string;
  why: string;
  paragraphsBefore: number;
  paragraphsAfter: number;
  normalizedProse: string;
};

const CASES: Case[] = [
  {
    id: "F09",
    name: "Rigged-vessel deck apprenticeship",
    slug: "rigged-vessel-deck-apprenticeship",
    why: "the Product Owner's named acceptance example: ropework and splicing, going aloft, rigging traditions and weather judgement ran together in one paragraph",
    paragraphsBefore: 3,
    paragraphsAfter: 5,
    normalizedProse:
      "Rigged-vessel deck apprenticeship is training aboard a rigged ship in handling her, working her lines and going aloft. A deck apprentice learns aboard, from the hands. The work is handling the vessel and running its routines — watches, sail handling, ground tackle, the ordinary labour of keeping a ship working — and the correction is immediate, public and unsentimental, because on a rigged vessel a slow or wrong hand is a danger to other people. Competence is established by being trusted with progressively more of the work. A rigged vessel runs on rope and is worked from aloft, and both are trained accordingly. Every line has a purpose, a place and a knot proper to it, and the apprentice is drilled until the right one is made correctly in the dark — and drilled as thoroughly on inspecting a working line, diagnosing why one has failed, and splicing it. Going aloft is likewise taught rather than assumed: climbing the rigging and working there safely is learned under instruction rather than picked up. Vessels and rigging traditions differ, and what an apprentice is drilled on is the practice of the ship they learn in. And the ship's people read the weather constantly, because sail is set and shortened on that judgment; an apprentice is brought into it and corrected on it long before ever being asked to make the decision.",
  },
  {
    id: "K11",
    name: "Court service practice",
    slug: "court-service-practice",
    why: "the longest Learning Group paragraph after F09: dependable administration, the three things that surround it, and the two specialisms ran together",
    paragraphsBefore: 3,
    paragraphsAfter: 5,
    normalizedProse:
      "Court service practice is training, from a junior place inside a court, in the dependable administration of its business and in the conventions, power and emblems that surround it. A court is learned from inside it, in a junior place, over years. The newcomer carries messages, attends, keeps a record and is present at a great deal they do not yet understand, and the teaching is done by the officers above them in short and pointed corrections: that request goes to a different officer, that man's opinion carries more weight than his office suggests, that matter is not unresolved but waiting, you addressed the wrong person first. Much of it is never set out systematically, and the learner is expected to assemble it by attending carefully. Most of court service is ordinary work done dependably. Business recurs, obligations fall due, offices divide responsibility, and somebody has to keep all of it moving whatever else is happening — which is why the administration is the daily substance of the practice rather than an adjunct to it. Around that sit the three things that make the work possible: the conventions of the society the court belongs to, a working sense of where power actually lies as against where it formally sits, and the arms and emblems by which everyone present announces who they are. The practice also carries the specialist understanding of formal precedence and presentation, and of how a court establishment's offices, obligations and recurring business are properly organised.",
  },
  {
    id: "K20",
    name: "Diving and underwater work practice",
    slug: "diving-and-underwater-work-practice",
    why: "rope work and underwater observation ran together; the paragraph's own opening sentence introduces only the rope",
    paragraphsBefore: 3,
    paragraphsAfter: 4,
    normalizedProse:
      "Diving and underwater work practice is training in working safely and effectively below the surface using breath control, ropes and careful observation. Diving for work is taught by divers, in the water, on a short line and then a longer one. The learner descends, does something deliberate below the surface and comes up, and is corrected on all of it: the breath, the descent, the handling of the line, and above all on the discipline of coming up before having to. It is repetitive, deliberately unexciting training, because the practice being built is the ability to work calmly at depth rather than to reach it. Most of what a diver does below the surface is done with a rope. A line commonly serves as signal, lifeline and working tackle at once — objects may be secured and sent up on it, and it is the diver's link to the surface. Handling rope well is not an adjacent convenience here; it is half the work, and it is taught to a working standard. The other half is seeing: water gives poor light, deceptive distance and little time, and a diver is trained to find and recognize a thing under those conditions rather than to look around.",
  },
  {
    id: "K25",
    name: "Street theft practice",
    slug: "street-theft-practice",
    why: "added by Product Owner ruling on independent QA finding F2: the paragraph announces TWO other things, delivers two, and then a fourth sentence opens a third subject the announcement does not govern \u2014 the structure K11 was already split on",
    paragraphsBefore: 3,
    paragraphsAfter: 4,
    normalizedProse:
      "Street theft practice is what a company of thieves teaches: trained hands, a glance that judges what is worth taking, and the means of reaching it. This is learned from people who do it, usually young and usually in company, and the correction is entirely practical. Hands are trained first: small objects palmed, passed and exchanged until the movement disappears, practised against each other and then in the street, with the failures discussed. Nobody teaches it as a course, but it is unmistakably taught — by demonstration, by repetition, and by the sharp instruction of someone who has been caught and does not intend to be again. Two other things are learned in the same company. Knowing what is worth taking is half the trade, and it is taught: what that is, what it will fetch, what is traceable and what is not worth the risk, judged at a glance and corrected afterwards by what it actually fetched. And reaching things is the other half — walls, roofs, sills and stairs, ascended and descended using whatever supports are there. The particular specialist practice of lifting from what somebody is carrying, with its own demands of access, timing and unobtrusive handling, is taught within this same company.",
  },
  {
    id: "N01",
    name: "Small-craft boat working",
    slug: "small-craft-boat-working",
    why: "DELIBERATELY NOT SPLIT: its opening sentence announces the enumeration that follows and its closing sentence states that the four are taught together, so a break would contradict the prose",
    paragraphsBefore: 3,
    paragraphsAfter: 3,
    normalizedProse:
      "Small-craft boat working is training in handling an open boat, working its lines and judging the water and weather it is taken out in. Working an open boat is a whole practice, and it is learned as one. The learner goes out in the boat with someone who has worked it for years, takes an oar and then the tiller, makes fast and casts off, and is corrected continuously and often sharply, because in a small boat a mistake is immediate. There is no classroom stage: the instruction is the work, repeated across enough days and conditions that handling stops being deliberate. The practice is larger than steering. Everything in an open boat is held by rope, and the learner's knots are inspected until they are right. Everyone who works one is expected to be able to swim, and swimming is taught within the practice rather than assumed. And the decision that matters most is made ashore: a boat's crew learns to read the sky, the water and the season, and to judge whether to go out at all. These are taught together because the boat does not separate them.",
  },
];

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

for (const row of CASES) {
  test(`${row.id} — ${row.name}`, async ({ page }) => {
    /* Learning Group anchors are name slugs, not ids. */
    await page.goto(`/skills#group-${row.slug}`);
    await expect(page.getByRole("heading", { name: row.name })).toBeVisible();

    const reading = await page.evaluate((slug) => {
      const article = document.getElementById(`group-${slug}`);
      if (!article) throw new Error(`No Inspector article #group-${slug} is rendered.`);
      const paragraphs = [...article.children].filter(
        (child): child is HTMLParagraphElement => child.tagName === "P",
      );
      const full = paragraphs.filter((p) => (p.textContent ?? "").includes("\n\n"));
      if (full.length > 1) throw new Error(`${full.length} paragraphs carry authored boundaries.`);
      const target = full[0] ?? paragraphs[paragraphs.length - 1]!;
      return {
        whiteSpace: getComputedStyle(target).whiteSpace,
        childElementCount: target.childElementCount,
        textContent: target.textContent ?? "",
        innerText: target.innerText,
      };
    }, row.slug);

    const authored = (reading.textContent.match(/\n\n/g) ?? []).length;
    const rendered = (reading.innerText.match(/\n[ \t]*\n/g) ?? []).length;
    // eslint-disable-next-line no-console
    console.log(
      `#745 ${row.id}: paragraphs ${row.paragraphsBefore} -> ${row.paragraphsAfter} | ` +
        `authored boundaries=${authored} rendered=${rendered} white-space=${reading.whiteSpace} ` +
        `childElementCount=${reading.childElementCount} normalizedLen=${normalize(reading.innerText).length}`,
    );

    /* The reader sees every authored boundary, and exactly as many as this lane measured. */
    expect(reading.whiteSpace, `${row.id}: computed white-space`).toBe("pre-line");
    expect(authored, `${row.id}: authored boundaries`).toBe(row.paragraphsAfter - 1);
    expect(rendered, `${row.id}: boundaries a reader actually sees`).toBe(row.paragraphsAfter - 1);
    /* Presentation only: no paragraph elements were introduced into the prose. */
    expect(reading.childElementCount, `${row.id}: no child elements`).toBe(0);
    /* And the words are the baseline words. ${row.why} */
    expect(normalize(reading.innerText), `${row.id}: rendered prose, whitespace normalized`).toBe(
      row.normalizedProse,
    );
  });
}
