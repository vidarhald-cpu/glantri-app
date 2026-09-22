import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import net from "node:net";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertPortsFree,
  identifySelfJobContainer,
  planStaleServiceReclamation,
  sanitizeLogs,
  validateMetadata,
} from "./current-run-services.mjs";

const CONTAINER_ID = "a".repeat(64);
const IMAGE_ID = `sha256:${"b".repeat(64)}`;
const SANITIZE_LOGS_ENTRY_POINT = fileURLToPath(
  new URL("./sanitize-service-logs.mjs", import.meta.url),
);

function sanitizeThroughProductionEntryPoint(input) {
  const result = spawnSync(process.execPath, [SANITIZE_LOGS_ENTRY_POINT], {
    input,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

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

test("redacts sensitive values in pretty-printed JSON", () => {
  const logs = [
    "{",
    '  "sessionId": "pretty-session-secret",',
    '  "refresh-token": "pretty-refresh-secret",',
    '  "safe": "visible diagnostic value"',
    "}",
  ].join("\n");
  const sanitized = sanitizeLogs(logs);

  assert.doesNotMatch(sanitized, /pretty-session-secret|pretty-refresh-secret/);
  assert.match(sanitized, /"sessionId": "\[REDACTED\]",/);
  assert.match(sanitized, /"refresh-token": "\[REDACTED\]",/);
  assert.match(sanitized, /"safe": "visible diagnostic value"/);
});

test("redacts sensitive values in prefixed JSON fragments", () => {
  const sanitized = sanitizeLogs(
    'service error: {"client-secret":"prefixed-client-secret","safe":"yes"}',
  );

  assert.doesNotMatch(sanitized, /prefixed-client-secret/);
  assert.match(sanitized, /service error: \{"client-secret":"\[REDACTED\]","safe":"yes"\}/);
});

test("redacts complete quoted plaintext values containing spaces", () => {
  const sanitized = sanitizeLogs(
    "sessionId=\"quoted session secret\" client-secret='single quoted secret' safe=yes",
  );

  assert.doesNotMatch(sanitized, /quoted session secret|single quoted secret|session secret/);
  assert.match(sanitized, /sessionId=\[REDACTED\]/);
  assert.match(sanitized, /client-secret=\[REDACTED\]/);
  assert.match(sanitized, /safe=yes/);
});

test("fails closed for unterminated quoted plaintext secret values", () => {
  const logs = ['apiKey="unterminated secret tail', "session_id='another secret tail"].join("\n");
  const sanitized = sanitizeLogs(logs);

  assert.doesNotMatch(sanitized, /unterminated|secret tail|another/);
  assert.match(sanitized, /apiKey=\[REDACTED\]/);
  assert.match(sanitized, /session_id=\[REDACTED\]/);
});

const structuredFallbackCases = [
  {
    name: "pretty-printed cookie fields",
    input: ["{", '  "cookie": "sid=qa-cookie-sentinel",', '  "safe": "yes"', "}"].join("\n"),
    secrets: ["qa-cookie-sentinel"],
    expected: /"cookie": "\[REDACTED\]"/,
  },
  {
    name: "prefixed session objects",
    input: 'pino-prefix {"session":{"id":"qa-nested-sentinel"},"safe":"yes"}',
    secrets: ["qa-nested-sentinel"],
    expected: /pino-prefix \{"session":"\[REDACTED\]","safe":"yes"\}/,
  },
  {
    name: "prefixed numeric session IDs",
    input: 'pino-prefix {"sessionId":123456789,"safe":"yes"}',
    secrets: ["123456789"],
    expected: /pino-prefix \{"sessionId":"\[REDACTED\]","safe":"yes"\}/,
  },
];

for (const { name, input, secrets, expected } of structuredFallbackCases) {
  test(`redacts ${name} through direct and production log entry points`, () => {
    const direct = sanitizeLogs(input);
    const production = sanitizeThroughProductionEntryPoint(input);

    assert.equal(production, direct);
    for (const secret of secrets) assert.doesNotMatch(direct, new RegExp(secret));
    assert.match(direct, expected);
    assert.match(direct, /"safe"(?:: |:)"yes"/);
  });
}

test("preserves sensitive-key context across multiline JSON among ordinary log lines", () => {
  const input = [
    "Starting API",
    "{",
    '  "session": {',
    '    "id": "qa-multiline-session"',
    "  },",
    '  "sessionId": [',
    '    "qa-array-session"',
    "  ],",
    '  "cookie": "sid=qa-cookie-fixed",',
    '  "status": 503',
    "}",
    "Readiness failed",
  ].join("\n");

  const direct = sanitizeLogs(input);
  const production = sanitizeThroughProductionEntryPoint(input);

  assert.equal(production, direct);
  assert.doesNotMatch(direct, /qa-multiline-session|qa-array-session|qa-cookie-fixed/);
  assert.match(direct, /"session": "\[REDACTED\]"/);
  assert.match(direct, /"sessionId": "\[REDACTED\]"/);
  assert.match(direct, /"cookie": "\[REDACTED\]"/);
  assert.match(direct, /Starting API/);
  assert.match(direct, /"status": 503/);
  assert.match(direct, /Readiness failed/);
});

const malformedStructuredCases = [
  {
    name: "a trailing-comma outer object",
    input: [
      "Starting API",
      "{",
      '  "session": {',
      '    "id": "qa151-session-sentinel"',
      "  },",
      '  "sessionId": [',
      '    "qa151-array-sentinel"',
      "  ],",
      '  "cookie": "sid=qa151-cookie-sentinel",',
      '  "status": 503,',
      "}",
      "Readiness failed",
    ].join("\n"),
  },
  {
    name: "a missing-closing-brace outer object",
    input: [
      "Starting API",
      "{",
      '  "session": {',
      '    "id": "qa151-session-sentinel"',
      "  },",
      '  "sessionId": [',
      '    "qa151-array-sentinel"',
      "  ],",
      '  "cookie": "sid=qa151-cookie-sentinel",',
      '  "status": 503',
      "Readiness failed",
    ].join("\n"),
  },
  {
    name: "a plaintext session object assignment",
    input: [
      "Starting API",
      'session = {"id":"qa151-session-sentinel"}',
      "status=503",
      "Readiness failed",
    ].join("\n"),
  },
  {
    name: "a plaintext sessionId array assignment",
    input: [
      "Starting API",
      'sessionId = ["qa151-array-sentinel"]',
      "status=503",
      "Readiness failed",
    ].join("\n"),
  },
];

for (const { name, input } of malformedStructuredCases) {
  test(`fails closed for ${name} through direct and production log entry points`, () => {
    const direct = sanitizeLogs(input);
    const production = sanitizeThroughProductionEntryPoint(input);

    assert.equal(production, direct);
    assert.doesNotMatch(
      direct,
      /qa151-session-sentinel|qa151-array-sentinel|qa151-cookie-sentinel/,
    );
    assert.match(direct, /\[REDACTED\]/);
    assert.match(direct, /Starting API/);
    assert.match(direct, /503/);
    assert.match(direct, /Readiness failed/);
  });
}

const incompleteSensitiveStructuredCases = [
  {
    name: "a truncated sensitive object",
    input: [
      "Starting API",
      "status=503",
      '{"session": {',
      '  "id": "qa151-truncated-object-sentinel"',
      "Readiness failed",
    ].join("\n"),
  },
  {
    name: "a truncated sensitive array",
    input: [
      "Starting API",
      "status=503",
      "sessionId = [",
      '  "qa151-truncated-array-sentinel"',
      "Readiness failed",
    ].join("\n"),
  },
  {
    name: "a mismatched sensitive delimiter",
    input: [
      "Starting API",
      "status=503",
      '{"session": {',
      '  "id": "qa151-mismatched-sentinel"',
      "]",
      "Readiness failed",
    ].join("\n"),
  },
  {
    name: "a valid nested object inside an unclosed sensitive parent",
    input: [
      "Starting API",
      "status=503",
      "session = {",
      '"nested":{"id":"qa151-nested-unclosed-sentinel"}',
      "Readiness failed",
    ].join("\n"),
  },
  {
    name: "an array string truncated before its closing quote",
    input: [
      "Starting API",
      "status=503",
      "sessionId = [",
      '"qa151-truncated-string-sentinel',
      "Readiness failed",
    ].join("\n"),
  },
  {
    name: "an unclosed sensitive object with an unquoted property",
    input: [
      "Starting API",
      "status=503",
      "session = {",
      'id: "qa151-unquoted-property-sentinel"',
      "Readiness failed",
    ].join("\n"),
  },
];

for (const { name, input } of incompleteSensitiveStructuredCases) {
  test(`fails closed for ${name} through direct and production log entry points`, () => {
    const direct = sanitizeLogs(input);
    const production = sanitizeThroughProductionEntryPoint(input);

    assert.equal(production, direct);
    assert.doesNotMatch(
      direct,
      /qa151-truncated-object-sentinel|qa151-truncated-array-sentinel|qa151-mismatched-sentinel|qa151-nested-unclosed-sentinel|qa151-truncated-string-sentinel|qa151-unquoted-property-sentinel/,
    );
    assert.match(direct, /\[REDACTED\]/);
    assert.match(direct, /Starting API/);
    assert.match(direct, /status=503/);
    assert.match(direct, /Readiness failed/);
  });
}

const SELF_JOB_ID = "c".repeat(64);
const OTHER_JOB_ID = "d".repeat(64);
const DEAD_JOB_ID = "e".repeat(64);
const SELF_JOB = {
  id: SELF_JOB_ID,
  name: `FORGEJO-ACTIONS-TASK-900_WORKFLOW-${"a".repeat(64)}_JOB-application-docker-test`,
};
const OTHER_JOB = {
  id: OTHER_JOB_ID,
  name: `FORGEJO-ACTIONS-TASK-901_WORKFLOW-${"a".repeat(64)}_JOB-application-docker-test`,
};

function browserService(name, labels = {}) {
  return { id: name.padEnd(64, "0").slice(0, 64), name, labels };
}

test("reclaims a cancelled run's orphaned service container whose owning job container is gone", () => {
  const orphan = browserService("glantri-web-test-733-1", {
    "com.glantri.ci.owner": "glantri-browser-service",
    "com.glantri.ci.resource-suffix": "733-1",
    "com.glantri.ci.job-container": DEAD_JOB_ID,
  });
  const plan = planStaleServiceReclamation({
    serviceContainers: [orphan],
    runningJobContainers: [SELF_JOB],
    selfJobContainerId: SELF_JOB_ID,
    currentSuffix: "812-1",
  });

  assert.deepEqual(
    plan.stale.map((entry) => entry.container.name),
    ["glantri-web-test-733-1"],
  );
  assert.deepEqual(plan.retained, []);
  assert.deepEqual(plan.unresolved, []);
  assert.match(plan.stale[0].reason, /no longer runs/);
});

test("never reclaims services owned by an actually active run", () => {
  const active = browserService("glantri-api-test-900-1", {
    "com.glantri.ci.owner": "glantri-browser-service",
    "com.glantri.ci.resource-suffix": "900-1",
    "com.glantri.ci.job-container": OTHER_JOB_ID,
  });
  const ours = browserService("glantri-api-test-812-1", {
    "com.glantri.ci.owner": "glantri-browser-service",
    "com.glantri.ci.resource-suffix": "812-1",
    "com.glantri.ci.job-container": SELF_JOB_ID,
  });
  const plan = planStaleServiceReclamation({
    serviceContainers: [active, ours],
    runningJobContainers: [SELF_JOB, OTHER_JOB],
    selfJobContainerId: SELF_JOB_ID,
    currentSuffix: "812-1",
  });

  assert.deepEqual(plan.stale, []);
  assert.deepEqual(plan.retained.map((entry) => entry.container.name).sort(), [
    "glantri-api-test-812-1",
    "glantri-api-test-900-1",
  ]);
  assert.match(
    plan.retained.find((entry) => entry.container.name === "glantri-api-test-900-1").reason,
    /still running/,
  );
});

test("reclaims unanchored debris only when this job container is provably the only live job", () => {
  const legacy = browserService("glantri-web-test-401-1");

  const soleJob = planStaleServiceReclamation({
    serviceContainers: [legacy],
    runningJobContainers: [SELF_JOB],
    selfJobContainerId: SELF_JOB_ID,
    currentSuffix: "812-1",
  });
  assert.deepEqual(
    soleJob.stale.map((entry) => entry.container.name),
    ["glantri-web-test-401-1"],
  );

  const concurrent = planStaleServiceReclamation({
    serviceContainers: [legacy],
    runningJobContainers: [SELF_JOB, OTHER_JOB],
    selfJobContainerId: SELF_JOB_ID,
    currentSuffix: "812-1",
  });
  assert.deepEqual(concurrent.stale, []);
  assert.deepEqual(
    concurrent.unresolved.map((entry) => entry.container.name),
    ["glantri-web-test-401-1"],
  );
  assert.match(concurrent.unresolved[0].reason, /concurrent run cannot be ruled out/);
});

test("refuses every unanchored reclamation when this job container cannot be identified", () => {
  const plan = planStaleServiceReclamation({
    serviceContainers: [browserService("glantri-web-test-401-1")],
    runningJobContainers: [OTHER_JOB],
    selfJobContainerId: undefined,
    currentSuffix: "812-1",
  });

  assert.equal(plan.selfIdentified, false);
  assert.deepEqual(plan.stale, []);
  assert.deepEqual(
    plan.unresolved.map((entry) => entry.container.name),
    ["glantri-web-test-401-1"],
  );
});

test("requires a current run resource suffix before planning any reclamation", () => {
  assert.throws(
    () => planStaleServiceReclamation({ serviceContainers: [], currentSuffix: "" }),
    /run resource suffix/,
  );
});

test("identifies this job container only through proven possession of a fresh token", () => {
  const written = new Map();
  const identity = identifySelfJobContainer({
    candidates: [OTHER_JOB, SELF_JOB],
    writeToken: (filePath, token) => written.set(filePath, token),
    removeToken: (filePath) => written.delete(filePath),
    exec: (containerId, filePath) =>
      containerId === SELF_JOB_ID
        ? { status: 0, stdout: `${written.get(filePath)}\n` }
        : { status: 1, stdout: "" },
  });
  assert.equal(identity, SELF_JOB_ID);
  assert.equal(written.size, 0);

  assert.equal(
    identifySelfJobContainer({
      candidates: [OTHER_JOB],
      writeToken: (filePath, token) => written.set(filePath, token),
      removeToken: (filePath) => written.delete(filePath),
      exec: () => ({ status: 0, stdout: "a-token-we-did-not-generate\n" }),
    }),
    undefined,
  );
  assert.equal(identifySelfJobContainer({ candidates: [] }), undefined);
});
