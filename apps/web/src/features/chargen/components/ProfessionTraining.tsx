"use client";

import { useMemo } from "react";
import {
  buildSkillReferenceModel,
  type SkillReferenceGroup,
  type SkillReferenceModel,
  type SkillReferenceProfession,
} from "@/lib/skills/skillReferenceModel";
import {
  professionTraining,
  rangeLabel,
  readerProse,
  type ReaderProse,
  type RouteEntry,
} from "@/lib/skills/referenceCatalogue";

/**
 * The Chargen half of the one canonical Profession projection.
 *
 * The derivation itself lives in `@/lib/skills/referenceCatalogue` and is shared with the `/skills`
 * reference (Forgejo #372 section 0.6). Only the rendering differs: the reference links Skill to
 * Learning Group to Profession, while Chargen is choosing one Profession and therefore names them
 * in plain text. Nothing here recomputes what a Profession teaches.
 *
 * Presentation order is section 1 of #372 and section 10.1 of the experience contract: the full
 * reader description first, then what the Profession can train, then the training routes and their
 * Skills. The detailed acquisition controls follow in the allocation step, over this same model.
 */

/* One canonical V2 corpus, built once. It is the same projection `/skills` renders. */
let cachedModel: SkillReferenceModel | undefined;
export function getProfessionBrowseModel(): SkillReferenceModel {
  return (cachedModel ??= buildSkillReferenceModel());
}

export function useProfessionBrowseModel(): SkillReferenceModel {
  return useMemo(() => getProfessionBrowseModel(), []);
}

const noteStyle = { color: "#6d665a", fontSize: "0.85rem" } as const;
const bodyStyle = { color: "#4a4f45", fontSize: "0.9rem" } as const;

/**
 * Learning Group prose, with the publication gap told honestly.
 *
 * 51 of 95 canonical Learning Groups still have no published full description (#365). A row must
 * say so rather than present the one-line summary as though it were the explanation, which
 * sections 9.7 and 9.12 of the experience contract forbid.
 */
export function groupReaderProse(group: SkillReferenceGroup): ReaderProse {
  return readerProse(group.readerContent, group.description);
}

