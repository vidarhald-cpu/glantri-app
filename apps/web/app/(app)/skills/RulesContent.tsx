"use client";

import type React from "react";
import styles from "./skillsReference.module.css";

/**
 * The single Rules area required by section 2.1 and described by section 2.2, under the established
 * reader-facing "How it works" label. Section 2.6 keeps this the only Rules home: there is no second
 * "Access" area, and the Access Overview lives inside Inspectors rather than as a competing tab.
 */
export function RulesContent({
  ceiling,
  heading,
}: {
  ceiling: number;
  heading: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <section className={styles.guide}>
      <h2 ref={heading} tabIndex={-1}>
        How competency works in Glantri
      </h2>
      <div className={styles.guideGrid}>
        <section>
          <h3>Skills</h3>
          <p>
            A Skill represents learned ability. A Specialization focuses its immediate parent Skill
            and requires the listed parent level. Spoken languages and written traditions are
            distinct competencies.
          </p>
        </section>
        <section>
          <h3>Learning Groups</h3>
          <p>
            A Learning Group brings related Skills into one taught practice. Its fixed Skills belong
            to every route through that group; where the practice teaches a choice, it teaches only
            the stated number. Listed Specializations keep their own parent requirements.
          </p>
        </section>
        <section>
          <h3>Professions</h3>
          <p>
            A Profession makes Learning Groups and direct competencies available through named
            routes. Several core routes are alternatives: any one may define the Profession.
            Training access alone does not confer mastery.
          </p>
        </section>
        <section>
          <h3>What a Profession trains</h3>
          <p>
            Effective breadth counts each Skill once, counts only how many a taught choice actually
            grants, and leaves out routes a practitioner did not take. The wider set of Skills every
            alternative could touch is possible reach, which is reported separately and is not the
            same number.
          </p>
        </section>
        <section>
          <h3>Related competencies</h3>
          <p>
            An authored derived grant and a melee cross-training relationship show their own
            directional factors. A Specialization bridge follows its parent threshold, parent excess
            offset, and reverse factor. It is a bridge, not a transfer percentage. Only
            relationships listed on a competency are in this reference.
          </p>
        </section>
        <section>
          <h3>Society and Social Band</h3>
          <p>
            Society Level and Social Band can set the earliest context for a training route. A
            competency may be reached by another open route when one route is closed. Above Society
            Level {ceiling}, route availability has not yet been authored.
          </p>
        </section>
        <section>
          <h3>Arch Society</h3>
          <p>
            Arch Societies describe the setting and its societies. They do not determine competency
            access.
          </p>
        </section>
        <section>
          <h3>Character creation</h3>
          <p>
            A Character&apos;s Profession, society context, and chosen training together determine
            which Learning Groups and direct competencies can be learned. A written tradition is
            learned separately from its spoken language.
          </p>
        </section>
      </div>
    </section>
  );
}
