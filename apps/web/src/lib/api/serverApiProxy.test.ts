import { afterEach, describe, expect, it, vi } from "vitest";

import { proxyApiRequest } from "./serverApiProxy";

const SENSITIVE_COOKIE = "glantri_session=test-session-value";

function setUpstream(url = "https://api.example.test"): void {
  vi.stubEnv("API_UPSTREAM_URL", url);
}

describe("server API proxy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("preserves method, encoded path, query, body, and safe request headers", async () => {
    setUpstream();
    let forwardedBody = "";
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      forwardedBody = init?.body ? await new Response(init.body).text() : "";
      return new Response(JSON.stringify({ character: { id: "character-1" } }), {
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json",
          "x-request-id": "upstream-request-1",
        },
        status: 201,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyApiRequest(
      new Request("https://web.example.test/api/characters/character%2F1?view=full&view=sheet", {
        body: JSON.stringify({ name: "Ada" }),
        headers: {
          connection: "keep-alive",
          cookie: SENSITIVE_COOKIE,
          "content-type": "application/json",
          host: "web.example.test",
          origin: "https://web.example.test",
          "x-glantri-combat-correlation-id": "correlation-1",
          "x-not-forwarded": "private-client-diagnostic",
        },
        method: "POST",
      }),
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(String(url)).toBe(
      "https://api.example.test/characters/character%2F1?view=full&view=sheet",
    );
    expect(init?.method).toBe("POST");
    expect(init?.redirect).toBe("manual");
    expect(forwardedBody).toBe(JSON.stringify({ name: "Ada" }));
    expect(headers.get("cookie")).toBe(SENSITIVE_COOKIE);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-glantri-combat-correlation-id")).toBe("correlation-1");
    expect(headers.has("connection")).toBe(false);
    expect(headers.has("host")).toBe(false);
    expect(headers.has("origin")).toBe(false);
    expect(headers.has("x-not-forwarded")).toBe(false);
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("x-request-id")).toBe("upstream-request-1");
    await expect(response.json()).resolves.toEqual({ character: { id: "character-1" } });
  });

  it("forwards every Set-Cookie header exposed by the runtime, including logout clearing", async () => {
    setUpstream();
    const upstreamHeaders = new Headers({ "content-type": "application/json" });
    upstreamHeaders.append(
      "set-cookie",
      "glantri_session=first; HttpOnly; Path=/; Secure; SameSite=None",
    );
    upstreamHeaders.append("set-cookie", "preference=compact; Path=/; SameSite=Lax");
    upstreamHeaders.append(
      "set-cookie",
      "glantri_session=; HttpOnly; Path=/; Secure; SameSite=None; Max-Age=0",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          headers: upstreamHeaders,
          status: 200,
        }),
      ),
    );

    const response = await proxyApiRequest(
      new Request("https://web.example.test/api/auth/logout", {
        body: "{}",
        headers: {
          "content-type": "application/json",
          origin: "https://web.example.test",
        },
        method: "POST",
      }),
    );
    const responseHeaders = response.headers as Headers & { getSetCookie: () => string[] };

    expect(responseHeaders.getSetCookie()).toEqual([
      "glantri_session=first; HttpOnly; Path=/; Secure; SameSite=None",
      "preference=compact; Path=/; SameSite=Lax",
      "glantri_session=; HttpOnly; Path=/; Secure; SameSite=None; Max-Age=0",
    ]);
  });

  it("preserves redirect status and location without following it", async () => {
    setUpstream();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        headers: { location: "/auth" },
        status: 307,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyApiRequest(new Request("https://web.example.test/api/redirect-me"));

    expect(fetchMock.mock.calls[0]?.[1]?.redirect).toBe("manual");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/auth");
  });

  it("rejects cross-site mutations before they reach the API", async () => {
    setUpstream();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyApiRequest(
      new Request("https://web.example.test/api/characters", {
        body: "{}",
        headers: {
          origin: "https://attacker.example.test",
          "sec-fetch-site": "cross-site",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Cross-site API requests are not allowed.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts browser-confirmed same-origin mutations behind an internal reverse-proxy origin", async () => {
    setUpstream();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: "user-1" } }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyApiRequest(
      new Request("http://internal-web:3000/api/auth/login", {
        body: JSON.stringify({ email: "user@example.test", password: "not-a-session-value" }),
        headers: {
          "content-type": "application/json",
          origin: "https://web.example.test",
          "sec-fetch-site": "same-origin",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    "",
    "ftp://api.example.test",
    "https://user:password@api.example.test",
    "https://api.example.test/v1",
    "https://api.example.test?target=https://attacker.example.test",
  ])("fails closed for an untrusted upstream configuration", async (configuredUrl) => {
    vi.stubEnv("API_UPSTREAM_URL", configuredUrl);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyApiRequest(new Request("https://web.example.test/api/auth/me"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "API proxy unavailable." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a generic upstream failure without logging or exposing session/config values", async () => {
    setUpstream("https://api.internal.example.test");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error(`network failure for ${SENSITIVE_COOKIE}`)),
    );

    const response = await proxyApiRequest(
      new Request("https://web.example.test/api/auth/me", {
        headers: { cookie: SENSITIVE_COOKIE },
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(502);
    expect(body).toBe(JSON.stringify({ error: "API request failed." }));
    expect(body).not.toContain(SENSITIVE_COOKIE);
    expect(body).not.toContain("api.internal.example.test");
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });
});