export function LearningGroupProse({ group }: { group: SkillReferenceGroup }) {
  const prose = groupReaderProse(group);
  return (
    <div style={{ display: "grid", gap: "0.3rem" }}>
      <div style={bodyStyle}>{prose.summary}</div>
      {prose.full ? (
        <div style={bodyStyle}>{prose.full}</div>
      ) : (
        <div style={noteStyle}>
          Not yet described in full. The line above is this training&rsquo;s short summary, not its
          full explanation.
        </div>
      )}
      {prose.boundaries.length > 0 ? (
        <ul style={{ ...noteStyle, margin: 0, paddingInlineStart: "1.1rem" }}>
          {prose.boundaries.map((boundary) => (
            <li key={boundary}>{boundary}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The Skills, choices and Specializations one Learning Group teaches, in the route wording. */
function GroupTeaching({ group }: { group: SkillReferenceGroup }) {
  return (
    <>
      {group.fixedSkills.length > 0 ? (
        <div style={bodyStyle}>
          Teaches {group.fixedSkills.map((skill) => skill.name).join(", ")}
        </div>
      ) : null}
      {group.selectionSlots.map((slot) => (
        <div key={slot.id} style={bodyStyle}>
          <strong>{slot.label}:</strong>{" "}
          {slot.candidates.map((candidate) => candidate.name).join(", ")}
        </div>
      ))}
      {group.specializations.length > 0 ? (
        <div style={bodyStyle}>
          Opens {group.specializations.map((skill) => skill.name).join(", ")} — acquired separately,
          and the parent Skill must be far enough along.
        </div>
      ) : null}
    </>
  );
}

/**
 * The allocation step's view of one Learning Group.
 *
 * Deliberately the same structure and the same words as a training route in step 5, over the same
 * canonical projection: step 5 is for understanding and choosing, step 6 is for purchasing, and a
 * player must not have to re-learn the model in between (#372 section 0.6).
 */
export function LearningGroupTraining({
  groupId,
  model,
}: {
  groupId: string;
  model: SkillReferenceModel;
}) {
  const group = model.learningGroups.find((candidate) => candidate.id === groupId);
  if (!group) return null;
  return (
    <details>
      <summary>What {group.name} teaches</summary>
      <div style={{ display: "grid", gap: "0.3rem", paddingTop: "0.4rem" }}>
        <LearningGroupProse group={group} />
        <GroupTeaching group={group} />
      </div>
    </details>
  );
}

/** Step 1 of the presentation order: explain the occupation, never its training graph. */
export function ProfessionExplanation({ profession }: { profession: SkillReferenceProfession }) {
  const prose = readerProse(profession.readerContent, "");
  return (
    <div style={{ display: "grid", gap: "0.4rem" }}>
      {prose.summary ? <div style={{ fontSize: "0.95rem" }}>{prose.summary}</div> : null}
      {prose.full ? (
        prose.full.split("\n\n").map((paragraph) => (
          <div key={paragraph} style={bodyStyle}>
            {paragraph}
          </div>
        ))
      ) : (
        <div style={noteStyle}>
          This Profession is not yet described in full. The line above is its short summary, not the
          full explanation.
        </div>
      )}
      {prose.typicalActivities.length > 0 ? (
        <div style={{ display: "grid", gap: "0.2rem" }}>
          <strong style={{ fontSize: "0.9rem" }}>What a practitioner does</strong>
          <ul style={{ ...bodyStyle, margin: 0, paddingInlineStart: "1.1rem" }}>
            {prose.typicalActivities.map((activity) => (
              <li key={activity}>{activity}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {prose.boundaries.length > 0 ? (
        <div style={{ display: "grid", gap: "0.2rem" }}>
          <strong style={{ fontSize: "0.9rem" }}>What it does not cover</strong>
          <ul style={{ ...bodyStyle, margin: 0, paddingInlineStart: "1.1rem" }}>
            {prose.boundaries.map((boundary) => (
              <li key={boundary}>{boundary}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * One training route: the Learning Group it goes through, the Skills it actually teaches, its
 * choices in the canonical reader wording, and the Specializations it opens.
 *
 * Choices and Specializations are rendered inside the route that carries them, never collected into
 * a detached list (#372 sections 0.6 and 2).
 */
function TrainingRoute({
  entry,
  groupsById,
  showProse,
}: {
  entry: RouteEntry;
  groupsById: Map<string, SkillReferenceGroup>;
  showProse: boolean;
}) {
  const group = entry.group ? groupsById.get(entry.group.id) : undefined;
  return (
    <li style={{ display: "grid", gap: "0.3rem", marginBottom: "0.6rem" }}>
      <div>
        <strong>{entry.label}</strong>
        {entry.group ? ` · ${entry.group.name}` : ""}
      </div>
      {showProse && group ? <LearningGroupProse group={group} /> : null}
      {entry.teaches.length > 0 ? (
        <div style={bodyStyle}>Teaches {entry.teaches.map((skill) => skill.name).join(", ")}</div>
      ) : null}
      {entry.choices.map((choice) => (
        <div key={choice.id} style={bodyStyle}>
          {/* The canonical slot label is already reader language, for example "Choose one taught
              melee weapon family". The implementation term is never shown. */}
          <strong>{choice.label}:</strong>{" "}
          {choice.candidates.map((candidate) => candidate.name).join(", ")}
        </div>
      ))}
      {entry.specializations.length > 0 ? (
        <div style={bodyStyle}>
          Opens {entry.specializations.map((skill) => skill.name).join(", ")} — acquired separately,
          and the parent Skill must be far enough along.
        </div>
      ) : null}
    </li>
  );
}

/**
 * Steps 2 and 3 of the presentation order: what the Profession can train, then how it trains it.
 *
 * The reachable summary exists so a player never has to expand every Learning Group to discover
 * what a Profession teaches (#372 section 2). Breadth follows the settled section 5.2 counting
 * rules through the shared projection; possible reach is reported as possible reach and never
 * substituted for effective breadth.
 */
export function ProfessionTrainingOverview({
  profession,
  model,
  showGroupProse = true,
}: {
  profession: SkillReferenceProfession;
  model: SkillReferenceModel;
  showGroupProse?: boolean;
}) {
  const training = useMemo(() => professionTraining(profession, model), [profession, model]);
  const groupsById = useMemo(
    () => new Map(model.learningGroups.map((group) => [group.id, group])),
    [model],
  );
  const baseSkills = rangeLabel(training.effectiveBaseSkills);
  const specializations = rangeLabel(training.effectiveSpecializations);
  const listStyle = { margin: 0, paddingInlineStart: "1.1rem" } as const;

  return (
    <div style={{ display: "grid", gap: "0.9rem" }}>
      <section style={{ display: "grid", gap: "0.4rem" }}>
        <strong>What can I learn?</strong>
        <div style={bodyStyle}>
          {baseSkills} base {training.effectiveBaseSkills.max === 1 ? "Skill" : "Skills"} and{" "}
          {specializations}{" "}
          {training.effectiveSpecializations.max === 1 ? "Specialization" : "Specializations"}
          {training.writtenTraditionChoices > 0
            ? `, plus ${training.writtenTraditionChoices} written tradition of your choosing`
            : ""}
          .{" "}
          {training.effectiveBaseSkills.min !== training.effectiveBaseSkills.max
            ? "The range is the difference between this Profession's defining routes; only one of them defines a given practitioner."
            : ""}
        </div>
        <div style={noteStyle}>
          Each Skill is counted once, a choice counts only what it actually grants, and training you
          did not take is left out. Across every route this Profession could touch it reaches{" "}
          {training.possibleBaseSkillReach} distinct base Skills, which is everything it could
          possibly touch rather than what one practitioner learns.
        </div>
        <details>
          <summary>
            Everything this Profession can train — {training.reachable.length} listed
          </summary>
          <ul style={{ ...bodyStyle, ...listStyle }}>
            {training.reachable.map((entry) => (
              <li key={entry.link.id}>
                {entry.link.name}
                {entry.specialization ? " (Specialization)" : ""} — {entry.reach}
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section style={{ display: "grid", gap: "0.4rem" }}>
        <strong>How am I trained?</strong>
        {training.coreAlternatives.length > 0 ? (
          <div style={{ display: "grid", gap: "0.3rem" }}>
            <strong style={{ fontSize: "0.9rem" }}>
              {training.coreAlternatives.length === 1
                ? "Ordinary training"
                : `Ordinary training — ${training.coreAlternatives.length} alternatives, any one of which defines the Profession`}
            </strong>
            <ul style={listStyle}>
              {training.coreAlternatives.map((core) => (
                <li key={core.id} style={{ marginBottom: "0.5rem" }}>
                  <strong>{core.label}</strong>
                  {core.writtenTraditionChoices > 0 ? (
                    <div style={bodyStyle}>
                      Choose {core.writtenTraditionChoices} written tradition
                      {core.writtenTraditionChoices === 1 ? "" : "s"}
                    </div>
                  ) : null}
                  <ul style={listStyle}>
                    {core.entries.map((entry) => (
                      <TrainingRoute
                        key={entry.id}
                        entry={entry}
                        groupsById={groupsById}
                        showProse={showGroupProse}
                      />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {training.additional.length > 0 ? (
          <div style={{ display: "grid", gap: "0.3rem" }}>
            <strong style={{ fontSize: "0.9rem" }}>Additional training</strong>
            <ul style={listStyle}>
              {training.additional.map((entry) => (
                <TrainingRoute
                  key={entry.id}
                  entry={entry}
                  groupsById={groupsById}
                  showProse={showGroupProse}
                />
              ))}
            </ul>
          </div>
        ) : null}
        {/* Direct training comes after the grouped routes (#372 section 0.6). */}
        {training.direct.length > 0 ? (
          <div style={{ display: "grid", gap: "0.3rem" }}>
            <strong style={{ fontSize: "0.9rem" }}>Direct training</strong>
            <ul style={listStyle}>
              {training.direct.map((entry) => (
                <TrainingRoute
                  key={entry.id}
                  entry={entry}
                  groupsById={groupsById}
                  showProse={showGroupProse}
                />
              ))}
            </ul>
          </div>
        ) : null}
        <div style={noteStyle}>
          These are training opportunities. Choosing a Profession grants no ranks and spends no
          points; you decide what to train in the next step.
        </div>
      </section>
    </div>
  );
}
