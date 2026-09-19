import React, { useState } from "react";
import { createRoot } from "react-dom/client";

import { ArtifactInspectionDialog } from "../../src/features/artifacts/ArtifactInspectionDialog";
import { FullViewportInspection } from "../../src/features/artifacts/inspection/FullViewportInspection";
import { MediaInspectionViewport } from "../../src/features/artifacts/inspection/MediaInspectionViewport";

// A wide, clearly bounded image so fit, zoom, and pan are observable without any
// application, API, or database service.
const media = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="1600" height="1000">
    <rect width="1600" height="1000" fill="#e8dfc5"/>
    <rect x="8" y="8" width="1584" height="984" fill="none" stroke="#7a2f1d" stroke-width="16"/>
    <text x="800" y="520" font-family="serif" font-size="140" text-anchor="middle" fill="#7a2f1d">Northern pass</text>
  </svg>`,
)}`;

const artifact = {
  alt: "A mountain pass map",
  artifactKind: "map",
  audience: "Shared with Campaign",
  kind: "image" as const,
  src: media,
  title: "Northern pass",
};

function CampaignChrome({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: "1rem", padding: "1rem" }}>
      <header style={{ background: "#243733", color: "#fff", padding: "1rem" }}>
        <strong>Glantri</strong> · Campaign workspace
      </header>
      <nav style={{ display: "flex", gap: "0.5rem" }}>
        <button type="button">Roster</button>
        <button type="button">Scenarios</button>
        <button type="button">Artifacts</button>
      </nav>
      {children}
      <footer style={{ color: "#5e5a50" }}>Campaign log</footer>
    </div>
  );
}

function Fixture() {
  const [open, setOpen] = useState(false);
  const pagePresentation = window.location.hash === "#page";

  if (pagePresentation) {
    return (
      <FullViewportInspection
        closeOnEscape={false}
        exitLabel="Back to Blackboard"
        onExit={() => {}}
        presentation="page"
        subtitle="Artifact"
        title="Northern pass"
      >
        <MediaInspectionViewport alt={artifact.alt} mediaLabel="Artifact" src={media} />
      </FullViewportInspection>
    );
  }

  return (
    <CampaignChrome>
      <article
        style={{
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.55rem",
          padding: "1rem",
        }}
      >
        <strong>Northern pass</strong>
        <div>map · Shared with Campaign</div>
        <button
          aria-label="Inspect Northern pass"
          onClick={() => setOpen(true)}
          style={{ background: "none", border: 0, cursor: "zoom-in", display: "grid", padding: 0 }}
          type="button"
        >
          <img
            alt="A mountain pass map"
            src={media}
            style={{ maxHeight: 240, maxWidth: "100%", objectFit: "contain" }}
          />
        </button>
      </article>
      {open ? <ArtifactInspectionDialog artifact={artifact} onExit={() => setOpen(false)} /> : null}
    </CampaignChrome>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
