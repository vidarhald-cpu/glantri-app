import React from "react";
import { createRoot } from "react-dom/client";
import { SkillReferenceContent } from "../../app/(app)/skills/SkillReferenceContent";
import { buildSkillReferenceModel } from "../../src/lib/skills/skillReferenceModel";

createRoot(document.getElementById("root")!).render(
  <SkillReferenceContent model={buildSkillReferenceModel()} />,
);
