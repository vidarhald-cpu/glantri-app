"use client";

import type React from "react";
import type {
  SkillReferenceGroup,
  SkillReferenceModel,
  SkillReferenceSkill,
  SkillReferenceSociety,
  WithdrawnGroup,
} from "@/lib/skills/skillReferenceModel";
import {
  AccessOverview,
  BoundText,
  Block,
  LinkSeries,
  ProseIntroduction,
  ReferenceLinkView,
  RelationshipRow,
  Section,
} from "./ReferenceParts";
import { groupTraining, readerProse } from "./referenceCatalogue";
import type { Navigate } from "./referenceNavigation";
import styles from "./skillsReference.module.css";

type Heading = React.RefObject<HTMLHeadingElement | null>;

/* -------------------------------------------------------------------- Skills */

export function SkillInspector({
  skill,
  model,
  navigate,
  heading,
}: {
  skill: SkillReferenceSkill;
  model: SkillReferenceModel;
  navigate: Navigate;
  heading: Heading;
}) {
  const groupCount = new Set(skill.groups.map((group) => group.id)).size;
  return (
    <article className={styles.detail} id={`skill-${skill.key}`}>
      <p className={styles.kind}>
        {skill.type} · {skill.category.replace(/-/g, " ")}
      </p>
      <h2 ref={heading} tabIndex={-1}>
        {skill.name}
      </h2>
      <p className={styles.lede}>{skill.description}</p>
      <dl className={styles.facts}>
        <div>
          <dt>Linked Stats</dt>
          <dd>{skill.linkedStats.join(" / ")}</dd>
        </div>
        <div>
          <dt>Learning Groups</dt>
          <dd>{groupCount}</dd>
        </div>
        {skill.parent && (
          <div>
            <dt>Immediate parent</dt>
            <dd>
              <ReferenceLinkView item={skill.parent} tab="skills" navigate={navigate} /> · level{" "}
              {skill.parent.minimumLevel} required
            </dd>
          </div>
        )}
      </dl>
      <Block title={`Learning Groups: ${groupCount}`}>
        {groupCount === 0 ? (
          <p>
            No Learning Group teaches this competency, so there is no Learning Group route to it. It
            is reached through a Profession&apos;s direct training where one is listed.
          </p>
        ) : (
          <ul>
            {skill.groups.map((group) => (
              <li key={`${group.id}-${group.membership}`}>
                <ReferenceLinkView item={group} tab="groups" navigate={navigate} /> —{" "}
                {group.membership === "fixed"
                  ? "fixed Skill"
                  : group.membership === "choice"
                    ? "one of the taught choices"
                    : "Specialization access"}
              </li>
            ))}
          </ul>
        )}
      </Block>
      <Section title="Direct Profession routes" empty="No direct Profession route is listed.">
        {skill.directRoutes.map((route, index) => (
          <li key={`${route.id}-${index}`}>
            <ReferenceLinkView item={route} tab="professions" navigate={navigate} /> — {route.label}
            <BoundText bound={route.bound} />
          </li>
        ))}
      </Section>
      <Section title="Child Specializations" empty="No child Specialization is listed.">
        {skill.children.map((child) => (
          <li key={child.id}>
            <ReferenceLinkView item={child} tab="skills" navigate={navigate} />
          </li>
        ))}
      </Section>
      <Section
        title="Mechanical relationships"
        empty="No current mechanical relationship is recorded."
      >
        {skill.relationships.map((relationship, index) => (
          <RelationshipRow
            key={`${relationship.mechanism}-${relationship.source.id}-${relationship.target.id}-${index}`}
            relationship={relationship}
            navigate={navigate}
          />
        ))}
      </Section>
      {skill.languageContexts.length > 0 && (
        <Section title="Language and civilization" empty="No civilization context is listed.">
          {skill.languageContexts.map((row) => (
            <li key={`${row.civilization}-${row.spoken}`}>
              {row.civilization} · Society Level {row.societyLevel} ·{" "}
              {row.spoken ? "spoken language" : "written tradition"}
            </li>
          ))}
        </Section>
      )}
      {skill.writtenFloor !== undefined && (
        <p>
          <strong>Written tradition:</strong> from Society Level {skill.writtenFloor}.
        </p>
      )}
      {skill.routeGaps.map((gap) => (
        <p key={gap.level}>
          <strong>Recorded route gap at Society Level {gap.level}:</strong> {gap.plausibility}
        </p>
      ))}
      <AccessOverview
        grid={model.access}
        intro="Where an authored training route reaches this competency."
        cellLabel={(cell) =>
          cell.reachableCompetencyIds.includes(skill.id) ? "Reachable" : "No authored route"
        }
      />
    </article>
  );
}

