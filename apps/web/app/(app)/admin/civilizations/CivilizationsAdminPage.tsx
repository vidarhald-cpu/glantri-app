"use client";

import { useMemo } from "react";

import { useAdminContent } from "../../../../src/lib/admin/AdminContentContext";
import { AdminPageIntro, AdminPanel } from "../admin-ui";

export default function CivilizationsAdminPage() {
  const { content } = useAdminContent();
  const societiesById = useMemo(
    () => new Map(content.societies.map((society) => [society.id, society])),
    [content.societies]
  );
  const civilizations = useMemo(
    () =>
      [...content.civilizations].sort(
        (left, right) =>
          left.linkedSocietyLevel - right.linkedSocietyLevel ||
          left.name.localeCompare(right.name)
      ),
    [content.civilizations]
  );

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Rules & Documentation"
        title="Civilizations"
        summary="Civilization is the named cultural-historical layer. It stays distinct from society type and society level, but links to one supported society model so language naming and cultural flavor can sit above the structural access system."
      />

      <div style={{ display: "grid", gap: "1rem" }}>
        {civilizations.map((civilization) => {
          const linkedSociety = societiesById.get(civilization.linkedSocietyId);

          return (
            <AdminPanel
              key={civilization.id}
              subtitle={`${civilization.historicalAnalogue} - linked to ${
                linkedSociety?.name ?? civilization.linkedSocietyId
              } (level ${civilization.linkedSocietyLevel})`}
              title={civilization.name}
            >
              <div
                style={{
                  display: "grid",
                  gap: "1rem",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
                }}
              >
                <DetailBlock label="Short description" value={civilization.shortDescription} />
                <DetailBlock label="Historical analogue" value={civilization.historicalAnalogue} />
                <DetailBlock label="Period" value={civilization.period} />
                <DetailBlock label="Linked society" value={linkedSociety?.name ?? civilization.linkedSocietyId} />
                <DetailBlock label="Society level" value={String(civilization.linkedSocietyLevel)} />
                <DetailBlock label="Spoken language" value={civilization.spokenLanguageName} />
                <DetailBlock
                  label="Written language"
                  value={civilization.writtenLanguageName ?? "None recorded"}
                />
              </div>

              {civilization.notes ? (
                <div style={{ color: "#4f4635", lineHeight: 1.65, marginTop: "1rem" }}>
                  {civilization.notes}
                </div>
              ) : null}
            </AdminPanel>
          );
        })}
      </div>
    </section>
  );
}

function DetailBlock(props: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: "0.35rem" }}>
      <div
        style={{
          color: "#776b52",
          fontSize: "0.78rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase"
        }}
      >
        {props.label}
      </div>
      <div style={{ color: "#2e2619", lineHeight: 1.55 }}>{props.value}</div>
    </div>
  );
}
