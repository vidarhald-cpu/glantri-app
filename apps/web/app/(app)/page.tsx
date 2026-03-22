import { defaultCanonicalContent } from "@glantri/content";

const routeSummary = [
  "Next.js App Router web shell",
  "Dexie-backed local drafts and cache",
  "Fastify API scaffold for hosted sync later"
];

export default function HomePage() {
  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 720 }}>
      <div>
        <h1 style={{ marginBottom: "0.5rem" }}>Glantri architecture scaffold</h1>
        <p style={{ margin: 0 }}>
          The web app is now structured for offline local drafts, shared domain packages, and a
          separate API service.
        </p>
      </div>
      <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
        {routeSummary.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div>
        <h2 style={{ marginBottom: "0.5rem" }}>Canonical content scaffold</h2>
        <p style={{ margin: 0 }}>
          Skill groups: {defaultCanonicalContent.skillGroups.length}, skills:{" "}
          {defaultCanonicalContent.skills.length}, professions:{" "}
          {defaultCanonicalContent.professions.length}
        </p>
      </div>
    </section>
  );
}
