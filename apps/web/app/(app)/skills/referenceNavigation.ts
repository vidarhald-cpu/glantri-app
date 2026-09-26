import type { ReferenceLink, SkillReferenceTab } from "@/lib/skills/skillReferenceModel";

export const referenceTabs: { id: SkillReferenceTab; label: string }[] = [
  { id: "skills", label: "Skills" },
  { id: "groups", label: "Learning Groups" },
  { id: "professions", label: "Professions" },
  { id: "societies", label: "Societies" },
  /* Section 2.6's Rules area under its established reader-facing label. There is only one. */
  { id: "rules", label: "How it works" },
];

export type Destination = { tab: SkillReferenceTab; key?: string };

const singulars: Record<Exclude<SkillReferenceTab, "rules">, string> = {
  skills: "skill",
  groups: "group",
  professions: "profession",
  societies: "society",
};

export function destinationFromHash(): Destination | undefined {
  if (typeof window === "undefined") return undefined;
  const value = decodeURIComponent(window.location.hash.slice(1));
  if (referenceTabs.some((tab) => tab.id === value)) return { tab: value as SkillReferenceTab };
  const match = /^(skill|group|profession|society)-(.+)$/.exec(value);
  if (match) {
    const tab = (Object.keys(singulars) as (keyof typeof singulars)[]).find(
      (key) => singulars[key] === match[1],
    );
    if (tab) return { tab, key: match[2] };
  }
  if (value.startsWith("competency-"))
    return { tab: "skills", key: value.slice("competency-".length) };
  return undefined;
}

export function hashFor(destination: Destination): string {
  if (!destination.key || destination.tab === "rules") return `#${destination.tab}`;
  return `#${singulars[destination.tab]}-${encodeURIComponent(destination.key)}`;
}

export function linkDestination(tab: SkillReferenceTab, item: ReferenceLink): Destination {
  return { tab, key: item.key };
}

export type Navigate = (destination: Destination, focus?: boolean) => void;