/* ----------------------------------------------------------- Learning Groups */

export function GroupInspector({
  group,
  model,
  navigate,
  heading,
}: {
  group: SkillReferenceGroup;
  model: SkillReferenceModel;
  navigate: Navigate;
  heading: Heading;
}) {
  const specializationIds = new Set(
    model.skills.filter((skill) => skill.type === "Specialization").map((skill) => skill.id),
  );
  const training = groupTraining(group, (id) => specializationIds.has(id));
  const prose = readerProse(group.readerContent, group.description);
  return (
    <article className={styles.detail} id={`group-${group.key}`}>
      <p className={styles.kind}>Learning Group</p>
      <h2 ref={heading} tabIndex={-1}>
        {group.name}
      </h2>
      <ProseIntroduction
        prose={prose}
        unpublishedNote="A full description of this training practice has not been published yet. The line above is its short summary, not the full explanation."
      />
      <Block title="What it teaches">
        <p>
          {training.fixedBaseSkills} fixed {training.fixedBaseSkills === 1 ? "Skill" : "Skills"}
          {training.trainingChoices > 0
            ? `, ${training.trainingChoices} taught ${training.trainingChoices === 1 ? "choice" : "choices"}`
            : ", no taught choices"}
          {training.specializations > 0
            ? `, ${training.specializations} listed ${training.specializations === 1 ? "Specialization" : "Specializations"}`
            : ""}
          .
        </p>
        {group.fixedSkills.length > 0 && (
          <p>
            <strong>Always taught:</strong>{" "}
            <LinkSeries items={group.fixedSkills} tab="skills" navigate={navigate} />
          </p>
        )}
        {group.selectionSlots.map((slot) => (
          <p key={slot.id}>
            <strong>{slot.label}:</strong>{" "}
            <LinkSeries items={slot.candidates} tab="skills" navigate={navigate} />
          </p>
        ))}
        {group.specializations.length > 0 && (
          <p>
            <strong>Listed Specializations</strong> (their own parent requirements apply):{" "}
            <LinkSeries items={group.specializations} tab="skills" navigate={navigate} />
          </p>
        )}
      </Block>
      <Section
        title={`Where it is used — ${training.professionRoutes} Profession ${training.professionRoutes === 1 ? "route" : "routes"}`}
        empty="No Profession route uses this Learning Group."
      >
        {group.professionRoutes.map((route, index) => (
          <li key={`${route.id}-${index}`}>
            <ReferenceLinkView item={route} tab="professions" navigate={navigate} /> — {route.label}
            <BoundText bound={route.bound} />
          </li>
        ))}
      </Section>
      {group.bound && (
        <p>
          <strong>Context:</strong> from Society Level {group.bound.minSocietyLevel}
          {group.bound.minSocialBand !== "L1"
            ? `, Social Band ${group.bound.minSocialBand}`
            : ""}. {group.bound.reasons.join(" ")}
        </p>
      )}
      <AccessOverview
        grid={model.access}
        intro="Where this training practice is available."
        cellLabel={(cell) =>
          cell.availableGroupIds.includes(group.id) ? "Available" : "Not available"
        }
      />
    </article>
  );
}

