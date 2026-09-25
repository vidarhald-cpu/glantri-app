"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ReferenceBound,
  ReferenceLink,
  ReferenceRelationship,
  SkillReferenceGroup,
  SkillReferenceModel,
  SkillReferenceProfession,
  SkillReferenceSkill,
  SkillReferenceTab,
  WithdrawnGroup,
} from "@/lib/skills/skillReferenceModel";
import styles from "./skillsReference.module.css";

const tabs: { id: SkillReferenceTab; label: string }[] = [
  { id: "skills", label: "Skills" },
  { id: "groups", label: "Learning Groups" },
  { id: "professions", label: "Professions" },
  { id: "societies", label: "Societies" },
  { id: "rules", label: "How it works" },
];
type Destination = { tab: SkillReferenceTab; key?: string };

function destinationFromHash(): Destination | undefined {
  if (typeof window === "undefined") return undefined;
  const value = decodeURIComponent(window.location.hash.slice(1));
  if (tabs.some((tab) => tab.id === value)) return { tab: value as SkillReferenceTab };
  const match = /^(skill|group|profession|society)-(.+)$/.exec(value);
  if (match)
    return {
      tab:
        match[1] === "skill"
          ? "skills"
          : match[1] === "group"
            ? "groups"
            : match[1] === "profession"
              ? "professions"
              : "societies",
      key: match[2],
    };
  if (value.startsWith("competency-"))
    return { tab: "skills", key: value.slice("competency-".length) };
  return undefined;
}
function hashFor(destination: Destination): string {
  if (!destination.key) return `#${destination.tab}`;
  const singular =
    destination.tab === "skills"
      ? "skill"
      : destination.tab === "groups"
        ? "group"
        : destination.tab === "professions"
          ? "profession"
          : "society";
  return `#${singular}-${encodeURIComponent(destination.key)}`;
}
function linkDestination(tab: SkillReferenceTab, item: ReferenceLink): Destination {
  return { tab, key: item.key };
}

