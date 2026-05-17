"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { AuthRole } from "@glantri/auth";
import { formatAuthRoleLabel, hasAnyRole } from "@glantri/auth";

import styles from "./accessGate.module.css";
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
      <section className={styles.section}>
        <h1 className={styles.heading}>{props.title ?? "Login required"}</h1>
        <p className={styles.message}>
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
      <section className={styles.section}>
        <h1 className={styles.heading}>Login required</h1>
        <p className={styles.message}>You need to sign in before you can use this part of the app.</p>
        <div>
          <Link href="/auth">Go to login</Link>
        </div>
      </section>
    );
  }

  if (!hasAnyRole(currentUser.roles, props.allowedRoles)) {
    return (
      <section className={styles.section}>
        <h1 className={styles.heading}>{props.title ?? "Access restricted"}</h1>
        <p className={styles.message}>
          {props.message ??
            `This area is limited to ${props.allowedRoles.map(formatAuthRoleLabel).join(" / ")} accounts.`}
        </p>
      </section>
    );
  }

  return <>{props.children}</>;
}
