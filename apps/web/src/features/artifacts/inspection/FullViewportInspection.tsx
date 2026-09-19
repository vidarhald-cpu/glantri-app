"use client";

import { useEffect, useRef, type ReactNode } from "react";

import styles from "./mediaInspection.module.css";

export interface FullViewportInspectionProps {
  children: ReactNode;
  /** Escape exits by default. Turn it off where an owning surface already handles Escape. */
  closeOnEscape?: boolean;
  /** Wording of the obvious way out, for example `Back to Blackboard`. */
  exitLabel: string;
  onExit: () => void;
  /**
   * `dialog` covers an owning page and traps focus. `page` is the whole
   * inspection route and leaves surrounding navigation alone.
   */
  presentation?: "dialog" | "page";
  /** Short game-world line under the title, such as the kind or who may see it. */
  subtitle?: ReactNode;
  title: string;
}

const FOCUSABLE =
  'a[href],area[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])';

/**
 * Effectively full-viewport shell for inspecting visual material.
 *
 * The exit control and the identity line sit in their own header row above the
 * inspected material, so ordinary chrome neither consumes the viewport nor
 * covers what the user came to look at.
 */
export function FullViewportInspection({
  children,
  closeOnEscape = true,
  exitLabel,
  onExit,
  presentation = "dialog",
  subtitle,
  title,
}: FullViewportInspectionProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const exitRef = useRef<HTMLButtonElement | null>(null);
  const isDialog = presentation === "dialog";

  useEffect(() => {
    if (!isDialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    exitRef.current?.focus();
    const restoreOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = restoreOverflow;
      previous?.focus();
    };
  }, [isDialog]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        onExit();
        return;
      }
      if (event.key !== "Tab" || !isDialog) return;
      const shell = shellRef.current;
      if (!shell) return;
      const focusable = Array.from(shell.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!shell.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEscape, isDialog, onExit]);

  return (
    <div
      aria-label={isDialog ? title : undefined}
      aria-modal={isDialog ? true : undefined}
      className={styles.shell}
      data-presentation={presentation}
      ref={shellRef}
      role={isDialog ? "dialog" : undefined}
    >
      <header className={styles.header}>
        <div className={styles.identity}>
          {isDialog ? <h2>{title}</h2> : <h1>{title}</h1>}
          {subtitle ? <span className={styles.kind}>{subtitle}</span> : null}
        </div>
        <button className={styles.exit} onClick={onExit} ref={exitRef} type="button">
          {exitLabel}
        </button>
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
