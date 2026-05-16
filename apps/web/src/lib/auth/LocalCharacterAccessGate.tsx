"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

import { LocalCharacterRepository } from "../offline/repositories/localCharacterRepository";
import { useSessionUser } from "./SessionUserContext";
import styles from "./accessGate.module.css";

const localCharacterRepository = new LocalCharacterRepository();

export function RequireOwnedLocalCharacter(props: {
  characterId: string;
  children: ReactNode;
}) {
  const { currentUser, loading: sessionLoading } = useSessionUser();
  const [loading, setLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      if (!currentUser) {
        setIsAllowed(false);
        setLoading(false);
        return;
      }

      if (currentUser.roles.includes("game_master")) {
        setIsAllowed(true);
        setLoading(false);
        return;
      }

      const record = await localCharacterRepository.get(props.characterId);

      if (cancelled) {
        return;
      }

      setIsAllowed(record?.creatorId === currentUser.id);
      setLoading(false);
    }

    setLoading(true);
    checkAccess().catch(() => {
      if (!cancelled) {
        setIsAllowed(false);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser, props.characterId]);

  if (sessionLoading || loading) {
    return <div>Loading character access...</div>;
  }

  if (!isAllowed) {
    return (
      <section className={styles.section}>
        <h1 className={styles.heading}>Character access restricted</h1>
        <p className={styles.message}>
          This character is not available to the current account.
        </p>
        <div>
          <Link href="/characters">Back to characters</Link>
        </div>
      </section>
    );
  }

  return <>{props.children}</>;
}
