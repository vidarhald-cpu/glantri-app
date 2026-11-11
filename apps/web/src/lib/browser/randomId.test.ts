import { webcrypto } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { randomId } from "./randomId";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("randomId (#1148)", () => {
  it("uses crypto.randomUUID when the browser provides it", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    expect(randomId()).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("gives a valid version-4 UUID in a secure context", () => {
    expect(typeof crypto.randomUUID).toBe("function");
    expect(randomId()).toMatch(UUID_V4);
  });

  it("builds a version-4 UUID from crypto.getRandomValues when randomUUID is absent", () => {
    const getRandomValues = vi.fn((array: Uint8Array) => webcrypto.getRandomValues(array));
    vi.stubGlobal("crypto", { getRandomValues });
    const random = vi.spyOn(Math, "random");

    const ids = Array.from({ length: 1000 }, () => randomId());

    for (const id of ids) expect(id).toMatch(UUID_V4);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getRandomValues).toHaveBeenCalledTimes(ids.length);
    expect(random).not.toHaveBeenCalled();
  });

  it("sets exactly the version and variant bits", () => {
    vi.stubGlobal("crypto", { getRandomValues: (array: Uint8Array) => array.fill(0xff) });
    expect(randomId()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    vi.stubGlobal("crypto", { getRandomValues: (array: Uint8Array) => array.fill(0x00) });
    expect(randomId()).toBe("00000000-0000-4000-8000-000000000000");
  });

  it("refuses rather than falling back to a non-cryptographic source", () => {
    vi.stubGlobal("crypto", undefined);
    expect(() => randomId()).toThrow(/no cryptographic random source/);
  });
});
