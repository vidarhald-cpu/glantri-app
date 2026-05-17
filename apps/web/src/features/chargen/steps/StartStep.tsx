import styles from "./StartStep.module.css";

interface StartStepProps {
  onStart: () => void;
}

export function StartStep({ onStart }: StartStepProps) {
  return (
    <section className={styles.section}>
      <div className={styles.hint}>
        Start a new character by rolling the full set of stats.
      </div>
      <div>
        <button onClick={onStart} type="button">
          Roll all dice
        </button>
      </div>
    </section>
  );
}
