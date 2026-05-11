interface StartStepProps {
  onStart: () => void;
}

export function StartStep({ onStart }: StartStepProps) {
  return (
    <section
      style={{
        background: "#fbfaf5",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.75rem",
        padding: "1rem",
      }}
    >
      <div style={{ fontSize: "0.95rem" }}>
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
