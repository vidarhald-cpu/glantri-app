import { getApprovedV2RuntimeContent } from "@glantri/content";

const content = getApprovedV2RuntimeContent();

export function TargetGroupDetails({ groupId }: { groupId: string }) {
  const group = content.skillGroups.find((candidate) => candidate.id === groupId);
  if (!group) return null;
  return (
    <details>
      <summary>Inspect all members of {group.name}</summary>
      <p>{group.description}</p>
      <ul>
        {(group.skillMemberships ?? []).map((member) => (
          <li key={member.skillId}>
            {content.skills.find((skill) => skill.id === member.skillId)?.name ?? member.skillId}
          </li>
        ))}
        {(group.selectionSlots ?? []).map((slot) => (
          <li key={slot.id}>
            {slot.label}: choose {slot.chooseCount} from{" "}
            {slot.candidateSkillIds
              .map((id) => content.skills.find((skill) => skill.id === id)?.name ?? id)
              .join(", ")}
          </li>
        ))}
        {(group.specializationIds ?? []).map((id) => (
          <li key={id}>
            {content.specializations.find((specialization) => specialization.id === id)?.name ?? id}
            {" — Specialization access; purchased separately, parent eligibility required"}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function TargetPackageDetails({ professionId }: { professionId: string }) {
  const path = content.competencyV2?.paths.find((candidate) => candidate.id === professionId);
  if (!path) return null;
  const family = content.professionFamilies.find((candidate) => candidate.id === path.familyId);
  const profession = content.professions.find((candidate) => candidate.id === path.id);
  return (
    <div style={{ display: "grid", gap: ".75rem", overflowWrap: "anywhere" }}>
      <p>
        {profession?.name ?? family?.name}. These are training opportunities. Selecting a Profession
        grants no ranks or points.
      </p>
      {path.coreRoutes.length > 1 ? (
        <p>
          Any one defining route qualifies: {path.coreRoutes.map((route) => route.label).join("; ")}
          .
        </p>
      ) : null}
      {path.routes.map((route) => (
        <section key={route.id}>
          <strong>
            {route.groupId
              ? content.skillGroups.find((group) => group.id === route.groupId)?.name
              : [...route.skillIds, ...route.specializationIds]
                  .map(
                    (id) =>
                      content.skills.find((skill) => skill.id === id)?.name ??
                      content.specializations.find((specialization) => specialization.id === id)
                        ?.name ??
                      id,
                  )
                  .join(", ")}
          </strong>
          <p>{route.label}</p>
          {route.groupId ? <TargetGroupDetails groupId={route.groupId} /> : null}
        </section>
      ))}
    </div>
  );
}
