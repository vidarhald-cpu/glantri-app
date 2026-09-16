import { fullSkillCatalogueProposal } from "@glantri/content/full-skill-catalogue-proposal";
import { targetLearningGroupCatalogue, targetProfessionCatalogue } from "@glantri/content";

export function TargetGroupDetails({ groupId }: { groupId: string }) {
  const group = targetLearningGroupCatalogue.groups.find((g) => g.id === groupId);
  if (!group) return null;
  return (
    <details>
      <summary>Inspect all members of {group.name}</summary>
      <p>{group.description}</p>
      <ul>
        {group.members.map((m) => (
          <li key={m.competencyId}>
            {m.name}
            {m.kind === "specialization"
              ? " — Specialization access; purchased separately (4 initially, 2 per increase), parent eligibility required"
              : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}
export function TargetPackageDetails({ professionId }: { professionId: string }) {
  const family = targetProfessionCatalogue.families.find(
    (f) => f.id === professionId || f.tracks.some((t) => t.id === professionId),
  );
  if (!family) return null;
  const track = family.tracks.find((t) => t.id === professionId);
  const opportunities = family.opportunities.filter(
    (o) => !track || track.opportunityIds.includes(o.id),
  );
  return (
    <div style={{ display: "grid", gap: ".75rem", overflowWrap: "anywhere" }}>
      <p>
        {family.name}
        {track ? ` — ${track.name}` : ""}. These are training opportunities. Selecting a Profession
        grants no ranks or points.
      </p>
      {family.code === "P65" ? (
        <p>
          Written Tradition instruction needs an actual context binding; no named written competency
          is supplied by this Profession.
        </p>
      ) : null}
      {opportunities.map((o) => (
        <section key={o.id}>
          <strong>
            {o.kind === "group"
              ? targetLearningGroupCatalogue.groups.find((g) => g.id === o.targetId)?.name
              : fullSkillCatalogueProposal.entries.find((c) => c.id === o.targetId)?.name}
          </strong>
          <p>
            {o.route}. {o.description}
          </p>
          {o.kind === "group" ? (
            <TargetGroupDetails groupId={o.targetId} />
          ) : o.kind === "specialization" ? (
            <p>Specialization access only; normal immediate-parent eligibility applies.</p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
