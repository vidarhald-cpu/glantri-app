"use client";

import type React from "react";
import { useMemo } from "react";
import type {
  SkillReferenceModel,
  SkillReferenceProfession,
} from "@/lib/skills/skillReferenceModel";
import {
  AccessOverview,
  BoundText,
  Block,
  LinkSeries,
  ProseIntroduction,
  ReferenceLinkView,
  Section,
} from "./ReferenceParts";
import {
  professionTraining,
  rangeLabel,
  readerProse,
  type RouteEntry,
} from "@/lib/skills/referenceCatalogue";
import type { Navigate } from "./referenceNavigation";
import styles from "./skillsReference.module.css";

function RouteBody({ entry, navigate }: { entry: RouteEntry; navigate: Navigate }) {
  return (
    <>
      {entry.group ? (
        <>
          {" · "}
          <ReferenceLinkView item={entry.group} tab="groups" navigate={navigate} />
        </>
      ) : null}
      <BoundText bound={entry.bound} />
      {entry.teaches.length > 0 && (
        <div>
          Teaches <LinkSeries items={entry.teaches} tab="skills" navigate={navigate} />
        </div>
      )}
      {entry.choices.map((choice) => (
        <div key={choice.id}>
          {/* The canonical slot label is already reader language, for example
              "Choose one taught craft". The implementation term choice slot is not shown. */}
          <strong>{choice.label}:</strong>{" "}
          <LinkSeries items={choice.candidates} tab="skills" navigate={navigate} />
        </div>
      ))}
      {entry.specializations.length > 0 && (
        <div>
          Specializations available (parent requirements apply):{" "}
          <LinkSeries items={entry.specializations} tab="skills" navigate={navigate} />
        </div>
      )}
    </>
  );
}

export function ProfessionInspector({
  profession,
  model,
  navigate,
  heading,
}: {
  profession: SkillReferenceProfession;
  model: SkillReferenceModel;
  navigate: Navigate;
  heading: React.RefObject<HTMLHeadingElement | null>;
}) {
  const training = useMemo(() => professionTraining(profession, model), [profession, model]);
  const prose = readerProse(profession.readerContent, "");
  const bandIndex = (band: string) => model.access.socialBands.findIndex((row) => row.id === band);
  const routes = [
    ...training.coreAlternatives.flatMap((core) => core.entries),
    ...training.additional,
    ...training.direct,
  ];
  const baseSkills = rangeLabel(training.effectiveBaseSkills);
  const specializations = rangeLabel(training.effectiveSpecializations);

  return (
    <article className={styles.detail} id={`profession-${profession.key}`}>
      <p className={styles.kind}>Profession</p>
      <h2 ref={heading} tabIndex={-1}>
        {profession.name}
      </h2>
      {/* Step 1: the occupation itself. Route counts belong in the table and the training overview. */}
      <ProseIntroduction
        prose={prose}
        unpublishedNote="A full description of this Profession has not been published yet."
      />
      <Block title="What can I learn?">
        <p>
          {baseSkills} effective base {training.effectiveBaseSkills.max === 1 ? "Skill" : "Skills"}{" "}
          and {specializations} reachable{" "}
          {training.effectiveSpecializations.max === 1 ? "Specialization" : "Specializations"}
          {training.writtenTraditionChoices > 0
            ? `, plus ${training.writtenTraditionChoices} written tradition of the learner's choosing`
            : ""}
          .{" "}
          {training.effectiveBaseSkills.min !== training.effectiveBaseSkills.max
            ? "The range is the difference between this Profession's core training routes; only one of them defines a given practitioner."
            : ""}
        </p>
        <p className={styles.scopeNote}>
          Effective breadth counts each Skill once, counts only how many a taught choice actually
          grants, and excludes routes a practitioner did not take. Across every alternative this
          Profession could touch {training.possibleBaseSkillReach} distinct base Skills; that is
          possible reach, not effective breadth.
        </p>
        <Section
          title={`Skills this Profession can train — ${training.reachable.length} listed`}
          empty="No competency is listed for this Profession."
        >
          {training.reachable.map((entry) => (
            <li key={entry.link.id}>
              <ReferenceLinkView item={entry.link} tab="skills" navigate={navigate} />
              {entry.specialization ? " (Specialization)" : ""} — {entry.reach}
            </li>
          ))}
        </Section>
      </Block>
      <Block title="How am I trained?">
        {training.coreAlternatives.length > 0 && (
          <>
            <h4>
              {training.coreAlternatives.length === 1
                ? "Core training"
                : `Core training — ${training.coreAlternatives.length} alternatives, any one of which defines the Profession`}
            </h4>
            <ul className={styles.opportunities}>
              {training.coreAlternatives.map((core) => (
                <li key={core.id}>
                  <strong>{core.label}</strong>
                  {core.writtenTraditionChoices > 0 && (
                    <div>
                      <strong>
                        Choose {core.writtenTraditionChoices} written tradition
                        {core.writtenTraditionChoices === 1 ? "" : "s"}
                      </strong>
                    </div>
                  )}
                  {core.entries.map((entry) => (
                    <div key={entry.id}>
                      {entry.label}
                      <RouteBody entry={entry} navigate={navigate} />
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </>
        )}
        {training.additional.length > 0 && (
          <>
            <h4>Additional training routes</h4>
            <ul className={styles.opportunities}>
              {training.additional.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.label}</strong>
                  <RouteBody entry={entry} navigate={navigate} />
                </li>
              ))}
            </ul>
          </>
        )}
        {training.direct.length > 0 && (
          <>
            <h4>Direct training</h4>
            <ul className={styles.opportunities}>
              {training.direct.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.label}</strong>
                  <RouteBody entry={entry} navigate={navigate} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Block>
      <details className={styles.fan}>
        <summary>Complete training reach — {routes.length} routes in full</summary>
        <ul className={styles.opportunities}>
          {routes.map((entry) => (
            <li key={`fan-${entry.id}`}>
              {profession.name} →{" "}
              {entry.group ? (
                <ReferenceLinkView item={entry.group} tab="groups" navigate={navigate} />
              ) : (
                entry.label
              )}
              {entry.teaches.length > 0 && (
                <div>
                  → <LinkSeries items={entry.teaches} tab="skills" navigate={navigate} />
                </div>
              )}
              {entry.choices.map((choice) => (
                <div key={`fan-${choice.id}`}>
                  → {choice.label}:{" "}
                  <LinkSeries items={choice.candidates} tab="skills" navigate={navigate} />
                </div>
              ))}
              {entry.specializations.length > 0 && (
                <div>
                  → <LinkSeries items={entry.specializations} tab="skills" navigate={navigate} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </details>
      <AccessOverview
        grid={model.access}
        intro="Where this Profession's training routes are open."
        cellLabel={(cell) => {
          if (!cell.validPathIds.includes(profession.id)) return "No valid route";
          const open = routes.filter(
            (entry) =>
              !entry.bound ||
              (entry.bound.minSocietyLevel <= cell.societyLevel &&
                bandIndex(entry.bound.minSocialBand) <= bandIndex(cell.socialBand)),
          ).length;
          return `${open} of ${routes.length} routes`;
        }}
      />
    </article>
  );
}
