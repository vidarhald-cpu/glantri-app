/**
 * A random RFC 4122 version-4 UUID that works in every browser context (#1148).
 *
 * `crypto.randomUUID` exists only in a secure context (HTTPS, or a loopback host). The in-house
 * Studio serves the app over plain HTTP on a LAN address, where the browser omits it. The browser
 * still provides `crypto.getRandomValues` there, so the same UUID is built from that. Ids are never
 * derived from `Math.random` or the clock.
 */
export function randomId(): string {
  const webCrypto = globalThis.crypto as Crypto | undefined;
  if (typeof webCrypto?.randomUUID === "function") return webCrypto.randomUUID();
  if (typeof webCrypto?.getRandomValues !== "function")
    throw new Error("This browser provides no cryptographic random source.");

  const bytes = webCrypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
