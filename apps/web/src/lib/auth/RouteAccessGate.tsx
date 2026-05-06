"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { AuthRole } from "@glantri/auth";
import { formatAuthRoleLabel, hasAnyRole } from "@glantri/auth";

import { useSessionUser } from "./SessionUserContext";

export function RequireAuthenticatedUser(props: {
  children: ReactNode;
  message?: string;
  title?: string;
}) {
  const { currentUser, loading } = useSessionUser();

  if (loading) {
    return <div>Loading session...</div>;
  }

  if (!currentUser) {
    return (
      <section style={{ display: "grid", gap: "0.75rem", maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>{props.title ?? "Login required"}</h1>
        <p style={{ margin: 0 }}>
          {props.message ?? "You need to sign in before you can use this part of the app."}
        </p>
        <div>
          <Link href="/auth">Go to login</Link>
        </div>
      </section>
    );
  }

  return <>{props.children}</>;
}

export function RequireRole(props: {
  allowedRoles: AuthRole[];
  children: ReactNode;
  message?: string;
  title?: string;
}) {
  const { currentUser, loading } = useSessionUser();

  if (loading) {
    return <div>Loading session...</div>;
  }

  if (!currentUser) {
    return (
      <section style={{ display: "grid", gap: "0.75rem", maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>Login required</h1>
        <p style={{ margin: 0 }}>You need to sign in before you can use this part of the app.</p>
        <div>
          <Link href="/auth">Go to login</Link>
        </div>
      </section>
    );
  }

  if (!hasAnyRole(currentUser.roles, props.allowedRoles)) {
    return (
      <section style={{ display: "grid", gap: "0.75rem", maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>{props.title ?? "Access restricted"}</h1>
        <p style={{ margin: 0 }}>
          {props.message ??
            `This area is limited to ${props.allowedRoles.map(formatAuthRoleLabel).join(" / ")} accounts.`}
        </p>
      </section>
    );
  }

  return <>{props.children}</>;
}
