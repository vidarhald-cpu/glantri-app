"use client";

import { formatAuthRoleLabel } from "@glantri/auth";
import { useEffect, useState } from "react";

import {
  bootstrapGameMasterRole,
  getBootstrapGameMasterAvailability,
  getCurrentSessionUser,
  loginLocalUser,
  registerLocalUser
} from "../../src/lib/api/localServiceClient";
import { canShowClaimGameMasterAction } from "../../src/lib/auth/authBootstrap";
import { useSessionUser } from "../../src/lib/auth/SessionUserContext";

const sectionStyle = {
  background: "#f6f5ef",
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem"
} as const;

export default function AuthPage() {
  const { currentUser, setCurrentUser, signOut } = useSessionUser();
  const [bootstrapAvailable, setBootstrapAvailable] = useState(false);
  const [claimingBootstrapRole, setClaimingBootstrapRole] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);

  async function refreshAuthState() {
    const [user, canBootstrap] = await Promise.all([
      getCurrentSessionUser(),
      getBootstrapGameMasterAvailability(),
    ]);

    setCurrentUser(user);
    setBootstrapAvailable(canBootstrap);
  }

  useEffect(() => {
    refreshAuthState()
      .catch((error: unknown) => {
        setFeedback(error instanceof Error ? error.message : "Unable to load current session.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setCurrentUser]);

  async function handleRegister() {
    try {
      const user = await registerLocalUser({
        displayName: displayName.trim() || undefined,
        email,
        password
      });
      setCurrentUser(user);
      setBootstrapAvailable(await getBootstrapGameMasterAvailability());
      setFeedback(`Registered and signed in as ${user.email}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Registration failed.");
    }
  }

  async function handleLogin() {
    try {
      const user = await loginLocalUser({
        email,
        password
      });
      setCurrentUser(user);
      setBootstrapAvailable(await getBootstrapGameMasterAvailability());
      setFeedback(`Signed in as ${user.email}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Login failed.");
    }
  }

  async function handleLogout() {
    try {
      await signOut();
      setBootstrapAvailable(await getBootstrapGameMasterAvailability());
      setFeedback("Signed out.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Logout failed.");
    }
  }

  async function handleClaimGameMasterRole() {
    setClaimingBootstrapRole(true);

    try {
      const result = await bootstrapGameMasterRole();
      setCurrentUser(result.user);
      setBootstrapAvailable(result.canBootstrapGameMaster);
      setFeedback(`Claimed GM role for ${result.user.email}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to claim GM role.");
      setBootstrapAvailable(await getBootstrapGameMasterAvailability().catch(() => false));
    } finally {
      setClaimingBootstrapRole(false);
    }
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 720, padding: "2rem 1.5rem" }}>
      <h1 style={{ margin: 0 }}>Auth</h1>
      <p style={{ margin: 0 }}>
        Local accounts authenticate against the local Fastify service and keep server-backed
        character persistence separate from the Dexie-first local workflow.
      </p>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Current session</h2>
        {loading ? <div>Loading session...</div> : null}
        {!loading ? (
          currentUser ? (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <div>Email: {currentUser.email}</div>
              <div>Display name: {currentUser.displayName ?? "Not set"}</div>
              <div>Roles: {currentUser.roles.map((role) => formatAuthRoleLabel(role)).join(", ")}</div>
              {canShowClaimGameMasterAction({ bootstrapAvailable, currentUser }) ? (
                <div>
                  <button
                    onClick={() => void handleClaimGameMasterRole()}
                    style={{
                      background: "#7e5d2a",
                      border: "1px solid transparent",
                      borderRadius: 10,
                      color: "#fffaf0",
                      cursor: claimingBootstrapRole ? "wait" : "pointer",
                      font: "inherit",
                      padding: "0.6rem 0.9rem"
                    }}
                    disabled={claimingBootstrapRole}
                    type="button"
                  >
                    Claim GM role
                  </button>
                </div>
              ) : null}
              <div>
                <button onClick={() => void handleLogout()} type="button">
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div>No active local-service session.</div>
          )
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Register</h2>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          Display name
          <input
            onChange={(event) => setDisplayName(event.target.value)}
            style={{ padding: "0.5rem" }}
            type="text"
            value={displayName}
          />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          Email
          <input
            onChange={(event) => setEmail(event.target.value)}
            style={{ padding: "0.5rem" }}
            type="email"
            value={email}
          />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          Password
          <input
            onChange={(event) => setPassword(event.target.value)}
            style={{ padding: "0.5rem" }}
            type="password"
            value={password}
          />
        </label>
        <div>
          <button onClick={() => void handleRegister()} type="button">
            Register
          </button>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>Login</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button onClick={() => void handleLogin()} type="button">
            Login
          </button>
          <button onClick={() => void handleLogout()} type="button">
            Logout
          </button>
        </div>
      </section>

      {feedback ? (
        <div style={{ border: "1px solid #d9ddd8", borderRadius: 12, padding: "1rem" }}>
          {feedback}
        </div>
      ) : null}
    </section>
  );
}
