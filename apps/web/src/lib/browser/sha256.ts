/**
 * SHA-256 that works in every browser context (#1148).
 *
 * `crypto.subtle` exists only in a secure context (HTTPS, or a loopback host). The in-house Studio
 * serves the app over plain HTTP on a LAN address, where the browser omits it. `sha256Hex` uses
 * `crypto.subtle` whenever it is present and otherwise computes the same digest with
 * `sha256`, a direct transcription of FIPS 180-4 §6.2.
 *
 * The digest an Artifact package declares is checked by the server, which hashes the uploaded
 * bytes itself and fails closed on any mismatch, so this never decides integrity on its own.
 */
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  const digest =
    typeof subtle?.digest === "function"
      ? new Uint8Array(await subtle.digest("SHA-256", data as BufferSource))
      : sha256(data instanceof Uint8Array ? data : new Uint8Array(data));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// FIPS 180-4 §4.2.2: the first 32 bits of the fractional parts of the cube roots of the first
// 64 primes.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** FIPS 180-4 §6.2.2: processes the 64-byte block at `offset` into the hash state `h`. */
function compress(h: Uint32Array, w: Uint32Array, block: DataView, offset: number): void {
  for (let t = 0; t < 16; t += 1) w[t] = block.getUint32(offset + t * 4);
  for (let t = 16; t < 64; t += 1) {
    const w15 = w[t - 15]!;
    const w2 = w[t - 2]!;
    const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
    const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
    w[t] = w[t - 16]! + s0 + w[t - 7]! + s1;
  }

  let a = h[0]!;
  let b = h[1]!;
  let c = h[2]!;
  let d = h[3]!;
  let e = h[4]!;
  let f = h[5]!;
  let g = h[6]!;
  let hh = h[7]!;
  for (let t = 0; t < 64; t += 1) {
    const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
    const ch = (e & f) ^ (~e & g);
    const t1 = (hh + s1 + ch + K[t]! + w[t]!) | 0;
    const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (s0 + maj) | 0;
    hh = g;
    g = f;
    f = e;
    e = (d + t1) | 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) | 0;
  }
  h[0] = h[0]! + a;
  h[1] = h[1]! + b;
  h[2] = h[2]! + c;
  h[3] = h[3]! + d;
  h[4] = h[4]! + e;
  h[5] = h[5]! + f;
  h[6] = h[6]! + g;
  h[7] = h[7]! + hh;
}

/** The SHA-256 digest of `message`, computed without Web Crypto. */
export function sha256(message: Uint8Array): Uint8Array {
  // FIPS 180-4 §5.3.3: the initial hash value.
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const length = message.byteLength;
  const fullBlocks = Math.floor(length / 64);
  const body = new DataView(message.buffer, message.byteOffset, length);
  for (let block = 0; block < fullBlocks; block += 1) compress(h, w, body, block * 64);

  // FIPS 180-4 §5.1.1: a 1 bit, zeros, then the message length in bits as a 64-bit big-endian
  // integer, filling the final one or two blocks.
  const remainder = length - fullBlocks * 64;
  const tail = new Uint8Array(remainder < 56 ? 64 : 128);
  tail.set(message.subarray(fullBlocks * 64));
  tail[remainder] = 0x80;
  const tailView = new DataView(tail.buffer);
  const bitLength = length * 8;
  tailView.setUint32(tail.length - 8, Math.floor(bitLength / 0x1_0000_0000));
  tailView.setUint32(tail.length - 4, bitLength >>> 0);
  for (let offset = 0; offset < tail.length; offset += 64) compress(h, w, tailView, offset);

  const digest = new Uint8Array(32);
  const digestView = new DataView(digest.buffer);
  for (let word = 0; word < 8; word += 1) digestView.setUint32(word * 4, h[word]!);
  return digest;
}
