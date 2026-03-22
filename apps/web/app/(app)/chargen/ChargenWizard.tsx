"use client";

import { useEffect, useState } from "react";

import {
  defaultCanonicalContent,
  type CanonicalContent,
  validateCanonicalContent
} from "@glantri/content";
import type {
  CharacterProgression,
  ProfessionDefinition,
  RolledCharacterProfile,
  SkillDefinition,
  SkillSpecialization,
  SocietyLevelAccess
} from "@glantri/domain";
import {
  applyProfessionGrants,
  buildChargenDraftView,
  createChargenProgression,
  finalizeChargenDraft,
  generateProfiles,
  getAllowedPrimaryGroupIds,
  getAllowedSecondaryGroupIds,
  getPrimaryPurchaseCostForGroup,
  getPrimaryPurchaseCostForSkill,
  getSecondaryPurchaseCostForSkill,
  getSecondaryPurchaseCostForSpecialization,
  normalizeChargenProgression,
  reviewChargenDraft,
  selectProfile,
  spendPrimaryPoint,
  spendSecondaryPoint,
  summarizeRolledProfile,
  type RolledProfileSummary
} from "@glantri/rules-engine";

import type { LocalCharacterRecord } from "../../../src/lib/offline/glantriDexie";
import { ChargenSessionRepository } from "../../../src/lib/offline/repositories/chargenSessionRepository";
import { ContentCacheRepository } from "../../../src/lib/offline/repositories/contentCacheRepository";
import { LocalCharacterRepository } from "../../../src/lib/offline/repositories/localCharacterRepository";

const SESSION_ID = "chargen-vertical-slice";
const CONTENT_CACHE_KEY = "canonical-content";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const chargenSessionRepository = new ChargenSessionRepository();
const contentCacheRepository = new ContentCacheRepository();
const localCharacterRepository = new LocalCharacterRepository();

const rolledProfiles = generateProfiles({});
const UNIVERSAL_SOCIAL_BANDS = [1, 2, 3, 4] as const;

interface ContentResponse {
  content: CanonicalContent;
}

type SocialBand = 1 | 2 | 3 | 4;

interface SocietyOption {
  id: string;
  name: string;
  notes?: string;
  socialBands: Partial<Record<SocialBand, SocietyLevelAccess>>;
}

function getAllowedProfessions(
  professions: ProfessionDefinition[],
  societyLevel: SocietyLevelAccess | undefined
): ProfessionDefinition[] {
  if (!societyLevel) {
    return [];
  }

  return professions.filter((profession) => societyLevel.professionIds.includes(profession.id));
}

function sortSkills(skills: SkillDefinition[]): SkillDefinition[] {
  return [...skills].sort((left, right) => left.sortOrder - right.sortOrder);
}

function sortSpecializations(specializations: SkillSpecialization[]): SkillSpecialization[] {
  return [...specializations].sort((left, right) => left.sortOrder - right.sortOrder);
}

function formatSkillCategory(category: SkillDefinition["category"]): string {
  return category === "secondary" ? "Secondary" : "Ordinary";
}

function getSocialBand(roll: number): SocialBand {
  if (roll <= 10) {
    return 1;
  }

  if (roll <= 15) {
    return 2;
  }

  if (roll <= 18) {
    return 3;
  }

  return 4;
}

function getBandRangeLabel(band: SocialBand): string {
  switch (band) {
    case 1:
      return "1-10";
    case 2:
      return "11-15";
    case 3:
      return "16-18";
    case 4:
      return "19-20";
  }
}

function buildSocietyOptions(societyLevels: SocietyLevelAccess[]): SocietyOption[] {
  const societies = new Map<string, SocietyOption>();

  for (const societyLevel of societyLevels) {
    if (!UNIVERSAL_SOCIAL_BANDS.includes(societyLevel.societyLevel as SocialBand)) {
      throw new Error(
        `Society "${societyLevel.societyName}" (${societyLevel.societyId}) uses unsupported social band ${societyLevel.societyLevel}.`
      );
    }

    const band = societyLevel.societyLevel as SocialBand;
    const existing = societies.get(societyLevel.societyId);

    if (existing) {
      if (existing.socialBands[band]) {
        throw new Error(
          `Duplicate social band row for society "${societyLevel.societyName}" (${societyLevel.societyId}), band ${band}.`
        );
      }

      existing.notes ??= societyLevel.notes;
      existing.socialBands[band] = societyLevel;
      continue;
    }

    societies.set(societyLevel.societyId, {
      id: societyLevel.societyId,
      name: societyLevel.societyName,
      notes: societyLevel.notes,
      socialBands: {
        [band]: societyLevel
      }
    });
  }

  for (const society of societies.values()) {
    const missingBands = UNIVERSAL_SOCIAL_BANDS.filter((band) => !society.socialBands[band]);

    if (missingBands.length > 0) {
      throw new Error(
        `Society "${society.name}" (${society.id}) is missing social band(s): ${missingBands.join(", ")}.`
      );
    }
  }

  return [...societies.values()].sort((left, right) => left.name.localeCompare(right.name));
}

