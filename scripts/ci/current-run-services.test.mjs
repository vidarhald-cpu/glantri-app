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
