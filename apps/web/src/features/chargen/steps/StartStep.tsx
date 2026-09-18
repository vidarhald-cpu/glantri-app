import { useState } from "react";

import styles from "./StartStep.module.css";

interface SavedDraftSummary {
  description: string;
  kind: "current" | "historical";
}

interface StartStepProps {
  onResume?: () => void;
  onStartNew: () => void;
  savedDraft?: SavedDraftSummary;
}

export function StartStep({ onResume, onStartNew, savedDraft }: StartStepProps) {
  const [isConfirmingReplacement, setIsConfirmingReplacement] = useState(false);

  if (savedDraft) {
    return (
      <section className={styles.section}>
        <div className={styles.hint}>
          {savedDraft.kind === "historical"
            ? "This historical draft remains available to read, but it cannot continue in the current Chargen catalogue."
            : "A Chargen draft is saved for this account."}
        </div>
        <div className={styles.draftName}>{savedDraft.description}</div>
        {isConfirmingReplacement ? (
          <div className={styles.confirmation} role="alert">
            <p>
              Creating a new Character will replace this account&apos;s saved draft. Finalized
              Characters are not affected.
            </p>
            <div className={styles.actions}>
              <button onClick={() => setIsConfirmingReplacement(false)} type="button">
                Keep saved draft
              </button>
              <button onClick={onStartNew} type="button">
                Replace draft and roll
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            {onResume ? (
              <button onClick={onResume} type="button">
                Resume saved Character
              </button>
            ) : null}
            <button onClick={() => setIsConfirmingReplacement(true)} type="button">
              Create new Character
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.hint}>Start a new Character by rolling the full set of stats.</div>
      <div>
        <button onClick={onStartNew} type="button">
          Roll all dice
        </button>
      </div>
    </section>
  );
}
