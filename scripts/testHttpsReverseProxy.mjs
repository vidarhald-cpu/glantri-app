import fs from "node:fs";
import http from "node:http";
import https from "node:https";

const target = new URL(process.env.HTTPS_PROXY_TARGET ?? "http://localhost:3000");
const port = Number(process.env.HTTPS_PROXY_PORT ?? "3443");
const certificatePath = process.env.HTTPS_PROXY_CERT;
const keyPath = process.env.HTTPS_PROXY_KEY;

if (
  (target.protocol !== "http:" && target.protocol !== "https:") ||
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65_535 ||
  !certificatePath ||
  !keyPath
) {
  throw new Error("Invalid test HTTPS proxy configuration.");
}

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function requestHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !HOP_BY_HOP_HEADERS.has(name.toLowerCase())),
  );
}

const server = https.createServer(
  {
    cert: fs.readFileSync(certificatePath),
    key: fs.readFileSync(keyPath),
  },
  (request, response) => {
    const upstreamUrl = new URL(request.url ?? "/", target);
    const requestImplementation = upstreamUrl.protocol === "https:" ? https : http;
    const upstreamRequest = requestImplementation.request(
      upstreamUrl,
      {
        headers: requestHeaders(request.headers),
        method: request.method,
      },
      (upstreamResponse) => {
        response.writeHead(
          upstreamResponse.statusCode ?? 502,
          upstreamResponse.statusMessage,
          upstreamResponse.rawHeaders,
        );
        upstreamResponse.pipe(response);
      },
    );

    upstreamRequest.on("error", () => {
      if (!response.headersSent) {
        response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      }
      response.end("Test HTTPS proxy upstream unavailable.");
    });
    request.pipe(upstreamRequest);
  },
);

server.listen(port, "127.0.0.1", () => {
  console.log(`Test HTTPS proxy listening on https://localhost:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