export function WithdrawnGroupInspector({
  group,
  model,
  navigate,
  heading,
}: {
  group: WithdrawnGroup;
  model: SkillReferenceModel;
  navigate: Navigate;
  heading: Heading;
}) {
  const soleSuccessor =
    group.successors.length === 1
      ? model.learningGroups.find((row) => row.id === group.successors[0]?.id)
      : undefined;
  return (
    <article className={styles.detail} id={`group-${group.id}`}>
      <p className={styles.kind}>Retired Learning Group</p>
      <h2 ref={heading} tabIndex={-1}>
        {group.name}
      </h2>
      <p className={styles.lede}>
        {group.successors.length === 0
          ? "Retired — no direct replacement"
          : `Replaced by ${group.successors.map((row) => row.id).join(" / ")}`}
      </p>
      {group.successors.length > 0 && (
        <ul>
          {group.successors.map((successor) => (
            <li key={successor.id}>
              <ReferenceLinkView item={successor} tab="groups" navigate={navigate} />
            </li>
          ))}
        </ul>
      )}
      {soleSuccessor && (
        <p>
          Current practice:{" "}
          <ReferenceLinkView item={soleSuccessor} tab="groups" navigate={navigate} /> —{" "}
          {soleSuccessor.description}
        </p>
      )}
    </article>
  );
}

/* ----------------------------------------------------------------- Societies */

export function SocietyInspector({
  society,
  model,
  heading,
}: {
  society: SkillReferenceSociety;
  model: SkillReferenceModel;
  heading: Heading;
}) {
  const authored = society.level <= model.access.authoredCeiling;
  const own = model.access.cells.filter((cell) => cell.societyLevel === society.level);
  const groupRange = own.map((cell) => cell.availableGroupIds.length);
  const pathRange = own.map((cell) => cell.validPathIds.length);
  const span = (values: number[]) =>
    values.length === 0
      ? "—"
      : Math.min(...values) === Math.max(...values)
        ? String(Math.min(...values))
        : `${Math.min(...values)}–${Math.max(...values)}`;
  return (
    <article className={styles.detail} id={`society-${society.key}`}>
      <p className={styles.kind}>Society Level {society.level}</p>
      <h2 ref={heading} tabIndex={-1}>
        {society.name}
      </h2>
      <p className={styles.lede}>{society.description}</p>
      {society.archSociety && (
        <p className={styles.prose}>
          <strong>Arch Society:</strong> {society.archSociety.name} —{" "}
          {society.archSociety.description} Arch Society is setting context; it does not determine
          competency access.
        </p>
      )}
      <Block title="What it offers a learner">
        {authored ? (
          <p>
            At Society Level {society.level}, {span(groupRange)} Learning{" "}
            {span(groupRange) === "1" ? "Group is" : "Groups are"} available and {span(pathRange)}{" "}
            Profession training {span(pathRange) === "1" ? "path is" : "paths are"} valid, depending
            on Social Band.
          </p>
        ) : (
          <p className={styles.unpublished}>
            Availability at Society Level {society.level} has not been authored yet, so no Learning
            Group or Profession opportunity count is stated for this Society.
          </p>
        )}
      </Block>
      <Section title="Civilization examples" empty="No civilization example is listed.">
        {society.civilizations.map((example) => (
          <li key={example.name}>
            <strong>{example.name}</strong> — {example.description.replace(/\.$/, "")}. Spoken:{" "}
            {example.spokenLanguage}
            {example.writtenLanguage ? `; written: ${example.writtenLanguage}` : ""}
          </li>
        ))}
      </Section>
      <Block title="Conditional access">
        {authored ? (
          <p>
            {new Set(groupRange).size > 1
              ? "Social Band changes what is available at this Society Level: the higher bands open training the lowest band does not reach."
              : "Every Social Band reaches the same training at this Society Level."}
          </p>
        ) : (
          <p className={styles.unpublished}>
            Social Band conditions at this Society Level are not yet authored.
          </p>
        )}
      </Block>
      <AccessOverview
        grid={model.access}
        intro={`Learning Groups and Profession paths available across the whole authored grid. Society Level ${society.level} is this Society's own row.`}
        cellLabel={(cell) =>
          `${cell.availableGroupIds.length} Groups · ${cell.validPathIds.length} paths`
        }
      />
    </article>
  );
}
