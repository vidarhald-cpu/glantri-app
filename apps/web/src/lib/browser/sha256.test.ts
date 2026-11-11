import { createHash, randomBytes, webcrypto } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { sha256, sha256Hex } from "./sha256";

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");
const ascii = (text: string) => new TextEncoder().encode(text);
const nodeSha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SHA-256 without Web Crypto (#1148)", () => {
  // NIST FIPS 180-4 examples and the NIST CAVP/SHAVS short- and long-message vectors.
  it.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    ],
    [
      "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu",
      "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1",
    ],
  ])("matches the NIST vector for %j", (message, digest) => {
    expect(hex(sha256(ascii(message)))).toBe(digest);
  });

  it("matches the NIST one-million-'a' vector", () => {
    expect(hex(sha256(new Uint8Array(1_000_000).fill(0x61)))).toBe(
      "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0",
    );
  });

  it("matches Node's crypto for every padding boundary up to three blocks", () => {
    const bytes = randomBytes(200);
    for (let length = 0; length <= 200; length += 1) {
      const message = bytes.subarray(0, length);
      expect(hex(sha256(message)), `length ${length}`).toBe(nodeSha256(message));
    }
  });

  it("hashes a view into a larger buffer by the view's own bytes", () => {
    const buffer = randomBytes(300);
    const view = new Uint8Array(buffer.buffer, buffer.byteOffset + 37, 150);
    expect(hex(sha256(view))).toBe(nodeSha256(view));
  });

  it("matches Node's crypto for a 6 MiB file", () => {
    const file = new Uint8Array(randomBytes(6 * 1024 * 1024 + 13));
    expect(hex(sha256(file))).toBe(nodeSha256(file));
  });
});

describe("sha256Hex", () => {
  it("uses crypto.subtle when the browser provides it", async () => {
    const digest = vi.fn(async () => new Uint8Array(32).fill(0xab).buffer);
    vi.stubGlobal("crypto", { subtle: { digest } });
    await expect(sha256Hex(ascii("abc"))).resolves.toBe("ab".repeat(32));
    expect(digest).toHaveBeenCalledWith("SHA-256", ascii("abc"));
  });

  it("gives the crypto.subtle digest in a secure context", async () => {
    const file = new Uint8Array(randomBytes(5 * 1024 * 1024 + 1));
    const subtleDigest = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", file)));
    await expect(sha256Hex(file.buffer)).resolves.toBe(subtleDigest);
    expect(subtleDigest).toBe(nodeSha256(file));
  });

  it("computes the same digest in an insecure context, where crypto.subtle is undefined", async () => {
    const file = new Uint8Array(randomBytes(5 * 1024 * 1024 + 1));
    vi.stubGlobal("crypto", { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
    expect(globalThis.crypto.subtle).toBeUndefined();
    await expect(sha256Hex(file.buffer)).resolves.toBe(nodeSha256(file));
    await expect(sha256Hex(file)).resolves.toBe(nodeSha256(file));
  });
});
