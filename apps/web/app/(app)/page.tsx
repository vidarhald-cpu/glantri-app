import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <section
      style={{
        display: "grid",
        gap: "1rem"
      }}
    >
      <div
        style={{
          background: "#120f0b",
          borderRadius: 20,
          display: "grid",
          minHeight: "min(84vh, 920px)",
          overflow: "hidden",
          position: "relative"
        }}
      >
        <div
          style={{
            inset: 0,
            position: "absolute"
          }}
        >
          <Image
            alt="Glantri hero illustration"
            fill
            priority
            sizes="100vw"
            src="/images/GrinulGrimbrew.jpeg"
            style={{
              objectFit: "contain",
              objectPosition: "center center"
            }}
          />
        </div>

        <div
          style={{
            background:
              "linear-gradient(90deg, rgba(11, 10, 8, 0.82) 0%, rgba(11, 10, 8, 0.56) 34%, rgba(11, 10, 8, 0.16) 60%, rgba(11, 10, 8, 0.05) 100%)",
            inset: 0,
            position: "absolute"
          }}
        />

        <div
          style={{
            alignContent: "center",
          color: "#f5efe3",
          display: "grid",
          gap: "1.15rem",
          maxWidth: 520,
          minHeight: "min(84vh, 920px)",
          padding: "clamp(2rem, 6vw, 4.5rem)",
          position: "relative",
          width: "min(100%, 560px)"
          }}
        >
          <div style={{ display: "grid", gap: "0.65rem" }}>
            <h1
              style={{
                fontSize: "clamp(3rem, 7vw, 5.25rem)",
                letterSpacing: "-0.04em",
                lineHeight: 0.92,
                margin: 0
              }}
            >
              Glantri
            </h1>
            <p
              style={{
                color: "rgba(245, 239, 227, 0.92)",
                fontSize: "clamp(1rem, 2vw, 1.2rem)",
                lineHeight: 1.45,
                margin: 0,
                maxWidth: 420
              }}
            >
              Characters, campaigns, and conflict
            </p>
          </div>

          <div>
            <Link
              href="/auth"
              style={{
                background: "#f5efe3",
                borderRadius: 999,
                color: "#1a1712",
                display: "inline-flex",
                fontWeight: 600,
                padding: "0.9rem 1.45rem",
                textDecoration: "none"
              }}
            >
              Log in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