function ReferenceLinkView({
  item,
  tab,
  navigate,
}: {
  item: ReferenceLink;
  tab: SkillReferenceTab;
  navigate: (destination: Destination) => void;
}) {
  const destination = linkDestination(tab, item);
  return (
    <a
      href={hashFor(destination)}
      onClick={(event) => {
        event.preventDefault();
        navigate(destination);
      }}
    >
      {item.name}
    </a>
  );
}
function BoundText({ bound }: { bound?: ReferenceBound }) {
  if (!bound) return null;
  return (
    <span>
      {" "}
      · From Society Level {bound.minSocietyLevel}
      {bound.minSocialBand !== "L1" ? `, Social Band ${bound.minSocialBand}` : ""}
      {bound.reasons.length ? ` — ${bound.reasons.join(" ")}` : ""}
    </span>
  );
}
function Section({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty: string;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  return (
    <section className={styles.relationships}>
      <h3>{title}</h3>
      {Array.isArray(items) && items.length === 0 ? <p>{empty}</p> : <ul>{items}</ul>}
    </section>
  );
}
function BrowserLayout({
  count,
  label,
  list,
  query,
  onQuery,
  selectedKey,
  onSelect,
  children,
}: {
  count: number;
  label: string;
  list: { key: string; name: string; meta: string }[];
  query: string;
  onQuery: (value: string) => void;
  selectedKey?: string;
  onSelect: (key: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.browser}>
      <aside className={styles.browserList}>
        <label>
          <span>{label}</span>
          <input
            aria-label={label}
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
        </label>
        <p className={styles.resultCount}>{count} results</p>
        {list.length ? (
          <ul>
            {list.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  aria-current={selectedKey === item.key ? "true" : undefined}
                  onClick={() => onSelect(item.key)}
                >
                  <strong>{item.name}</strong>
                  <span>{item.meta}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No entries match this search.</p>
        )}
      </aside>
      <div className={styles.detailPanel}>{children}</div>
    </div>
  );
}
function factorLabel(factor: number): string {
  return factor === 1 ? "1.0" : String(factor);
}

export function SkillReferenceContent({
  model,
  admin = false,
  initialTab = "skills",
}: {
  model: SkillReferenceModel;
  admin?: boolean;
  initialTab?: SkillReferenceTab;
}) {
  const initial = destinationFromHash();
  const [activeTab, setActiveTab] = useState<SkillReferenceTab>(initial?.tab ?? initialTab);
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
  const [skillType, setSkillType] = useState("all");
  const [skillCategory, setSkillCategory] = useState("all");
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const focusDetail = useRef(false);
  const tabList = useRef<HTMLDivElement>(null);

  function applyDestination(destination: Destination, focus: boolean) {
    setActiveTab(destination.tab);
    if (destination.key) {
      if (destination.tab === "skills") {
        setSelectedSkill(destination.key);
        setSkillSearch("");
        setSkillType("all");
        setSkillCategory("all");
      }
      if (destination.tab === "groups") {
        setSelectedGroup(destination.key);
        setGroupSearch("");
      }
      if (destination.tab === "professions") {
        setSelectedProfession(destination.key);
        setProfessionSearch("");
      }
    }
    focusDetail.current = focus;
  }
  function navigate(destination: Destination, focus = true) {
    applyDestination(destination, focus);
    const hash = hashFor(destination);
    if (window.location.hash !== hash) window.location.hash = hash;
  }
  useEffect(() => {
    const restore = () => {
      const destination = destinationFromHash();
      if (destination) applyDestination(destination, false);
    };
    window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  }, []);
  useEffect(() => {
    if (focusDetail.current) {
      focusDetail.current = false;
      detailHeading.current?.focus();
    }
  }, [activeTab, selectedSkill, selectedGroup, selectedProfession]);

  const categories = useMemo(
    () => [...new Set(model.skills.map((skill) => skill.category))].sort(),
    [model.skills],
  );
  const filteredSkills = useMemo(
    () =>
      model.skills.filter(
        (skill) =>
          (skillType === "all" || skill.type === skillType) &&
          (skillCategory === "all" || skill.category === skillCategory) &&
          [skill.name, skill.description, skill.type, skill.category, ...skill.linkedStats]
            .join(" ")
            .toLowerCase()
            .includes(skillSearch.trim().toLowerCase()),
      ),
    [model.skills, skillType, skillCategory, skillSearch],
  );
  const filteredGroups = useMemo(
    () =>
      model.learningGroups.filter((group) =>
        [
          group.name,
          group.description,
          ...group.fixedSkills.map((item) => item.name),
          ...group.selectionSlots.flatMap((slot) => slot.candidates.map((item) => item.name)),
        ]
          .join(" ")
          .toLowerCase()
          .includes(groupSearch.trim().toLowerCase()),
      ),
    [model.learningGroups, groupSearch],
  );
  const filteredProfessions = useMemo(
    () =>
      model.professions.filter((profession) =>
        [
          profession.name,
          ...profession.routes.map((route) => route.label),
          ...profession.coreAlternatives.map((route) => route.label),
        ]
          .join(" ")
          .toLowerCase()
          .includes(professionSearch.trim().toLowerCase()),
      ),
    [model.professions, professionSearch],
  );
  const selectedSkillModel =
    filteredSkills.find((skill) => skill.key === selectedSkill || skill.id === selectedSkill) ??
    filteredSkills[0];
  const withdrawn = model.withdrawnGroups.find((group) => group.id === selectedGroup);
  const selectedGroupModel =
    filteredGroups.find((group) => group.key === selectedGroup || group.id === selectedGroup) ??
    filteredGroups[0];
  const selectedProfessionModel =
    filteredProfessions.find(
      (profession) => profession.key === selectedProfession || profession.id === selectedProfession,
    ) ?? filteredProfessions[0];

  return (
    <section className={`${styles.page} ${admin ? styles.adminPage : ""}`}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>
          {admin ? "Admin competency reference" : "Player and Game Master reference"}
        </p>
        <h1>Skills and training</h1>
        <p>
          Explore the Skills, Learning Groups, Professions, and societies of Glantri, and the routes
          through which training becomes available.
        </p>
      </header>
      <div
        aria-label="Skill reference sections"
        className={styles.tabs}
        ref={tabList}
        role="tablist"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-controls={`panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            type="button"
            onClick={() => navigate({ tab: tab.id }, false)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
              navigate({ tab: tabs[next]!.id }, false);
              tabList.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === "skills" && (
        <div id="panel-skills" role="tabpanel" aria-labelledby="tab-skills">
          <div className={styles.filters}>
            <label>
              Type{" "}
              <select
                aria-label="Competency type"
                value={skillType}
                onChange={(event) => setSkillType(event.target.value)}
              >
                <option value="all">All types</option>
                {["Skill", "Specialization", "Spoken language", "Written tradition"].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Category{" "}
              <select
                aria-label="Competency category"
                value={skillCategory}
                onChange={(event) => setSkillCategory(event.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category.replace(/-/g, " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <BrowserLayout
            count={filteredSkills.length}
            label="Search Skills, languages, and writing"
            list={filteredSkills.map((skill) => ({
              key: skill.key,
              name: skill.name,
              meta: `${skill.type} · ${skill.linkedStats.join(" / ")}`,
            }))}
            query={skillSearch}
            onQuery={setSkillSearch}
            selectedKey={selectedSkillModel?.key}
            onSelect={(key) => navigate({ tab: "skills", key })}
          >
            {selectedSkillModel && (
              <SkillDetail
                skill={selectedSkillModel}
                model={model}
                navigate={navigate}
                heading={detailHeading}
              />
            )}
          </BrowserLayout>
        </div>
      )}
      {activeTab === "groups" && (
        <div id="panel-groups" role="tabpanel" aria-labelledby="tab-groups">
          <BrowserLayout
            count={filteredGroups.length}
            label="Search Learning Groups or members"
            list={filteredGroups.map((group) => ({
              key: group.key,
              name: group.name,
              meta: `${group.fixedSkills.length} fixed Skills · ${group.selectionSlots.length} choice slots`,
            }))}
            query={groupSearch}
            onQuery={setGroupSearch}
            selectedKey={withdrawn ? undefined : selectedGroupModel?.key}
            onSelect={(key) => navigate({ tab: "groups", key })}
          >
            {withdrawn ? (
              <WithdrawnGroupDetail
                group={withdrawn}
                model={model}
                navigate={navigate}
                heading={detailHeading}
              />
            ) : (
              selectedGroupModel && (
                <GroupDetail
                  group={selectedGroupModel}
                  navigate={navigate}
                  heading={detailHeading}
                />
              )
            )}
          </BrowserLayout>
          <details className={styles.groupless}>
            <summary>Retired Learning Groups ({model.withdrawnGroups.length})</summary>
            <ul>
              {model.withdrawnGroups.map((group) => (
                <li key={group.id}>
                  <a
                    href={`#group-${group.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate({ tab: "groups", key: group.id });
                    }}
                  >
                    {group.name}
                  </a>
                </li>
              ))}
            </ul>
          </details>
          <details className={styles.groupless}>
            <summary>Skills without a Learning Group ({model.grouplessSkills.length})</summary>
            <ul>
              {model.grouplessSkills.map((skill) => (
                <li key={skill.id}>
                  <ReferenceLinkView item={skill} tab="skills" navigate={navigate} />
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
      {activeTab === "professions" && (
        <div id="panel-professions" role="tabpanel" aria-labelledby="tab-professions">
          <BrowserLayout
            count={filteredProfessions.length}
            label="Search Professions, tracks, or training"
            list={filteredProfessions.map((profession) => ({
              key: profession.key,
              name: profession.name,
              meta: `${profession.coreAlternatives.length} core routes · ${profession.routes.length} training routes`,
            }))}
            query={professionSearch}
            onQuery={setProfessionSearch}
            selectedKey={selectedProfessionModel?.key}
            onSelect={(key) => navigate({ tab: "professions", key })}
          >
            {selectedProfessionModel && (
              <ProfessionDetail
                profession={selectedProfessionModel}
                navigate={navigate}
                heading={detailHeading}
              />
            )}
          </BrowserLayout>
        </div>
      )}
      {activeTab === "societies" && (
        <div id="panel-societies" role="tabpanel" aria-labelledby="tab-societies">
          <section className={styles.societyBoundary}>
            <h2 ref={detailHeading} tabIndex={-1}>
              Societies and civilizations
            </h2>
            <p>
              These identities describe Glantri's setting. Arch Society is setting context; it is
              not a rule for competency access.
            </p>
          </section>
          <div className={styles.societies}>
            {model.societies.map((society) => (
              <article id={`society-${society.key}`} key={society.id}>
                <p className={styles.kind}>Society Level {society.level}</p>
                <h2>{society.name}</h2>
                <p>{society.description}</p>
                {society.archSociety && (
                  <p>
                    <strong>Arch Society:</strong> {society.archSociety.name} —{" "}
                    {society.archSociety.description}
                  </p>
                )}
                <h3>Civilization examples</h3>
                <ul>
                  {society.civilizations.map((example) => (
                    <li key={example.name}>
                      <strong>{example.name}</strong> — {example.description}. Spoken:{" "}
                      {example.spokenLanguage}
                      {example.writtenLanguage ? `; written: ${example.writtenLanguage}` : ""}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      )}
      {activeTab === "rules" && (
        <div id="panel-rules" role="tabpanel" aria-labelledby="tab-rules">
          <RulesContent ceiling={model.authoredCeiling} heading={detailHeading} />
        </div>
      )}
    </section>
  );
}

function SkillDetail({
  skill,
  model,
  navigate,
  heading,
}: {
  skill: SkillReferenceSkill;
  model: SkillReferenceModel;
  navigate: (destination: Destination) => void;
  heading: React.RefObject<HTMLHeadingElement | null>;
}) {
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
        {skill.parent && (
          <div>
            <dt>Immediate parent</dt>
            <dd>
              <ReferenceLinkView item={skill.parent} tab="skills" navigate={navigate} /> · level{" "}
              {skill.parent.minimumLevel} required
            </dd>
          </div>
        )}
        {skill.writtenFloor && (
          <div>
            <dt>Written tradition</dt>
            <dd>From Society Level {skill.writtenFloor}</dd>
          </div>
        )}
      </dl>
      <Section title="Learning Groups" empty="No Learning Group teaches this competency.">
        {skill.groups.map((group) => (
          <li key={`${group.id}-${group.membership}`}>
            <ReferenceLinkView item={group} tab="groups" navigate={navigate} /> —{" "}
            {group.membership === "fixed"
              ? "fixed Skill"
              : group.membership === "choice"
                ? "choice candidate"
                : "Specialization access"}
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
      <Section title="Direct Profession routes" empty="No direct Profession route is listed.">
        {skill.directRoutes.map((route, index) => (
          <li key={`${route.id}-${index}`}>
            <ReferenceLinkView item={route} tab="professions" navigate={navigate} /> — {route.label}
            <BoundText bound={route.bound} />
          </li>
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
      <section className={styles.relationships}>
        <h3>Society Level and Social Band routes</h3>
        <ul>
          {skill.availableBands.map((row) => (
            <li key={row.level}>
              Society Level {row.level}:{" "}
              {row.bands.length ? row.bands.join(" / ") : "No authored route"}
            </li>
          ))}
        </ul>
        <p>Above Society Level {model.authoredCeiling}, route availability is unauthored.</p>
        {skill.routeGaps.map((gap) => (
          <p key={gap.level}>
            <strong>Recorded route gap at Society Level {gap.level}:</strong> {gap.plausibility}
          </p>
        ))}
      </section>
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
    </article>
  );
}
function RelationshipRow({
  relationship,
  navigate,
}: {
  relationship: ReferenceRelationship;
  navigate: (destination: Destination) => void;
}) {
  return (
    <li>
      <ReferenceLinkView item={relationship.source} tab="skills" navigate={navigate} /> →{" "}
      <ReferenceLinkView item={relationship.target} tab="skills" navigate={navigate} /> ·{" "}
      <strong>{relationship.mechanism}</strong>.{" "}
      {relationship.bridge
        ? `Parent threshold ${relationship.bridge.threshold}; parent excess offset ${relationship.bridge.parentExcessOffset}; reverse factor ${factorLabel(relationship.bridge.reverseFactor)} from the Specialization to its parent.`
        : `Factor ${factorLabel(relationship.factor!)}.`}
    </li>
  );
}
function GroupDetail({
  group,
  navigate,
  heading,
}: {
  group: SkillReferenceGroup;
  navigate: (destination: Destination) => void;
  heading: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <article className={styles.detail} id={`group-${group.key}`}>
      <p className={styles.kind}>Learning Group</p>
      <h2 ref={heading} tabIndex={-1}>
        {group.name}
      </h2>
      <p className={styles.lede}>{group.description}</p>
      {group.bound && (
        <p>
          <strong>Context:</strong> From Society Level {group.bound.minSocietyLevel}
          {group.bound.minSocialBand !== "L1"
            ? `, Social Band ${group.bound.minSocialBand}`
            : ""}. {group.bound.reasons.join(" ")}
        </p>
      )}
      <Section title="Fixed Skills" empty="No fixed Skill is listed.">
        {group.fixedSkills.map((skill) => (
          <li key={skill.id}>
            <ReferenceLinkView item={skill} tab="skills" navigate={navigate} />
          </li>
        ))}
      </Section>
      {group.selectionSlots.map((slot) => (
        <Section
          key={slot.id}
          title={`${slot.label} — choose ${slot.chooseCount}`}
          empty="No choices are listed."
        >
          {slot.candidates.map((skill) => (
            <li key={skill.id}>
              <ReferenceLinkView item={skill} tab="skills" navigate={navigate} />
            </li>
          ))}
        </Section>
      ))}
      <Section title="Listed Specializations" empty="No Specialization is listed.">
        {group.specializations.map((skill) => (
          <li key={skill.id}>
            <ReferenceLinkView item={skill} tab="skills" navigate={navigate} /> · parent
            requirements apply
          </li>
        ))}
      </Section>
      <Section title="Profession routes" empty="No Profession route is listed.">
        {group.professionRoutes.map((route, index) => (
          <li key={`${route.id}-${index}`}>
            <ReferenceLinkView item={route} tab="professions" navigate={navigate} /> — {route.label}
            <BoundText bound={route.bound} />
          </li>
        ))}
      </Section>
    </article>
  );
}
function WithdrawnGroupDetail({
  group,
  model,
  navigate,
  heading,
}: {
  group: WithdrawnGroup;
  model: SkillReferenceModel;
  navigate: (destination: Destination) => void;
  heading: React.RefObject<HTMLHeadingElement | null>;
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
function ProfessionDetail({
  profession,
  navigate,
  heading,
}: {
  profession: SkillReferenceProfession;
  navigate: (destination: Destination) => void;
  heading: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <article className={styles.detail} id={`profession-${profession.key}`}>
      <p className={styles.kind}>Profession path</p>
      <h2 ref={heading} tabIndex={-1}>
        {profession.name}
      </h2>
      <p className={styles.lede}>
        This Profession has {profession.coreAlternatives.length} defining{" "}
        {profession.coreAlternatives.length === 1 ? "route" : "route alternatives"} and{" "}
        {profession.routes.length} training routes.
      </p>
      <Section title="Core alternatives" empty="No core route is listed.">
        {profession.coreAlternatives.map((core) => (
          <li key={core.id}>
            <strong>{core.label}</strong>
            {core.groups.length > 0 && (
              <>
                {" "}
                · Groups:{" "}
                {core.groups.map((group, index) => (
                  <span key={group.id}>
                    {index > 0 ? " / " : ""}
                    <ReferenceLinkView item={group} tab="groups" navigate={navigate} />
                  </span>
                ))}
              </>
            )}
            {core.skills.length > 0 && (
              <>
                {" "}
                · Skills:{" "}
                {core.skills.map((skill, index) => (
                  <span key={skill.id}>
                    {index > 0 ? " / " : ""}
                    <ReferenceLinkView item={skill} tab="skills" navigate={navigate} />
                  </span>
                ))}
              </>
            )}
            {core.writtenChoiceCount > 0 &&
              ` · Choose ${core.writtenChoiceCount} written tradition`}
          </li>
        ))}
      </Section>
      <Section title="Choice slots" empty="No Learning Group choice slot is listed for this path.">
        {profession.choiceSlots.map((slot) => (
          <li key={`${slot.group.id}-${slot.label}`}>
            <ReferenceLinkView item={slot.group} tab="groups" navigate={navigate} /> · {slot.label}:
            choose {slot.chooseCount} from{" "}
            {slot.candidates.map((skill, index) => (
              <span key={skill.id}>
                {index > 0 ? " / " : ""}
                <ReferenceLinkView item={skill} tab="skills" navigate={navigate} />
              </span>
            ))}
          </li>
        ))}
      </Section>
      <Section title="Training routes" empty="No training route is listed.">
        {profession.routes.map((route) => (
          <li key={route.id}>
            <strong>{route.label}</strong> ·{" "}
            {route.group ? (
              <ReferenceLinkView item={route.group} tab="groups" navigate={navigate} />
            ) : (
              [...route.skills, ...route.specializations].map((skill, index) => (
                <span key={skill.id}>
                  {index > 0 ? " / " : ""}
                  <ReferenceLinkView item={skill} tab="skills" navigate={navigate} />
                </span>
              ))
            )}
            <BoundText bound={route.bound} />
          </li>
        ))}
      </Section>
    </article>
  );
}
function RulesContent({
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
            A Learning Group brings related Skills into one taught practice. Fixed Skills belong to
            every route through that group; a choice slot teaches only its stated number of
            candidates. Listed Specializations keep their own parent requirements.
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
            A Character's Profession, society context, and chosen training together determine which
            Learning Groups and direct competencies can be learned. A written tradition is learned
            separately from its spoken language.
          </p>
        </section>
      </div>
    </section>
  );
}
