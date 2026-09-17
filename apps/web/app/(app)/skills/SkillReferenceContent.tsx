"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  SkillReferenceGroup,
  SkillReferenceModel,
  SkillReferenceProfession,
  SkillReferenceSkill,
  SkillReferenceTab,
} from "@/lib/skills/skillReferenceModel";
import styles from "./skillsReference.module.css";

const tabs: { id: SkillReferenceTab; label: string }[] = [
  { id: "skills", label: "Skills" },
  { id: "groups", label: "Learning Groups" },
  { id: "professions", label: "Professions" },
  { id: "societies", label: "Societies" },
];

type Destination = { tab: SkillReferenceTab; key?: string };

function destinationFromHash(): Destination | undefined {
  if (typeof window === "undefined") return undefined;
  const bareTab = window.location.hash.match(/^#(skills|groups|professions|societies)$/)?.[1];
  if (bareTab) return { tab: bareTab as SkillReferenceTab };
  const match = window.location.hash.match(/^#(skill|group|profession|society)-(.+)$/);
  if (!match) return undefined;
  const detailTab =
    match[1] === "skill"
      ? "skills"
      : match[1] === "group"
        ? "groups"
        : match[1] === "profession"
          ? "professions"
          : "societies";
  return { tab: detailTab, key: decodeURIComponent(match[2]!) };
}

function paragraphs(value: string) {
  return value.split(/\n\n+/).map((paragraph) => <p key={paragraph}>{paragraph}</p>);
}

function pointLabel(value: number): string {
  return `${value} ${value === 1 ? "point" : "points"}`;
}

function RelationshipLink(input: {
  children: React.ReactNode;
  destination: Destination;
  navigate: (destination: Destination) => void;
}) {
  const prefix = input.destination.tab === "groups" ? "group" : input.destination.tab.slice(0, -1);
  return (
    <a
      href={`#${prefix}-${encodeURIComponent(input.destination.key!)}`}
      onClick={(event) => {
        event.preventDefault();
        input.navigate(input.destination);
      }}
    >
      {input.children}
    </a>
  );
}

export function SkillReferenceContent({ model }: { model: SkillReferenceModel }) {
  const initial = destinationFromHash();
  const [activeTab, setActiveTab] = useState<SkillReferenceTab>(initial?.tab ?? "skills");
  const [selectedSkill, setSelectedSkill] = useState(
    initial?.tab === "skills" ? initial.key : model.skills[0]?.key,
  );
  const [selectedGroup, setSelectedGroup] = useState(
    initial?.tab === "groups" ? initial.key : model.learningGroups[0]?.key,
  );
  const [selectedProfession, setSelectedProfession] = useState(
    initial?.tab === "professions" ? initial.key : model.professions[0]?.key,
  );
  const [skillSearch, setSkillSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [professionSearch, setProfessionSearch] = useState("");
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const tabList = useRef<HTMLDivElement>(null);
  const focusDetail = useRef(false);

  function navigate(destination: Destination, focus = true) {
    setActiveTab(destination.tab);
    if (destination.tab === "skills" && destination.key) {
      setSkillSearch("");
      setSelectedSkill(destination.key);
    }
    if (destination.tab === "groups" && destination.key) {
      setGroupSearch("");
      setSelectedGroup(destination.key);
    }
    if (destination.tab === "professions" && destination.key) {
      setProfessionSearch("");
      setSelectedProfession(destination.key);
    }
    focusDetail.current = focus;
    const singular =
      destination.tab === "skills"
        ? "skill"
        : destination.tab === "groups"
          ? "group"
          : destination.tab === "professions"
            ? "profession"
            : "society";
    window.history.replaceState(
      null,
      "",
      destination.key
        ? `#${singular}-${encodeURIComponent(destination.key)}`
        : `#${destination.tab}`,
    );
  }

  useEffect(() => {
    const restore = () => {
      const destination = destinationFromHash();
      if (destination) navigate(destination, false);
    };
    window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  });

  useEffect(() => {
    if (focusDetail.current) {
      focusDetail.current = false;
      detailHeading.current?.focus();
    }
  }, [activeTab, selectedGroup, selectedProfession, selectedSkill]);

  return (
    <section className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Player and Game Master reference</p>
        <h1>Skills and training</h1>
        <p>
          Browse the competencies, Learning Groups, Professions, and societies used by current
          character creation. This reference explains access and cost; it does not grant ranks or
          spend points.
        </p>
      </header>

      <details className={styles.guide} open>
        <summary>How the Skill system works</summary>
        <div className={styles.guideGrid}>
          <GuideCard title="Points and direct learning">
            <p>
              Standard character creation begins with {model.guide.ordinaryPointTotal} ordinary
              Skill Points. The flexible pool is (INT + LCK) × the active ruleset factor.
            </p>
            <p>
              An individual Skill costs {model.guide.individualOrdinaryCost} points through an
              ordinary training path, or {model.guide.individualFlexibleCost} flexible point when
              that direct purchase is permitted.
            </p>
          </GuideCard>
          <GuideCard title="Skills and Specializations">
            <p>
              Skills are competencies linked to Stats. Purchased ranks record learned ability;
              simply having access never adds a rank.
            </p>
            <p>
              A Specialization costs {model.guide.specializationFirstCost} points when first learned
              and {model.guide.specializationIncreaseCost} for each increase. Its immediate parent
              must meet the listed level, including for a nested Specialization.
            </p>
          </GuideCard>
          <GuideCard title="Learning Groups">
            <p>
              A Learning Group is a coherent Profession-supported training opportunity. Its price is
              60% of its member Skills&apos; ordinary individual cost, rounded down, with a minimum
              of 1.
            </p>
            <p>
              When ordinary points are unavailable, flexible points may fund a group you can already
              access, but cannot independently unlock one. Listed Specializations supply access
              only, are bought separately, and do not affect the group price. Groups may overlap,
              and {model.inventory.grouplessBaseSkills} Skills deliberately belong to none.
            </p>
          </GuideCard>
          <GuideCard title="Professions">
            <p>
              A Profession provides a menu of Learning Groups and direct competencies. It grants no
              ranks, points, Skills, Specializations, or groups automatically. Family-wide and
              track-specific opportunities are marked below.
            </p>
          </GuideCard>
          <GuideCard title="Society and context">
            <p>
              Society and context describe where training and Professions are plausible. The path is
              Society and context → Profession → Learning Groups or direct competencies → Skills and
              Specializations.
            </p>
            <p>
              Generic Chargen currently shows the approved Profession list without applying
              unfinished Society, Arch Society, Social Band, Setting, geography, or period
              restrictions. Context-sensitive Profession availability is future work.
            </p>
          </GuideCard>
          <GuideCard title="Unique competency identities">
            <p>
              Spoken languages and written traditions are first-class competencies. A written
              tradition is not automatically granted by its spoken language. Each named competency
              is learned and advanced on its own terms.
            </p>
          </GuideCard>
        </div>
      </details>

      <div
        aria-label="Skill reference sections"
        className={styles.tabs}
        ref={tabList}
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            aria-controls={`panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            id={`tab-${tab.id}`}
            key={tab.id}
            onClick={() => navigate({ tab: tab.id }, false)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const current = tabs.findIndex((candidate) => candidate.id === tab.id);
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
              navigate({ tab: tabs[next]!.id }, false);
              tabList.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
            }}
            role="tab"
            tabIndex={activeTab === tab.id ? 0 : -1}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "skills" ? (
        <SkillsPanel
          detailHeading={detailHeading}
          model={model}
          navigate={navigate}
          query={skillSearch}
          selectedKey={selectedSkill}
          setQuery={setSkillSearch}
          setSelected={(key) => navigate({ tab: "skills", key })}
        />
      ) : null}
      {activeTab === "groups" ? (
        <GroupsPanel
          detailHeading={detailHeading}
          model={model}
          navigate={navigate}
          query={groupSearch}
          selectedKey={selectedGroup}
          setQuery={setGroupSearch}
          setSelected={(key) => navigate({ tab: "groups", key })}
        />
      ) : null}
      {activeTab === "professions" ? (
        <ProfessionsPanel
          detailHeading={detailHeading}
          model={model}
          navigate={navigate}
          query={professionSearch}
          selectedKey={selectedProfession}
          setQuery={setProfessionSearch}
          setSelected={(key) => navigate({ tab: "professions", key })}
        />
      ) : null}
      {activeTab === "societies" ? (
        <SocietiesPanel detailHeading={detailHeading} model={model} />
      ) : null}
    </section>
  );
}

function GuideCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

interface BrowserPanelProps {
  detailHeading: React.RefObject<HTMLHeadingElement | null>;
  model: SkillReferenceModel;
  navigate: (destination: Destination) => void;
  query: string;
  selectedKey?: string;
  setQuery: (value: string) => void;
  setSelected: (key: string) => void;
}

function SkillsPanel(props: BrowserPanelProps) {
  const filtered = useMemo(() => {
    const query = props.query.trim().toLowerCase();
    return props.model.skills.filter((skill) =>
      [skill.name, skill.description, skill.type, ...skill.linkedStats]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [props.model.skills, props.query]);
  const selected = filtered.find((skill) => skill.key === props.selectedKey) ?? filtered[0];

  return (
    <div aria-labelledby="tab-skills" id="panel-skills" role="tabpanel">
      <BrowserLayout
        count={filtered.length}
        empty="No Skills match this search."
        label="Search Skills, languages, and writing"
        list={filtered.map((skill) => ({
          key: skill.key,
          name: skill.name,
          meta: `${skill.type} · ${skill.linkedStats.join(" / ")}`,
        }))}
        onQuery={props.setQuery}
        query={props.query}
        selectedKey={selected?.key}
        setSelected={props.setSelected}
      >
        {selected ? (
          <SkillDetail
            detailHeading={props.detailHeading}
            navigate={props.navigate}
            skill={selected}
          />
        ) : null}
      </BrowserLayout>
    </div>
  );
}

function SkillDetail(props: {
  detailHeading: BrowserPanelProps["detailHeading"];
  navigate: BrowserPanelProps["navigate"];
  skill: SkillReferenceSkill;
}) {
  const skill = props.skill;
  return (
    <article className={styles.detail} id={`skill-${skill.key}`}>
      <p className={styles.kind}>{skill.type}</p>
      <h2 ref={props.detailHeading} tabIndex={-1}>
        {skill.name}
      </h2>
      <p className={styles.lede}>{skill.shortDescription}</p>
      <div className={styles.prose}>{paragraphs(skill.description)}</div>
      <dl className={styles.facts}>
        <div>
          <dt>Linked Stats</dt>
          <dd>{skill.linkedStats.join(" / ")}</dd>
        </div>
        <div>
          <dt>Current cost</dt>
          <dd>
            {skill.type === "Specialization"
              ? `${skill.firstCost} to learn; ${skill.increaseCost} per increase`
              : `${skill.ordinaryCost} ordinary; ${skill.flexibleCost} flexible when permitted`}
          </dd>
        </div>
        {skill.parent ? (
          <div>
            <dt>Immediate parent</dt>
            <dd>
              <RelationshipLink
                destination={{ tab: "skills", key: skill.parent.key }}
                navigate={props.navigate}
              >
                {skill.parent.name}
              </RelationshipLink>{" "}
              level {skill.parent.minimumLevel} required
            </dd>
          </div>
        ) : null}
      </dl>
      <RelationshipSection title="Typical uses" empty="No additional examples are listed.">
        {skill.typicalUses.map((use) => (
          <li key={use}>{use}</li>
        ))}
      </RelationshipSection>
      <RelationshipSection
        title="Learning Groups"
        empty="No Learning Group teaches this competency."
      >
        {skill.learningGroups.map((group) => (
          <li key={group.key}>
            <RelationshipLink
              destination={{ tab: "groups", key: group.key }}
              navigate={props.navigate}
            >
              {group.name}
            </RelationshipLink>
          </li>
        ))}
      </RelationshipSection>
      <RelationshipSection
        title="Child Specializations"
        empty="No child Specializations are listed."
      >
        {skill.children.map((child) => (
          <li key={child.key}>
            <RelationshipLink
              destination={{ tab: "skills", key: child.key }}
              navigate={props.navigate}
            >
              {child.name}
            </RelationshipLink>
          </li>
        ))}
      </RelationshipSection>
      <RelationshipSection
        title="Direct Profession access"
        empty="No Profession offers this competency directly."
      >
        {skill.directProfessionAccess.map((profession) => (
          <li key={`${profession.key}-${profession.name}`}>
            <RelationshipLink
              destination={{ tab: "professions", key: profession.key }}
              navigate={props.navigate}
            >
              {profession.name}
            </RelationshipLink>{" "}
            — {profession.route}
          </li>
        ))}
      </RelationshipSection>
    </article>
  );
}

function GroupsPanel(props: BrowserPanelProps) {
  const filtered = useMemo(() => {
    const query = props.query.trim().toLowerCase();
    return props.model.learningGroups.filter((group) =>
      [
        group.name,
        group.description,
        ...group.skills.map((skill) => skill.name),
        ...group.specializations.map((skill) => skill.name),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [props.model.learningGroups, props.query]);
  const selected = filtered.find((group) => group.key === props.selectedKey) ?? filtered[0];
  return (
    <div aria-labelledby="tab-groups" id="panel-groups" role="tabpanel">
      <BrowserLayout
        count={filtered.length}
        empty="No Learning Groups match this search."
        label="Search Learning Groups or members"
        list={filtered.map((group) => ({
          key: group.key,
          name: group.name,
          meta: `${pointLabel(group.price)} · ${group.skills.length} Skills${
            group.specializations.length ? ` · ${group.specializations.length} Specializations` : ""
          }`,
        }))}
        onQuery={props.setQuery}
        query={props.query}
        selectedKey={selected?.key}
        setSelected={props.setSelected}
      >
        {selected ? (
          <GroupDetail
            detailHeading={props.detailHeading}
            group={selected}
            navigate={props.navigate}
          />
        ) : null}
      </BrowserLayout>
      <details className={styles.groupless}>
        <summary>Skills without a Learning Group ({props.model.grouplessSkills.length})</summary>
        <p>These are valid Skills and may be available directly. No group is invented for them.</p>
        <ul className={styles.linkColumns}>
          {props.model.grouplessSkills.map((skill) => (
            <li key={skill.key}>
              <RelationshipLink
                destination={{ tab: "skills", key: skill.key }}
                navigate={props.navigate}
              >
                {skill.name}
              </RelationshipLink>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function GroupDetail(props: {
  detailHeading: BrowserPanelProps["detailHeading"];
  group: SkillReferenceGroup;
  navigate: BrowserPanelProps["navigate"];
}) {
  const group = props.group;
  return (
    <article className={styles.detail} id={`group-${group.key}`}>
      <p className={styles.kind}>Learning Group · {pointLabel(group.price)}</p>
      <h2 ref={props.detailHeading} tabIndex={-1}>
        {group.name}
      </h2>
      <p className={styles.lede}>{group.shortDescription}</p>
      <div className={styles.prose}>{paragraphs(group.description)}</div>
      {group.equipment ? (
        <p>
          <strong>Equipment and practice:</strong> {group.equipment}
        </p>
      ) : null}
      <RelationshipSection title="Member Skills" empty="No member Skills are listed.">
        {group.skills.map((skill) => (
          <li key={skill.key}>
            <RelationshipLink
              destination={{ tab: "skills", key: skill.key }}
              navigate={props.navigate}
            >
              {skill.name}
            </RelationshipLink>
          </li>
        ))}
      </RelationshipSection>
      <RelationshipSection
        title="Listed Specializations"
        empty="No Specializations are listed for access."
      >
        {group.specializations.map((skill) => (
          <li key={skill.key}>
            <RelationshipLink
              destination={{ tab: "skills", key: skill.key }}
              navigate={props.navigate}
            >
              {skill.name}
            </RelationshipLink>{" "}
            — parent: {skill.parentName}. Access only; bought separately.
          </li>
        ))}
      </RelationshipSection>
      <RelationshipSection title="Profession access" empty="No Profession access is listed.">
        {group.professionAccess.map((profession) => (
          <li key={`${profession.key}-${profession.name}`}>
            <RelationshipLink
              destination={{ tab: "professions", key: profession.key }}
              navigate={props.navigate}
            >
              {profession.name}
            </RelationshipLink>{" "}
            — {profession.route}
          </li>
        ))}
      </RelationshipSection>
    </article>
  );
}

function ProfessionsPanel(props: BrowserPanelProps) {
  const filtered = useMemo(() => {
    const query = props.query.trim().toLowerCase();
    return props.model.professions.filter((profession) =>
      [
        profession.name,
        profession.description,
        ...profession.tracks.map((track) => track.name),
        ...profession.opportunities.map((opportunity) => opportunity.name),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [props.model.professions, props.query]);
  const selected =
    filtered.find((profession) => profession.key === props.selectedKey) ?? filtered[0];
  return (
    <div aria-labelledby="tab-professions" id="panel-professions" role="tabpanel">
      <BrowserLayout
        count={filtered.length}
        empty="No Professions match this search."
        label="Search Professions, tracks, or training"
        list={filtered.map((profession) => ({
          key: profession.key,
          name: profession.name,
          meta: `${profession.opportunities.length} opportunities${
            profession.tracks.length ? ` · ${profession.tracks.length} tracks` : ""
          }`,
        }))}
        onQuery={props.setQuery}
        query={props.query}
        selectedKey={selected?.key}
        setSelected={props.setSelected}
      >
        {selected ? (
          <ProfessionDetail
            detailHeading={props.detailHeading}
            navigate={props.navigate}
            profession={selected}
          />
        ) : null}
      </BrowserLayout>
    </div>
  );
}

function ProfessionDetail(props: {
  detailHeading: BrowserPanelProps["detailHeading"];
  navigate: BrowserPanelProps["navigate"];
  profession: SkillReferenceProfession;
}) {
  const profession = props.profession;
  return (
    <article className={styles.detail} id={`profession-${profession.key}`}>
      <p className={styles.kind}>Profession</p>
      <h2 ref={props.detailHeading} tabIndex={-1}>
        {profession.name}
      </h2>
      <p className={styles.lede}>{profession.description}</p>
      <p className={styles.ruleCallout}>
        This is a menu of training access. It grants no ranks, points, competencies, or Learning
        Groups automatically.
      </p>
      {profession.exclusivityNote ? (
        <p className={styles.exclusive}>{profession.exclusivityNote}</p>
      ) : null}
      {profession.tracks.length ? (
        <section className={styles.relationships}>
          <h3>Explicit tracks</h3>
          <ul>
            {profession.tracks.map((track) => (
              <li key={track.name}>{track.name}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className={styles.relationships}>
        <h3>Training opportunities ({profession.opportunities.length})</h3>
        <ul className={styles.opportunities}>
          {profession.opportunities.map((opportunity) => (
            <li key={opportunity.key}>
              <div>
                <span className={styles.scope}>{opportunity.scope}</span>
                <strong>
                  <RelationshipLink
                    destination={{
                      tab: opportunity.kind === "Learning Group" ? "groups" : "skills",
                      key: opportunity.targetKey,
                    }}
                    navigate={props.navigate}
                  >
                    {opportunity.name}
                  </RelationshipLink>
                </strong>
                <span>
                  {opportunity.kind} · {opportunity.route}
                </span>
              </div>
              <p>{opportunity.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function SocietiesPanel(props: {
  detailHeading: BrowserPanelProps["detailHeading"];
  model: SkillReferenceModel;
}) {
  return (
    <div aria-labelledby="tab-societies" id="panel-societies" role="tabpanel">
      <section className={styles.societyBoundary}>
        <h2 ref={props.detailHeading} tabIndex={-1}>
          Society and training context
        </h2>
        <p>
          These society models and civilization examples describe the setting around plausible
          training. Generic Chargen does not yet filter Professions by Society, Arch Society, Social
          Band, Setting, geography, or period.
        </p>
      </section>
      <div className={styles.societies}>
        {props.model.societies.map((society) => (
          <article id={`society-${society.key}`} key={society.key}>
            <p className={styles.kind}>Society Level {society.level}</p>
            <h2>{society.name}</h2>
            <p>{society.description}</p>
            <h3>Civilization examples</h3>
            {society.examples.length ? (
              <ul>
                {society.examples.map((example) => (
                  <li key={example.name}>
                    <strong>{example.name}</strong>
                    <span>{example.description}</span>
                    <span>
                      {example.period} · Spoken: {example.spokenLanguage} · Written:{" "}
                      {example.writtenTradition ?? "No named written tradition"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No current civilization example is listed.</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function BrowserLayout(props: {
  children: React.ReactNode;
  count: number;
  empty: string;
  label: string;
  list: { key: string; name: string; meta: string }[];
  onQuery: (value: string) => void;
  query: string;
  selectedKey?: string;
  setSelected: (key: string) => void;
}) {
  return (
    <div className={styles.browser}>
      <aside className={styles.browserList}>
        <label>
          <span>{props.label}</span>
          <input
            aria-label={props.label}
            onChange={(event) => props.onQuery(event.target.value)}
            type="search"
            value={props.query}
          />
        </label>
        <p className={styles.resultCount}>{props.count} results</p>
        {props.list.length ? (
          <ul>
            {props.list.map((item) => (
              <li key={item.key}>
                <button
                  aria-current={item.key === props.selectedKey ? "true" : undefined}
                  onClick={() => props.setSelected(item.key)}
                  type="button"
                >
                  <strong>{item.name}</strong>
                  <span>{item.meta}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>{props.empty}</p>
        )}
      </aside>
      <div className={styles.detailPanel}>{props.children}</div>
    </div>
  );
}

function RelationshipSection(props: { children: React.ReactNode; empty: string; title: string }) {
  const children = Array.isArray(props.children) ? props.children.filter(Boolean) : props.children;
  const empty = Array.isArray(children) ? children.length === 0 : !children;
  return (
    <section className={styles.relationships}>
      <h3>{props.title}</h3>
      {empty ? <p>{props.empty}</p> : <ul>{children}</ul>}
    </section>
  );
}
