"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { loadLocalCharacterContext } from "../../../../../src/lib/characters/loadLocalCharacterContext";
import type { LocalCharacterRecord } from "../../../../../src/lib/offline/glantriDexie";
import { UNNAMED_CHARACTER_PLACEHOLDER } from "../../../../../src/lib/offline/repositories/localCharacterRepository";

interface ResumeCharacterProps {
  id: string;
}

function getCharacterName(record: LocalCharacterRecord): string {
  return record.build.name.trim() || UNNAMED_CHARACTER_PLACEHOLDER;
}

export default function ResumeCharacter({ id }: ResumeCharacterProps) {
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<LocalCharacterRecord>();

  useEffect(() => {
    let cancelled = false;

    loadLocalCharacterContext(id)
      .then((result) => {
        if (!cancelled) {
          setRecord(result.record);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <section>Loading character...</section>;
  }

  if (!record) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>Character not found</h1>
        <Link href="/characters">Back to characters</Link>
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 720 }}>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href="/characters">Back to characters</Link>
        <Link href={`/characters/${record.id}`}>Open details</Link>
        <Link href={`/characters/${record.id}/advance`}>Advance character</Link>
      </div>

      <div>
        <h1 style={{ marginBottom: "0.5rem" }}>Resume {getCharacterName(record)}</h1>
        <p style={{ margin: 0 }}>
          This route is the local-first reopen point for future progression work. Use the
          advancement flow to spend new points against the saved character while keeping a local
          draft separate from the saved record until you apply it.
        </p>
      </div>

      <div
        style={{
          background: "#f6f5ef",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.5rem",
          padding: "1rem"
        }}
      >
        <div>Profile: {record.build.profile.label}</div>
        <div>Society: {record.build.societyLevel ?? "Not set"}</div>
        <div>Social class: {record.build.socialClass ?? "Not set"}</div>
        <div>Profession: {record.build.professionId ?? "Not set"}</div>
      </div>
    </section>
  );
}
