"use client";

import { useEffect, useState } from "react";
import { formatAuthRoleLabel, type AuthRole, type AuthUser } from "@glantri/auth";

import { loadAuthUsers, updateAuthUserRole } from "../../../../src/lib/api/localServiceClient";
import { useCanAccessAdmin } from "../../../../src/lib/auth/SessionUserContext";
import { AdminPageIntro, AdminPanel, AdminReadOnlyNotice } from "../admin-ui";

const roleOptions: AuthRole[] = ["player", "game_master", "admin"];

export default function PlayersAdminPage() {
  const canEdit = useCanAccessAdmin();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string>();
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  useEffect(() => {
    loadAuthUsers()
      .then((loadedUsers) => {
        setUsers(loadedUsers);
      })
      .catch((error) => {
        setFeedback(error instanceof Error ? error.message : "Unable to load users.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function handleRoleChange(userId: string, role: AuthRole) {
    setSavingUserId(userId);

    try {
      const updatedUser = await updateAuthUserRole({
        role,
        userId,
      });

      setUsers((current) =>
        current.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
      );
      setFeedback(`Updated ${updatedUser.email} to ${formatAuthRoleLabel(role)}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to update role.");
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Players"
        title="Players"
        summary="Simple local user and role management for the current auth system."
      />

      <AdminPanel
        title="Users"
        subtitle="Each account is kept on one primary role for now: Player, GM, or Admin."
      >
        {loading ? (
          <div>Loading users...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: "100%", width: "100%" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(85, 73, 48, 0.14)", textAlign: "left" }}>
                  <th style={{ padding: "0.55rem 0.75rem 0.55rem 0" }}>Email</th>
                  <th style={{ padding: "0.55rem 0.75rem 0.55rem 0" }}>Display name</th>
                  <th style={{ padding: "0.55rem 0.75rem 0.55rem 0" }}>Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const currentRole = user.roles[0] ?? "player";

                  return (
                    <tr key={user.id} style={{ borderBottom: "1px solid rgba(85, 73, 48, 0.08)" }}>
                      <td style={{ padding: "0.65rem 0.75rem 0.65rem 0", verticalAlign: "top" }}>
                        {user.email}
                      </td>
                      <td style={{ padding: "0.65rem 0.75rem 0.65rem 0", verticalAlign: "top" }}>
                        {user.displayName ?? "—"}
                      </td>
                      <td style={{ padding: "0.65rem 0.75rem 0.65rem 0", verticalAlign: "top" }}>
                        {canEdit ? (
                          <select
                            disabled={savingUserId === user.id}
                            onChange={(event) =>
                              void handleRoleChange(user.id, event.target.value as AuthRole)
                            }
                            value={currentRole}
                          >
                            {roleOptions.map((role) => (
                              <option key={role} value={role}>
                                {formatAuthRoleLabel(role)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          formatAuthRoleLabel(currentRole)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!canEdit ? (
          <AdminReadOnlyNotice message="Player accounts can review users here, but only Admin and GM roles can change role assignments." />
        ) : null}
        {feedback ? <div style={{ color: "#5f543a" }}>{feedback}</div> : null}
      </AdminPanel>
    </section>
  );
}
