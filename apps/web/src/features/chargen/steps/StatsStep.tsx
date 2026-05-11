import type { RolledCharacterProfile } from "@glantri/domain";
import type { RolledProfileSummary } from "@glantri/rules-engine";

interface StatsStepProps {
  formatProfileSocialBand: (profile: RolledCharacterProfile) => string;
  onExpandStats: () => void;
  onProfileSelect: (profileId: string) => void;
  onToggleStats: () => void;
  selectedProfileId: string | undefined;
  selectedRolledProfile: RolledCharacterProfile | undefined;
  selectedRolledProfileSummary: RolledProfileSummary | undefined;
  showRolledProfileOptions: boolean;
  sortedRolledProfiles: Array<{
    profile: RolledCharacterProfile;
    summary: RolledProfileSummary;
  }>;
}

export function StatsStep({
  formatProfileSocialBand,
  onExpandStats,
  onProfileSelect,
  onToggleStats,
  selectedProfileId,
  selectedRolledProfile,
  selectedRolledProfileSummary,
  showRolledProfileOptions,
  sortedRolledProfiles,
}: StatsStepProps) {
  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: "0.75rem",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ margin: 0 }}>1. Stats</h2>
        <button onClick={onToggleStats} type="button">
          {showRolledProfileOptions ? "Collapse stats" : "Expand stats"}
        </button>
      </div>
      {selectedRolledProfile && !showRolledProfileOptions ? (
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            display: "grid",
            gap: "0.75rem",
            padding: "1rem",
          }}
        >
          <div
            style={{
              alignItems: "baseline",
              display: "flex",
              gap: "0.75rem",
              justifyContent: "space-between",
            }}
          >
            <strong>{selectedRolledProfile.label}</strong>
            <button onClick={onExpandStats} type="button">
              Expand stats
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            <div>Total {selectedRolledProfileSummary?.totalCharacteristicSum ?? 0}</div>
            <div>Distraction {selectedRolledProfile.distractionLevel}</div>
            <div>Social band {formatProfileSocialBand(selectedRolledProfile)}</div>
          </div>
        </div>
      ) : showRolledProfileOptions ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {sortedRolledProfiles.map(({ profile, summary }) => (
            <label
              key={profile.id}
              style={{
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                cursor: "pointer",
                padding: "1rem",
              }}
            >
              <input
                checked={selectedProfileId === profile.id}
                name="profile"
                onChange={() => onProfileSelect(profile.id)}
                type="radio"
              />
              <div
                style={{
                  alignItems: "baseline",
                  display: "flex",
                  gap: "0.75rem",
                  justifyContent: "space-between",
                  marginTop: "0.5rem",
                }}
              >
                <strong>{profile.label}</strong>
                <strong>Total {summary.totalCharacteristicSum}</strong>
              </div>
              <div
                style={{
                  display: "grid",
                  gap: "0.35rem",
                  marginTop: "0.75rem",
                }}
              >
                <div>Distraction level: {summary.distractionLevel}</div>
                <div>Social band: {formatProfileSocialBand(profile)}</div>
              </div>
              <div
                style={{
                  display: "grid",
                  gap: "0.25rem",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  marginTop: "0.75rem",
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
          ))}
        </div>
      ) : (
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            color: "#5e5a50",
            padding: "1rem",
          }}
        >
          Expand stats to review the rolled profiles.
        </div>
      )}
    </section>
  );
}
