# Same-origin browser API proxy

## Boundary

Browser code calls relative `/api/*` paths on the Next/web origin. The matching
Next route forwards those requests server-to-server to the existing Fastify API.
The Fastify route paths remain unchanged: browser `/api/auth/me` becomes upstream
`/auth/me`.

The web service resolves its upstream only from the server-side runtime setting
`API_UPSTREAM_URL`. The value must be one HTTP(S) origin with no credentials,
path, query, or fragment. It must never use a `NEXT_PUBLIC_*` name or otherwise be
included in browser configuration. An absent or invalid setting fails closed with
a generic `503` response.

For local development:

```text
API_UPSTREAM_URL=http://localhost:4000
```

For the current split Azure App Service shape, the external maintainer must set
the web app's non-secret runtime setting to:

```text
API_UPSTREAM_URL=https://<api-app-name>.azurewebsites.net
```

The infrastructure module and production-bound deployment workflow encode this
setting for a future authorized release. They do not change a running service by
themselves.

CI terminates local HTTPS in front of the production web image so both Chromium
and WebKit exercise the Fastify production cookie (`Secure; SameSite=None`) through
the first-party web origin without cookie or storage-state injection.

## Forwarding and session behavior

The proxy preserves the request method, encoded path, repeated query parameters,
body stream, and the explicit request-header allowlist required by current API
clients. It does not copy incoming `Host`, `Origin`, hop-by-hop headers, or
arbitrary diagnostics. Redirects are returned to the browser rather than followed
by the proxy. Response status, body, relevant cache/content/location headers, and
every `Set-Cookie` value exposed separately by the Node runtime are preserved.

Fastify remains the sole session authority. Login and registration still create
the same hashed, expiring server session. Because the host-only API cookie is
relayed by the web response, the browser stores it as a first-party cookie for the
web host. Later `/api/*` requests send that cookie to the web service, and the
proxy forwards it to Fastify. Logout relays Fastify's `Max-Age=0` cookie. The
proxy does not log request headers, cookies, upstream exceptions, or configuration
values, and its own errors are generic.

## CSRF assumptions and residual risk

Moving the session cookie to the web origin makes browser mutation requests
first-party. The proxy therefore rejects unsafe requests when Fetch Metadata
identifies the request as `cross-site`. A browser-confirmed `same-origin` request
is accepted even when the server runtime sees an internal reverse-proxy origin;
otherwise, an explicit `Origin` must match the browser-facing host/protocol. The
validated headers are not forwarded upstream. Current Fastify `GET` routes are
assumed to be read-only, and JSON mutation routes retain their existing parsing
and role/authorization middleware.

This is a bounded defense, not a new authentication model or a complete CSRF-token
scheme. Non-browser/server clients that send neither `Origin` nor Fetch Metadata
remain supported, so another trusted intermediary must not forward arbitrary
cross-site browser requests after stripping both headers. XSS or a compromised
web origin can still issue same-origin requests with the user's authority. The
existing Fastify cookie remains `SameSite=None`; a future auth security review may
choose a stricter cookie or token design, but that is outside issue #321.
