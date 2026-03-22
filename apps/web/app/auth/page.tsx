"use client";

import { useEffect, useState } from "react";

import {
  getCurrentSessionUser,
  loginLocalUser,
  logoutLocalUser,
  registerLocalUser
} from "../../src/lib/api/localServiceClient";

const sectionStyle = {
  background: "#f6f5ef",
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem"
} as const;

export default function AuthPage() {
  const [currentUser, setCurrentUser] = useState<Awaited<ReturnType<typeof getCurrentSessionUser>>>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentSessionUser()
      .then((user) => {
        setCurrentUser(user);
      })
      .catch((error: unknown) => {
        setFeedback(error instanceof Error ? error.message : "Unable to load current session.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function handleRegister() {
    try {
      const user = await registerLocalUser({
        displayName: displayName.trim() || undefined,
        email,
        password
      });
      setCurrentUser(user);
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
      setFeedback(`Signed in as ${user.email}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Login failed.");
    }
  }

  async function handleLogout() {
    try {
      await logoutLocalUser();
      setCurrentUser(null);
      setFeedback("Signed out.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Logout failed.");
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
              <div>Roles: {currentUser.roles.join(", ")}</div>
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
