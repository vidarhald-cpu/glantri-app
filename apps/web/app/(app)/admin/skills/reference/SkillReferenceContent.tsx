"use client";

import { useEffect, useState } from "react";
import { loadAdminSkillReferenceFromServer } from "@/lib/api/adminContentClient";
import { SkillReferenceContent as SharedSkillReferenceContent } from "../../../skills/SkillReferenceContent";
import {
  buildSkillReferenceModel,
  type SkillReferenceModel,
  type SkillReferenceTab,
} from "@/lib/skills/skillReferenceModel";
import { AdminReadOnlyNotice } from "../../admin-ui";

export function SkillReferenceContent({
  initialTab = "skills",
}: {
  initialTab?: SkillReferenceTab;
}) {
  const [model, setModel] = useState<SkillReferenceModel>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    loadAdminSkillReferenceFromServer()
      .then((source) => {
        if (active) setModel(buildSkillReferenceModel(source));
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "The competency reference is unavailable.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) return <AdminReadOnlyNotice message={error} />;
  if (!model) return <p role="status">Loading competency reference…</p>;
  return <SharedSkillReferenceContent model={model} admin initialTab={initialTab} />;
}
