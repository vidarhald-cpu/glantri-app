const API_PROXY_PREFIX = "/api";

const REQUEST_HEADER_ALLOWLIST = [
  "accept",
  "accept-language",
  "cache-control",
  "content-type",
  "cookie",
  "if-match",
  "if-none-match",
  "pragma",
  "x-glantri-combat-command",
  "x-glantri-combat-correlation-id",
  "x-glantri-combat-response",
  "x-request-id",
] as const;

const RESPONSE_HEADER_ALLOWLIST = [
  "cache-control",
  "content-disposition",
  "content-language",
  "content-type",
  "etag",
  "expires",
  "last-modified",
  "location",
  "retry-after",
  "vary",
  "x-request-id",
] as const;

const BODYLESS_RESPONSE_STATUSES = new Set([204, 205, 304]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

class ApiProxyConfigurationError extends Error {}

function jsonError(status: number, error: string): Response {
  return Response.json(
    { error },
    {
      headers: { "cache-control": "no-store" },
      status,
    },
  );
}

function getTrustedUpstreamOrigin(): string {
  const configuredUrl = process.env.API_UPSTREAM_URL?.trim();

  if (!configuredUrl) {
    throw new ApiProxyConfigurationError("Missing API upstream configuration.");
  }

  let upstream: URL;
  try {
    upstream = new URL(configuredUrl);
  } catch {
    throw new ApiProxyConfigurationError("Invalid API upstream configuration.");
  }

  if (
    (upstream.protocol !== "http:" && upstream.protocol !== "https:") ||
    upstream.username ||
    upstream.password ||
    (upstream.pathname !== "/" && upstream.pathname !== "") ||
    upstream.search ||
    upstream.hash
  ) {
    throw new ApiProxyConfigurationError("Invalid API upstream configuration.");
  }

  return upstream.origin;
}

function getUpstreamRequestUrl(requestUrl: URL, upstreamOrigin: string): string {
  if (
    requestUrl.pathname !== API_PROXY_PREFIX &&
    !requestUrl.pathname.startsWith(`${API_PROXY_PREFIX}/`)
  ) {
    throw new ApiProxyConfigurationError("Invalid API proxy path.");
  }

  const upstreamPath = requestUrl.pathname.slice(API_PROXY_PREFIX.length) || "/";
  return `${upstreamOrigin}${upstreamPath}${requestUrl.search}`;
}

function copyAllowedHeaders(source: Headers, names: readonly string[]): Headers {
  const copied = new Headers();

  for (const name of names) {
    const value = source.get(name);
    if (value !== null) {
      copied.set(name, value);
    }
  }

  return copied;
}

function appendSetCookieHeaders(source: Headers, destination: Headers): void {
  const headersWithCookies = source as Headers & { getSetCookie?: () => string[] };
  const cookies = headersWithCookies.getSetCookie?.() ?? [];

  if (cookies.length > 0) {
    for (const cookie of cookies) {
      destination.append("set-cookie", cookie);
    }
    return;
  }

  const combinedCookie = source.get("set-cookie");
  if (combinedCookie !== null) {
    destination.append("set-cookie", combinedCookie);
  }
}

function getBrowserFacingOrigin(request: Request, requestUrl: URL): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();

  if (!host) {
    return requestUrl.origin;
  }

  try {
    return new URL(`${forwardedProtocol || requestUrl.protocol}//${host}`).origin;
  } catch {
    return requestUrl.origin;
  }
}

function isCrossSiteMutation(request: Request, requestUrl: URL): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return false;
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return true;
  }
  if (fetchSite === "same-origin") {
    return false;
  }

  const origin = request.headers.get("origin");
  if (origin !== null && origin !== getBrowserFacingOrigin(request, requestUrl)) {
    return true;
  }

  return false;
}

export async function proxyApiRequest(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);

  if (isCrossSiteMutation(request, requestUrl)) {
    return jsonError(403, "Cross-site API requests are not allowed.");
  }

  let upstreamUrl: string;
  try {
    upstreamUrl = getUpstreamRequestUrl(requestUrl, getTrustedUpstreamOrigin());
  } catch (error) {
    if (error instanceof ApiProxyConfigurationError) {
      return jsonError(503, "API proxy unavailable.");
    }
    return jsonError(502, "API request failed.");
  }

  const method = request.method.toUpperCase();
  const init: RequestInit & { duplex?: "half" } = {
    headers: copyAllowedHeaders(request.headers, REQUEST_HEADER_ALLOWLIST),
    method,
    redirect: "manual",
  };

  if (method !== "GET" && method !== "HEAD" && request.body !== null) {
    init.body = request.body;
    init.duplex = "half";
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, init);
    const responseHeaders = copyAllowedHeaders(upstreamResponse.headers, RESPONSE_HEADER_ALLOWLIST);
    appendSetCookieHeaders(upstreamResponse.headers, responseHeaders);
    const hasBody = method !== "HEAD" && !BODYLESS_RESPONSE_STATUSES.has(upstreamResponse.status);

    return new Response(hasBody ? upstreamResponse.body : null, {
      headers: responseHeaders,
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
    });
  } catch {
    return jsonError(502, "API request failed.");
  }
}
