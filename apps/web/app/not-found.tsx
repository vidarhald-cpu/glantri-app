import Link from "next/link";

/**
 * Replaces Next's built-in 404 page (#559). The built-in carries
 * `@media (prefers-color-scheme: dark) { body { color: #fff } }`, which under an
 * OS dark setting gave white text on the light-only body background (#555).
 * Deliberately plain: it declares no colours of its own and uses only existing
 * baseline classes, so text inherits the light-only colour scheme.
 */
export default function NotFound() {
  return (
    <main style={{ padding: "2rem 1.5rem" }}>
      <section>
        <h1 className="glantri-section-heading">Page not found</h1>
        <p className="glantri-helper-text">This page could not be found.</p>
        <Link href="/">Back to Home</Link>
      </section>
    </main>
  );
}
