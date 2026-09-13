import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";

import { assertPortsFree, sanitizeLogs, validateMetadata } from "./current-run-services.mjs";

const CONTAINER_ID = "a".repeat(64);
const IMAGE_ID = `sha256:${"b".repeat(64)}`;

test("rejects an occupied task-owned port and accepts it after release", async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");

  await assert.rejects(assertPortsFree("127.0.0.1", [address.port]), /already occupied/);
  await new Promise((resolve) => server.close(resolve));
  await assert.doesNotReject(assertPortsFree("127.0.0.1", [address.port]));
});

test("requires full current container and image identities", () => {
  assert.deepEqual(
    validateMetadata({
      service: "api",
      containerId: CONTAINER_ID,
      imageId: IMAGE_ID,
      imageTag: "glantri-api-test-1-1",
      containerPort: 4000,
      hostPort: 4000,
    }),
    {
      service: "api",
      containerId: CONTAINER_ID,
      imageId: IMAGE_ID,
      imageTag: "glantri-api-test-1-1",
      containerPort: 4000,
      hostPort: 4000,
    },
  );
  assert.throws(
    () =>
      validateMetadata({
        service: "api",
        containerId: "short-id",
        imageId: IMAGE_ID,
        imageTag: "glantri-api-test-1-1",
        containerPort: 4000,
        hostPort: 4000,
      }),
    /full Docker ID/,
  );
});

test("redacts credentials and session secrets from collected logs", () => {
  const logs = [
    JSON.stringify({ authorization: "Bearer secret-value", nested: { cookie: "sid=secret" } }),
    "Authorization: Bearer secret-value",
    "GET /ready?token=secret-value&safe=yes",
  ].join("\n");
  const sanitized = sanitizeLogs(logs);

  assert.doesNotMatch(sanitized, /secret-value|sid=secret/);
  assert.match(sanitized, /\[REDACTED\]/);
  assert.match(sanitized, /safe=yes/);
});

test("redacts credential-bearing URI userinfo while preserving diagnostic structure", () => {
  const logs = [
    "DATABASE_URL=postgresql://admin:db-secret@db.internal:5432/app",
    "CACHE_URL=redis://:redis-secret@cache.internal:6379/0",
    "UPSTREAM=https://service:p%40ss-word@example.internal/ready",
  ].join("\n");
  const sanitized = sanitizeLogs(logs);

  assert.doesNotMatch(sanitized, /admin:db-secret|redis-secret|p%40ss-word/);
  assert.match(sanitized, /postgresql:\/\/\[REDACTED\]@db\.internal:5432\/app/);
  assert.match(sanitized, /redis:\/\/\[REDACTED\]@cache\.internal:6379\/0/);
  assert.match(sanitized, /https:\/\/\[REDACTED\]@example\.internal\/ready/);
});

test("redacts credential-bearing URI userinfo inside non-sensitive JSON values", () => {
  const logs = [
    JSON.stringify({ url: "postgresql://admin:json-secret@db.internal:5432/app" }),
    JSON.stringify({ endpoints: ["https://user:array-secret@example.internal/ready"] }),
  ].join("\n");
  const sanitized = sanitizeLogs(logs);

  assert.doesNotMatch(sanitized, /json-secret|array-secret/);
  assert.match(sanitized, /"url":"postgresql:\/\/\[REDACTED\]@db\.internal:5432\/app"/);
  assert.match(sanitized, /https:\/\/\[REDACTED\]@example\.internal\/ready/);
});

test("redacts compound query credential keys with HTML-escaped separators", () => {
  const sanitized = sanitizeLogs(
    "GET /ready?access_token=query-secret&amp;safe=yes&refresh-token=refresh-secret",
  );

  assert.doesNotMatch(sanitized, /query-secret|refresh-secret/);
  assert.match(sanitized, /access_token=\[REDACTED\]&amp;safe=yes/);
  assert.match(sanitized, /refresh-token=\[REDACTED\]/);
});

test("redacts compound plaintext credential and session keys", () => {
  const logs = [
    "sessionId=session-secret safe=yes",
    "session_id=snake-secret apiKey=api-secret client-secret=client-value",
  ].join("\n");
  const sanitized = sanitizeLogs(logs);

  assert.doesNotMatch(sanitized, /session-secret|snake-secret|api-secret|client-value/);
  assert.match(sanitized, /sessionId=\[REDACTED\] safe=yes/);
  assert.match(sanitized, /session_id=\[REDACTED\]/);
  assert.match(sanitized, /apiKey=\[REDACTED\]/);
  assert.match(sanitized, /client-secret=\[REDACTED\]/);
});