interface RolledProfileCardModel {
  originalIndex: number;
  profile: RolledCharacterProfile;
  summary: RolledProfileSummary;
}

function compareRolledProfileCards(
  left: RolledProfileCardModel,
  right: RolledProfileCardModel
): number {
  if (left.summary.totalCharacteristicSum !== right.summary.totalCharacteristicSum) {
    return right.summary.totalCharacteristicSum - left.summary.totalCharacteristicSum;
  }

  if (left.summary.distractionLevel !== right.summary.distractionLevel) {
    return left.summary.distractionLevel - right.summary.distractionLevel;
  }

  return left.originalIndex - right.originalIndex;
}

export default function ChargenWizard() {
  const [content, setContent] = useState<CanonicalContent>(defaultCanonicalContent);
  const [contentSource, setContentSource] = useState("seed");
  const [feedback, setFeedback] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [progression, setProgression] = useState<CharacterProgression>(createChargenProgression());
  const [savedCharacters, setSavedCharacters] = useState<LocalCharacterRecord[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>();
  const [selectedSocietyId, setSelectedSocietyId] = useState<string>();
  const [selectedProfessionId, setSelectedProfessionId] = useState<string>();

  const selectedProfile = selectedProfileId
    ? selectProfile({ profileId: selectedProfileId, profiles: rolledProfiles })
    : undefined;
  const selectedSocialBand =
    selectedProfile?.socialClassRoll !== undefined
      ? getSocialBand(selectedProfile.socialClassRoll)
      : undefined;
  const sortedRolledProfiles = rolledProfiles
    .map((profile, originalIndex) => ({
      originalIndex,
      profile,
      summary: summarizeRolledProfile({
        profile
      })
    }))
    .sort(compareRolledProfileCards);
  const societies = buildSocietyOptions(content.societyLevels);
  const selectedSociety = societies.find((society) => society.id === selectedSocietyId);
  const selectedSocietyAccess =
    selectedSociety && selectedSocialBand !== undefined
      ? selectedSociety.socialBands[selectedSocialBand]
      : undefined;
  const selectedSocietyBand = selectedSociety ? selectedSocialBand : undefined;
  const availableProfessions = getAllowedProfessions(content.professions, selectedSocietyAccess);
  const selectedProfession = availableProfessions.find((item) => item.id === selectedProfessionId);
  const draftView = buildChargenDraftView({
    content,
    professionId: selectedProfessionId,
    profile: selectedProfile,
    progression,
    societyId: selectedSocietyId,
    societyLevel: selectedSocietyBand
  });
  const review = reviewChargenDraft({
    content,
    professionId: selectedProfessionId,
    profile: selectedProfile,
    progression,
    socialClass: selectedSocietyAccess?.socialClass,
    societyId: selectedSocietyId,
    societyLevel: selectedSocietyBand
  });
  const allowedPrimaryGroupIds =
    selectedProfessionId && selectedSocietyId && selectedSocietyBand !== undefined
      ? getAllowedPrimaryGroupIds(content, selectedProfessionId, selectedSocietyId, selectedSocietyBand)
      : [];
  const allowedSecondaryGroupIds =
    selectedSocietyId && selectedSocietyBand !== undefined
      ? getAllowedSecondaryGroupIds(content, selectedSocietyId, selectedSocietyBand)
      : [];
  const allowedPrimaryGroups = content.skillGroups.filter((group) =>
    allowedPrimaryGroupIds.includes(group.id)
  );
  const allowedPrimarySkills = sortSkills(
    content.skills.filter((skill) => allowedPrimaryGroupIds.includes(skill.groupId))
  );
  const allowedSecondarySkills = sortSkills(
    content.skills.filter((skill) => allowedSecondaryGroupIds.includes(skill.groupId))
  );
  const allowedSpecializations = sortSpecializations(
    content.specializations.filter((specialization) => {
      const parentSkill = content.skills.find((skill) => skill.id === specialization.skillId);
      return Boolean(parentSkill && allowedSecondaryGroupIds.includes(parentSkill.groupId));
    })
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const [cachedContent, savedDraft, existingCharacters] = await Promise.all([
        contentCacheRepository.get(CONTENT_CACHE_KEY),
        chargenSessionRepository.get(SESSION_ID),
        localCharacterRepository.list()
      ]);

      if (cancelled) {
        return;
      }

      const startingContent = cachedContent
        ? validateCanonicalContent(cachedContent.value)
        : defaultCanonicalContent;

      if (cachedContent) {
        setContent(startingContent);
        setContentSource(`cache:${cachedContent.version}`);
      }

      setSavedCharacters(existingCharacters);

      if (savedDraft) {
        setSelectedProfileId(savedDraft.selectedProfile?.id);
        setSelectedProfessionId(savedDraft.selectedProfessionId);
        setSelectedSocietyId(savedDraft.selectedSocietyId);

        const normalized = normalizeChargenProgression(savedDraft.progression);
        const hasSavedAllocation =
          normalized.primaryPoolSpent > 0 ||
          normalized.secondaryPoolSpent > 0 ||
          normalized.skillGroups.length > 0 ||
          normalized.skills.length > 0 ||
          normalized.specializations.length > 0;

        if (savedDraft.selectedProfessionId && !hasSavedAllocation) {
          setProgression(
            applyProfessionGrants({
              content: startingContent,
              professionId: savedDraft.selectedProfessionId
            })
          );
        } else {
          setProgression(normalized);
        }
      }

      setHydrated(true);

      try {
        const response = await fetch(`${API_BASE_URL}/content`);

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as ContentResponse;

        if (cancelled) {
          return;
        }

        const normalizedContent = validateCanonicalContent(payload.content);

        setContent(normalizedContent);
        setContentSource("api");
        await contentCacheRepository.save(CONTENT_CACHE_KEY, normalizedContent, "v1");
      } catch {
        // Seed and cache already cover the local-first case.
      }
    }

    hydrate().catch((error) => {
      console.error(error);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedSocietyId) {
      return;
    }

    if (societies.length === 1) {
      setSelectedSocietyId(societies[0].id);
    }
  }, [selectedSocietyId, societies]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (
      selectedProfessionId &&
      !availableProfessions.some((profession) => profession.id === selectedProfessionId)
    ) {
      setSelectedProfessionId(undefined);
      setProgression(createChargenProgression());
      setFeedback(["Profession selection was cleared because society access changed."]);
    }
  }, [availableProfessions, hydrated, selectedProfessionId]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    chargenSessionRepository
      .save({
        id: SESSION_ID,
        progression,
        selectedProfessionId,
        selectedProfile,
        selectedSocialClass: selectedSocietyAccess?.socialClass,
        selectedSocietyId,
        selectedSocietyLevel: selectedSocietyBand
      })
      .catch((error) => {
        console.error(error);
      });
  }, [
    hydrated,
    progression,
    selectedProfessionId,
    selectedProfile,
    selectedSocietyBand,
    selectedSocietyAccess,
    selectedSocietyId
  ]);

  function handleSocietyChange(societyId: string) {
    setSelectedSocietyId(societyId);
    setSelectedProfessionId(undefined);
    setProgression(createChargenProgression());
    setFeedback(["Changing society resets profession grants and point allocation."]);
  }

  function handleProfessionChange(professionId: string) {
    setSelectedProfessionId(professionId);
    setProgression(
      applyProfessionGrants({
        content,
        professionId
      })
    );
    setFeedback([
      "Profession grants applied. Primary, secondary, specialization, and review steps are ready."
    ]);
  }

  function handleSpendGroup(groupId: string) {
    if (!selectedProfessionId || !selectedSocietyId || selectedSocialBand === undefined) {
      return;
    }

    const result = spendPrimaryPoint({
      content,
      professionId: selectedProfessionId,
      progression,
      societyId: selectedSocietyId,
      societyLevel: selectedSocialBand,
      targetId: groupId,
      targetType: "group"
    });

    if (result.error) {
      setFeedback([result.error, ...result.warnings]);
      return;
    }

    setProgression(result.progression);
    setFeedback([
      `Spent ${result.spentCost ?? 0} primary points on a group increase.`,
      ...result.warnings
    ]);
  }

  function handleSpendPrimarySkill(skillId: string) {
    if (!selectedProfessionId || !selectedSocietyId || selectedSocialBand === undefined) {
      return;
    }

    const result = spendPrimaryPoint({
      content,
      professionId: selectedProfessionId,
      progression,
      societyId: selectedSocietyId,
      societyLevel: selectedSocialBand,
      targetId: skillId,
      targetType: "skill"
    });

    if (result.error) {
      setFeedback([result.error, ...result.warnings]);
      return;
    }

    setProgression(result.progression);
    setFeedback([
      `Spent ${result.spentCost ?? 0} primary points on a skill increase.`,
      ...result.warnings
    ]);
  }

  function handleSpendSecondarySkill(skillId: string) {
    if (!selectedSocietyId || selectedSocialBand === undefined) {
      return;
    }

    const result = spendSecondaryPoint({
      content,
      professionId: selectedProfessionId,
      profile: selectedProfile,
      progression,
      societyId: selectedSocietyId,
      societyLevel: selectedSocialBand,
      targetId: skillId,
      targetType: "skill"
    });

    if (result.error) {
      setFeedback([result.error, ...result.warnings]);
      return;
    }

    setProgression(result.progression);
    setFeedback([
      `Spent ${result.spentCost ?? 0} secondary points on a skill increase.`,
      ...result.warnings
    ]);
  }

  function handleSpendSpecialization(specializationId: string) {
    if (!selectedSocietyId || selectedSocialBand === undefined) {
      return;
    }

    const result = spendSecondaryPoint({
      content,
      professionId: selectedProfessionId,
      profile: selectedProfile,
      progression,
      societyId: selectedSocietyId,
      societyLevel: selectedSocialBand,
      targetId: specializationId,
      targetType: "specialization"
    });

    if (result.error) {
      setFeedback([result.error, ...result.warnings]);
      return;
    }

    setProgression(result.progression);
    setFeedback([
      `Spent ${result.spentCost ?? 0} secondary points on a specialization increase.`,
      ...result.warnings
    ]);
  }

  async function handleFinalize() {
    if (!selectedSocietyId || selectedSocialBand === undefined) {
      return;
    }

    const result = finalizeChargenDraft({
      content,
      professionId: selectedProfessionId,
      profile: selectedProfile,
      progression,
      socialClass: selectedSocietyAccess?.socialClass,
      societyId: selectedSocietyId,
      societyLevel: selectedSocialBand
    });

    if (!result.build) {
      setFeedback([...result.errors, ...result.warnings]);
      return;
    }

    await localCharacterRepository.save({
      build: result.build
    });
    await chargenSessionRepository.delete(SESSION_ID);

    setSavedCharacters(await localCharacterRepository.list());
    setSelectedProfileId(undefined);
    setSelectedProfessionId(undefined);
    setSelectedSocietyId(societies.length === 1 ? societies[0].id : undefined);
    setProgression(createChargenProgression());
    setFeedback([
      `Saved local character record: ${result.build.name}.`,
      ...result.warnings
    ]);
  }

  return (
    <section style={{ display: "grid", gap: "1.5rem", maxWidth: 1080 }}>
      <div>
        <h1 style={{ marginBottom: "0.5rem" }}>Chargen</h1>
        <p style={{ margin: 0 }}>
          This slice completes the local chargen loop with secondary spending, specializations,
          education, review validation, and local finalization.
        </p>
      </div>

      <div
        style={{
          background: "#f3f0e6",
          border: "1px solid #d7d1c1",
          borderRadius: 12,
          display: "grid",
          gap: "0.35rem",
          padding: "1rem"
        }}
      >
        <div>
          <strong>Draft status:</strong> saved locally in IndexedDB
        </div>
        <div>
          <strong>Content source:</strong> {contentSource}
        </div>
        <div>
          <strong>Primary pool:</strong> {draftView.primaryPoolAvailable} remaining /{" "}
          {progression.primaryPoolTotal} total
        </div>
        <div>
          <strong>Secondary pool:</strong> {draftView.secondaryPoolAvailable} remaining /{" "}
          {progression.secondaryPoolTotal} total
        </div>
      </div>

      {feedback.length > 0 ? (
        <div
          style={{
            background: "#fff8e1",
            border: "1px solid #e6d38c",
            borderRadius: 12,
            padding: "1rem"
          }}
        >
          {feedback.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </div>
      ) : null}

      <section style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>1. Pick a rolled profile</h2>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {sortedRolledProfiles.map(({ profile, summary }) => {
            return (
              <label
                key={profile.id}
                style={{
                  border: "1px solid #d9ddd8",
                  borderRadius: 12,
                  cursor: "pointer",
                  padding: "1rem"
                }}
              >
                <input
                  checked={selectedProfileId === profile.id}
                  name="profile"
                  onChange={() => setSelectedProfileId(profile.id)}
                  type="radio"
                />
                <div
                  style={{
                    alignItems: "baseline",
                    display: "flex",
                    gap: "0.75rem",
                    justifyContent: "space-between",
                    marginTop: "0.5rem"
                  }}
                >
                  <strong>{profile.label}</strong>
                  <strong>Total {summary.totalCharacteristicSum}</strong>
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: "0.35rem",
                    marginTop: "0.75rem"
                  }}
                >
                  <div>Distraction level: {summary.distractionLevel}</div>
                  <div>
                    Social class result:{" "}
                    {profile.socialClassRoll && summary.socialClassResult
                      ? `${summary.socialClassResult} (${profile.socialClassRoll})`
                      : summary.socialClassResult ?? "Not rolled"}
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: "0.25rem",
                    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                    marginTop: "0.75rem"
                  }}
                >
                  {summary.characteristics.map((characteristic) => (
                    <div
                      key={characteristic.key}
                      style={{ borderTop: "1px solid #ece8da", paddingTop: "0.5rem" }}
                    >
                      <div style={{ fontSize: "0.85rem" }}>{characteristic.label}</div>
                      <strong>{characteristic.value}</strong>
                    </div>
                  ))}
                </div>
              </label>
            );
          })}
        </div>
      </section>

      <section style={{ display: "grid", gap: "0.75rem", opacity: selectedProfile ? 1 : 0.6 }}>
        <h2 style={{ margin: 0 }}>2. Choose society</h2>
        <div style={{ fontSize: "0.95rem" }}>
          Choose the society used for this character. Society determines the class labels and later
          skill, education, and profession access.
        </div>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {societies.map((society) => (
            <label
              key={society.id}
              style={{
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                cursor: selectedProfile ? "pointer" : "not-allowed",
                padding: "1rem"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <input
                  checked={selectedSocietyId === society.id}
                  disabled={!selectedProfile}
                  name="society"
                  onChange={() => handleSocietyChange(society.id)}
                  type="radio"
                />
                <strong>{society.name}</strong>
              </div>
              <div style={{ marginTop: "0.5rem" }}>
                Band labels:{" "}
                {[1, 2, 3, 4]
                  .map((band) => {
                    const access = society.socialBands[band as SocialBand];
                    return access ? `${band}: ${access.socialClass}` : null;
                  })
                  .filter((value) => value !== null)
                  .join(" • ")}
              </div>
              {societies.length === 1 ? (
                <div style={{ marginTop: "0.25rem" }}>Only available society at present.</div>
              ) : null}
              {society.notes ? <div style={{ marginTop: "0.25rem" }}>{society.notes}</div> : null}
            </label>
          ))}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: "0.75rem",
          opacity: selectedProfile && selectedSociety ? 1 : 0.6
        }}
      >
        <h2 style={{ margin: 0 }}>3. Social class</h2>
        <div style={{ fontSize: "0.95rem" }}>
          Your social roll maps to one of four universal bands. The selected society determines the
          class name for that band.
        </div>
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            padding: "1rem"
          }}
        >
          {selectedProfile && selectedSociety && selectedSocialBand !== undefined && selectedSocietyAccess ? (
            <>
              <div>Society: {selectedSociety.name}</div>
              <div>Roll: {selectedProfile.socialClassRoll ?? "?"}</div>
              <div>
                Band: {selectedSocialBand} ({getBandRangeLabel(selectedSocialBand)})
              </div>
              <div>
                Social class: <strong>{selectedSocietyAccess.socialClass}</strong>
              </div>
              <div style={{ marginTop: "0.5rem" }}>
                This result determines later skill, base education, and profession access.
              </div>
              {selectedSocietyAccess.classRollTableId ? (
                <details style={{ marginTop: "0.5rem" }}>
                  <summary>Debug details</summary>
                  <div style={{ marginTop: "0.35rem" }}>
                    Roll source: {selectedSocietyAccess.classRollTableId}
                  </div>
                </details>
              ) : null}
            </>
          ) : (
            <span>Select a rolled profile to reveal social status.</span>
          )}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: "0.75rem",
          opacity: selectedSocietyAccess ? 1 : 0.6
        }}
      >
        <h2 style={{ margin: 0 }}>4. Choose profession</h2>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {availableProfessions.length > 0 ? (
            availableProfessions.map((profession) => (
              <label
                key={profession.id}
                style={{
                  border: "1px solid #d9ddd8",
                  borderRadius: 12,
                  cursor: selectedSociety ? "pointer" : "not-allowed",
                  padding: "1rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <input
                    checked={selectedProfessionId === profession.id}
                    disabled={!selectedSociety}
                    name="profession"
                    onChange={() => handleProfessionChange(profession.id)}
                    type="radio"
                  />
                  <strong>{profession.name}</strong>
                </div>
                {profession.description ? (
                  <div style={{ marginTop: "0.5rem" }}>{profession.description}</div>
                ) : null}
              </label>
            ))
          ) : (
            <div
              style={{
                background: "#f6f5ef",
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                padding: "1rem"
              }}
            >
              Select a rolled profile and society first.
            </div>
          )}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: "0.75rem",
          opacity: selectedProfession ? 1 : 0.6
        }}
      >
        <h2 style={{ margin: 0 }}>5. Primary-point spending</h2>
        <div style={{ fontSize: "0.95rem" }}>
          New group costs 8, existing group costs 4, new ordinary skill costs 4, existing ordinary
          skill costs 2, new secondary skill costs 2, existing secondary skill costs 1.
        </div>

        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))"
          }}
        >
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Groups</h3>
            {allowedPrimaryGroups.map((group) => {
              const groupView = draftView.groups.find((item) => item.groupId === group.id);
              const cost = getPrimaryPurchaseCostForGroup(progression, group.id);

              return (
                <div
                  key={group.id}
                  style={{
                    border: "1px solid #d9ddd8",
                    borderRadius: 12,
                    display: "grid",
                    gap: "0.4rem",
                    padding: "1rem"
                  }}
                >
                  <strong>{group.name}</strong>
                  <div>Granted: {groupView?.grantedRanks ?? 0}</div>
                  <div>Primary: {groupView?.primaryRanks ?? 0}</div>
                  <div>Group level: {groupView?.groupLevel ?? 0}</div>
                  <button
                    onClick={() => handleSpendGroup(group.id)}
                    style={{ width: "fit-content" }}
                    type="button"
                  >
                    +1 group ({cost})
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Skills</h3>
            {allowedPrimarySkills.map((skill) => {
              const skillView = draftView.skills.find((item) => item.skillId === skill.id);
              const parentGroup = draftView.groups.find((item) => item.groupId === skill.groupId);
              const cost = getPrimaryPurchaseCostForSkill(progression, skill);
              const groupReady = (parentGroup?.totalRanks ?? 0) > 0;

              return (
                <div
                  key={skill.id}
                  style={{
                    border: "1px solid #d9ddd8",
                    borderRadius: 12,
                    display: "grid",
                    gap: "0.4rem",
                    padding: "1rem"
                  }}
                >
                  <strong>{skill.name}</strong>
                  <div>
                    {formatSkillCategory(skill.category)} skill in {skill.groupId}
                  </div>
                  <div>Granted: {skillView?.grantedRanks ?? 0}</div>
                  <div>Primary: {skillView?.primaryRanks ?? 0}</div>
                  <div>Secondary: {skillView?.secondaryRanks ?? 0}</div>
                  <button
                    disabled={!groupReady}
                    onClick={() => handleSpendPrimarySkill(skill.id)}
                    style={{ width: "fit-content" }}
                    type="button"
                  >
                    +1 skill ({cost})
                  </button>
                  {!groupReady ? <div>Buy or gain the parent group first.</div> : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: "0.75rem",
          opacity: selectedSocietyAccess ? 1 : 0.6
        }}
      >
        <h2 style={{ margin: 0 }}>6. Secondary-point spending</h2>
        <div style={{ fontSize: "0.95rem" }}>
          Secondary spending is limited to skills and specializations from the society tier exactly
          one level above the current character.
        </div>

        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))"
          }}
        >
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Skills</h3>
            {allowedSecondarySkills.length > 0 ? (
              allowedSecondarySkills.map((skill) => {
                const skillView = draftView.skills.find((item) => item.skillId === skill.id);
                const cost = getSecondaryPurchaseCostForSkill(progression, skill);

                return (
                  <div
                    key={skill.id}
                    style={{
                      border: "1px solid #d9ddd8",
                      borderRadius: 12,
                      display: "grid",
                      gap: "0.4rem",
                      padding: "1rem"
                    }}
                  >
                    <strong>{skill.name}</strong>
                    <div>
                      {formatSkillCategory(skill.category)} skill in {skill.groupId}
                    </div>
                    <div>Primary: {skillView?.primaryRanks ?? 0}</div>
                    <div>Secondary: {skillView?.secondaryRanks ?? 0}</div>
                    <button
                      onClick={() => handleSpendSecondarySkill(skill.id)}
                      style={{ width: "fit-content" }}
                      type="button"
                    >
                      +1 skill ({cost})
                    </button>
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  background: "#f6f5ef",
                  border: "1px solid #d9ddd8",
                  borderRadius: 12,
                  padding: "1rem"
                }}
              >
                No secondary-pool skills are available for this society tier.
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Specializations</h3>
            {allowedSpecializations.length > 0 ? (
              allowedSpecializations.map((specialization) => {
                const parentSkill = content.skills.find((skill) => skill.id === specialization.skillId);
                const specializationView = draftView.specializations.find(
                  (item) => item.specializationId === specialization.id
                );
                const cost = getSecondaryPurchaseCostForSpecialization(
                  progression,
                  specialization
                );

                return (
                  <div
                    key={specialization.id}
                    style={{
                      border: "1px solid #d9ddd8",
                      borderRadius: 12,
                      display: "grid",
                      gap: "0.4rem",
                      padding: "1rem"
                    }}
                  >
                    <strong>{specialization.name}</strong>
                    <div>Parent skill: {parentSkill?.name ?? specialization.skillId}</div>
                    <div>Minimum group level: {specialization.minimumGroupLevel}</div>
                    <div>Secondary: {specializationView?.secondaryRanks ?? 0}</div>
                    <button
                      onClick={() => handleSpendSpecialization(specialization.id)}
                      style={{ width: "fit-content" }}
                      type="button"
                    >
                      +1 specialization ({cost})
                    </button>
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  background: "#f6f5ef",
                  border: "1px solid #d9ddd8",
                  borderRadius: 12,
                  padding: "1rem"
                }}
              >
                No secondary-pool specializations are available for this society tier.
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.5rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>7. Education</h2>
        <div>Base education: {draftView.education.baseEducation}</div>
        <div>Social class education value: {draftView.education.socialClassEducationValue}</div>
        <div>GM_int: {draftView.education.gmInt}</div>
        <div>Theoretical skill count: {draftView.education.theoreticalSkillCount}</div>
      </section>

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "1rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>8. Live draft results</h2>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          <h3 style={{ margin: 0 }}>Groups</h3>
          {draftView.groups.length > 0 ? (
            draftView.groups.map((group) => (
              <div
                key={group.groupId}
                style={{
                  borderTop: "1px solid #e7e2d7",
                  display: "grid",
                  gap: "0.25rem",
                  paddingTop: "0.75rem"
                }}
              >
                <strong>{group.name}</strong>
                <div>Granted ranks: {group.grantedRanks}</div>
                <div>Primary ranks: {group.primaryRanks}</div>
                <div>Group level: {group.groupLevel}</div>
              </div>
            ))
          ) : (
            <div>No groups in the draft yet.</div>
          )}
        </div>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          <h3 style={{ margin: 0 }}>Skills</h3>
          {draftView.skills.length > 0 ? (
            draftView.skills.map((skill) => (
              <div
                key={skill.skillId}
                style={{
                  borderTop: "1px solid #e7e2d7",
                  display: "grid",
                  gap: "0.25rem",
                  paddingTop: "0.75rem"
                }}
              >
                <strong>{skill.name}</strong>
                <div>Category: {formatSkillCategory(skill.category)}</div>
                <div>Granted ranks: {skill.grantedRanks}</div>
                <div>Primary ranks: {skill.primaryRanks}</div>
                <div>Secondary ranks: {skill.secondaryRanks}</div>
                <div>Group level: {skill.groupLevel}</div>
                <div>Specific skill level: {skill.specificSkillLevel}</div>
                <div>Effective skill number: {skill.effectiveSkillNumber}</div>
                <div>Linked stat average: {skill.linkedStatAverage}</div>
                <div>Total skill: {skill.totalSkill}</div>
                {skill.literacyWarning ? <div>{skill.literacyWarning}</div> : null}
              </div>
            ))
          ) : (
            <div>No skills in the draft yet.</div>
          )}
        </div>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          <h3 style={{ margin: 0 }}>Specializations</h3>
          {draftView.specializations.length > 0 ? (
            draftView.specializations.map((specialization) => (
              <div
                key={specialization.specializationId}
                style={{
                  borderTop: "1px solid #e7e2d7",
                  display: "grid",
                  gap: "0.25rem",
                  paddingTop: "0.75rem"
                }}
              >
                <strong>{specialization.name}</strong>
                <div>Parent skill: {specialization.parentSkillName}</div>
                <div>Specialization level: {specialization.specializationLevel}</div>
                <div>Effective specialization number: {specialization.effectiveSpecializationNumber}</div>
              </div>
            ))
          ) : (
            <div>No specializations in the draft yet.</div>
          )}
        </div>
      </section>

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "1rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>9. Review and finalize</h2>

        <div>
          <strong>Profile:</strong> {selectedProfile?.label ?? "Not selected"}
        </div>
        <div>
          <strong>Society:</strong> {selectedSociety?.name ?? "Not selected"}
        </div>
        <div>
          <strong>Social band:</strong> {selectedSocialBand ?? "Not selected"}
        </div>
        <div>
          <strong>Social class:</strong> {selectedSocietyAccess?.socialClass ?? "Not selected"}
        </div>
        <div>
          <strong>Profession:</strong> {selectedProfession?.name ?? "Not selected"}
        </div>
        <div>
          <strong>Groups:</strong> {draftView.groups.length}
        </div>
        <div>
          <strong>Skills:</strong> {draftView.skills.length}
        </div>
        <div>
          <strong>Specializations:</strong> {draftView.specializations.length}
        </div>
        <div>
          <strong>Primary points:</strong> {progression.primaryPoolSpent} spent /{" "}
          {draftView.primaryPoolAvailable} remaining
        </div>
        <div>
          <strong>Secondary points:</strong> {progression.secondaryPoolSpent} spent /{" "}
          {draftView.secondaryPoolAvailable} remaining
        </div>
        <div>
          <strong>Education:</strong> {draftView.education.theoreticalSkillCount}
        </div>
        <div>
          <strong>Total skill points invested:</strong> {draftView.totalSkillPointsInvested}
        </div>

        <div style={{ display: "grid", gap: "0.5rem" }}>
          <strong>Blocking errors</strong>
          {review.errors.length > 0 ? (
            review.errors.map((message) => <div key={message}>{message}</div>)
          ) : (
            <div>No blocking errors.</div>
          )}
        </div>

        <div style={{ display: "grid", gap: "0.5rem" }}>
          <strong>Warnings</strong>
          {review.warnings.length > 0 ? (
            review.warnings.map((message) => <div key={message}>{message}</div>)
          ) : (
            <div>No warnings.</div>
          )}
        </div>

        <button
          disabled={!review.canFinalize}
          onClick={() => {
            handleFinalize().catch((error) => {
              console.error(error);
            });
          }}
          style={{ width: "fit-content" }}
          type="button"
        >
          Finalize to local character record
        </button>
      </section>

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>10. Saved local characters</h2>
        {savedCharacters.length > 0 ? (
          savedCharacters.map((character) => (
            <div
              key={character.id}
              style={{
                borderTop: "1px solid #e7e2d7",
                display: "grid",
                gap: "0.25rem",
                paddingTop: "0.75rem"
              }}
            >
              <strong>{character.build.name}</strong>
              <div>Profile: {character.build.profile.label}</div>
              <div>Profession: {character.build.professionId ?? "None"}</div>
              <div>Social class: {character.build.socialClass ?? "None"}</div>
              <div>Finalized: {character.finalizedAt}</div>
            </div>
          ))
        ) : (
          <div>No local characters have been finalized yet.</div>
        )}
      </section>
    </section>
  );
}
