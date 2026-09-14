#!/usr/bin/env node

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONTAINER_ID_PATTERN = /^[a-f0-9]{64}$/;
const IMAGE_ID_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SERVICE_PATTERN = /^[a-z][a-z0-9-]*$/;
const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|password|passwd|token|secret|session|api[_-]?key/i;
const COMPOUND_SECRET_KEY = String.raw`(?:authorization|proxy[_-]?authorization|cookie|set[_-]?cookie|password|passwd|token|secret|session(?:[_-]?id)?|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|client[_-]?secret)`;
const SECRET_ASSIGNMENT_PREFIX = String.raw`(?:"|')?\b${COMPOUND_SECRET_KEY}\b(?:"|')?\s*[:=]\s*`;
const QUOTED_SECRET_ASSIGNMENT_PATTERN = new RegExp(
  String.raw`(${SECRET_ASSIGNMENT_PREFIX})("(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*')`,
  "gi",
);
const UNTERMINATED_DOUBLE_QUOTED_SECRET_PATTERN = new RegExp(
  String.raw`(${SECRET_ASSIGNMENT_PREFIX})"(?:\\.|[^"\\\r\n])*$`,
  "gim",
);
const UNTERMINATED_SINGLE_QUOTED_SECRET_PATTERN = new RegExp(
  String.raw`(${SECRET_ASSIGNMENT_PREFIX})'(?:\\.|[^'\\\r\n])*$`,
  "gim",
);
const SENSITIVE_STRUCTURED_ASSIGNMENT_PATTERN = new RegExp(SECRET_ASSIGNMENT_PREFIX, "gi");
const SAFE_UNCLOSED_STRUCTURE_BOUNDARY_PATTERN =
  /^(?:Readiness failed(?:\s+status=\d{3})?|status=\d{3})$/i;
const PROBE_SCRIPT = String.raw`
const http = require("node:http");
const url = process.argv[1];
const request = http.get(url, (response) => {
  response.resume();
  response.once("end", () => {
    process.exit(response.statusCode >= 200 && response.statusCode < 300 ? 0 : 1);
  });
});
request.setTimeout(4000, () => request.destroy(new Error("request timed out")));
request.once("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
`;

function fail(message) {
  throw new Error(message);
}

function parsePort(value, label) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail(`${label} must be an integer from 1 to 65535.`);
  }
  return port;
}

function statePath(stateDirectory, service) {
  if (!SERVICE_PATTERN.test(service)) fail(`Invalid service label: ${service}`);
  return path.join(stateDirectory, `${service}.json`);
}

export function validateMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") fail("Service metadata is missing.");
  if (!SERVICE_PATTERN.test(metadata.service)) fail("Service metadata has an invalid label.");
  if (!CONTAINER_ID_PATTERN.test(metadata.containerId)) {
    fail(`Recorded ${metadata.service} container ID is not a full Docker ID.`);
  }
  if (!IMAGE_ID_PATTERN.test(metadata.imageId)) {
    fail(`Recorded ${metadata.service} image ID is not a full Docker image ID.`);
  }
  if (typeof metadata.imageTag !== "string" || metadata.imageTag.length === 0) {
    fail(`Recorded ${metadata.service} image tag is missing.`);
  }
  parsePort(metadata.containerPort, "Container port");
  parsePort(metadata.hostPort, "Host port");
  return metadata;
}

function readMetadata(stateDirectory, service) {
  const file = statePath(stateDirectory, service);
  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`Could not read recorded ${service} service identity at ${file}: ${error.message}`);
  }
  return validateMetadata(metadata);
}

function runDocker(args, { allowFailure = false } = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) fail(`Could not execute Docker: ${result.error.message}`);
  if (!allowFailure && result.status !== 0) {
    const detail = sanitizeLogs(`${result.stdout ?? ""}${result.stderr ?? ""}`).trim();
    fail(`Docker ${args[0]} failed${detail ? `: ${detail}` : "."}`);
  }
  return result;
}

function inspectContainer(containerId) {
  const result = runDocker(["inspect", containerId], { allowFailure: true });
  if (result.status !== 0) return undefined;
  const parsed = JSON.parse(result.stdout);
  return parsed[0];
}

function inspectImage(imageReference) {
  const result = runDocker(["image", "inspect", imageReference], { allowFailure: true });
  if (result.status !== 0) return undefined;
  const parsed = JSON.parse(result.stdout);
  return parsed[0];
}

function sanitizeText(value) {
  return String(value)
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)([^/\s?#@]+)@/gi, "$1[REDACTED]@")
    .replace(/\b(Bearer|Basic|token)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [REDACTED]")
    .replace(
      /\b(authorization|proxy-authorization|cookie|set-cookie)\s*[:=]\s*[^\r\n]+/gi,
      "$1: [REDACTED]",
    )
    .replace(QUOTED_SECRET_ASSIGNMENT_PATTERN, (_match, prefix, quotedValue) => {
      const quote = quotedValue[0];
      return `${prefix}${quote}[REDACTED]${quote}`;
    })
    .replace(UNTERMINATED_DOUBLE_QUOTED_SECRET_PATTERN, "$1[REDACTED]")
    .replace(UNTERMINATED_SINGLE_QUOTED_SECRET_PATTERN, "$1[REDACTED]")
    .replace(new RegExp(`([?&](?:amp;)?${COMPOUND_SECRET_KEY}=)[^&\\s]+`, "gi"), "$1[REDACTED]")
    .replace(new RegExp(`(${SECRET_ASSIGNMENT_PREFIX})[^&\\s,;]+`, "gi"), "$1[REDACTED]");
}

function redactStructuredValue(entry) {
  if (Array.isArray(entry)) return entry.map(redactStructuredValue);
  if (typeof entry === "string") return sanitizeText(entry);
  if (!entry || typeof entry !== "object") return entry;
  return Object.fromEntries(
    Object.entries(entry).map(([key, child]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : redactStructuredValue(child),
    ]),
  );
}

function sanitizeJson(value, pretty = false) {
  try {
    return JSON.stringify(redactStructuredValue(JSON.parse(value)), null, pretty ? 2 : undefined);
  } catch {
    return undefined;
  }
}

function findJsonEnd(value, start) {
  const stack = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      stack.push("}");
    } else if (character === "[") {
      stack.push("]");
    } else if (character === "}" || character === "]") {
      if (stack.pop() !== character) return undefined;
      if (stack.length === 0) return index + 1;
    }
  }
  return undefined;
}

function findUnclosedStructuredValueEnd(input, valueStart) {
  let newline = input.indexOf("\n", valueStart);
  while (newline !== -1) {
    const lineStart = newline + 1;
    const lineEnd = input.indexOf("\n", lineStart);
    const line = input.slice(lineStart, lineEnd < 0 ? input.length : lineEnd);
    if (SAFE_UNCLOSED_STRUCTURE_BOUNDARY_PATTERN.test(line.trim())) return newline;
    if (lineEnd === -1) break;
    newline = lineEnd;
  }
  return input.length;
}

function sanitizeSensitiveStructuredAssignments(input) {
  let output = "";
  let copiedThrough = 0;
  SENSITIVE_STRUCTURED_ASSIGNMENT_PATTERN.lastIndex = 0;
  for (let match = SENSITIVE_STRUCTURED_ASSIGNMENT_PATTERN.exec(input); match; ) {
    const valueStart = SENSITIVE_STRUCTURED_ASSIGNMENT_PATTERN.lastIndex;
    if (!["{", "["].includes(input[valueStart])) {
      match = SENSITIVE_STRUCTURED_ASSIGNMENT_PATTERN.exec(input);
      continue;
    }
    const valueEnd = findJsonEnd(input, valueStart);
    if (valueEnd === undefined) {
      const recoveryEnd = findUnclosedStructuredValueEnd(input, valueStart);
      output += `${input.slice(copiedThrough, match.index)}${match[0]}"[REDACTED]"`;
      copiedThrough = recoveryEnd;
      SENSITIVE_STRUCTURED_ASSIGNMENT_PATTERN.lastIndex = recoveryEnd;
      match = SENSITIVE_STRUCTURED_ASSIGNMENT_PATTERN.exec(input);
      continue;
    }
    output += input.slice(copiedThrough, match.index);
    output += `${match[0]}"[REDACTED]"`;
    copiedThrough = valueEnd;
    SENSITIVE_STRUCTURED_ASSIGNMENT_PATTERN.lastIndex = valueEnd;
    match = SENSITIVE_STRUCTURED_ASSIGNMENT_PATTERN.exec(input);
  }
  SENSITIVE_STRUCTURED_ASSIGNMENT_PATTERN.lastIndex = 0;
  return `${output}${input.slice(copiedThrough)}`;
}

function sanitizeEmbeddedJson(input) {
  let output = "";
  let copiedThrough = 0;
  let searchFrom = 0;
  while (searchFrom < input.length) {
    const objectIndex = input.indexOf("{", searchFrom);
    const arrayIndex = input.indexOf("[", searchFrom);
    const candidates = [objectIndex, arrayIndex].filter((index) => index >= 0);
    if (candidates.length === 0) break;
    const fragmentStart = Math.min(...candidates);
    const fragmentEnd = findJsonEnd(input, fragmentStart);
    if (fragmentEnd === undefined) {
      searchFrom = fragmentStart + 1;
      continue;
    }

    const fragment = input.slice(fragmentStart, fragmentEnd);
    const sanitizedFragment = sanitizeJson(fragment, fragment.includes("\n"));
    if (sanitizedFragment === undefined) {
      searchFrom = fragmentStart + 1;
      continue;
    }

    output += sanitizeText(input.slice(copiedThrough, fragmentStart));
    output += sanitizedFragment;
    copiedThrough = fragmentEnd;
    searchFrom = fragmentEnd;
  }

  return `${output}${sanitizeText(input.slice(copiedThrough))}`;
}

export function sanitizeLogs(value) {
  const input = sanitizeSensitiveStructuredAssignments(String(value));
  const documentMatch = /^(\s*)([\s\S]*?)(\s*)$/.exec(input);
  const [, leading, document, trailing] = documentMatch;
  const sanitizedDocument = sanitizeJson(document, document.includes("\n"));
  if (sanitizedDocument !== undefined) {
    return `${leading}${sanitizedDocument}${trailing}`;
  }
  return sanitizeEmbeddedJson(input);
}

function checkPort(host, port, timeoutMs = 750) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      callback();
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(() => resolve({ occupied: true })));
    socket.once("timeout", () =>
      finish(() => reject(new Error(`Timed out checking ${host}:${port}.`))),
    );
    socket.once("error", (error) => {
      if (error.code === "ECONNREFUSED") {
        finish(() => resolve({ occupied: false }));
      } else {
        finish(() => reject(error));
      }
    });
  });
}

export async function assertPortsFree(host, ports) {
  if (!host) fail("A Docker host name is required.");
  const occupied = [];
  for (const portValue of ports) {
    const port = parsePort(portValue, "Port");
    const result = await checkPort(host, port);
    if (result.occupied) occupied.push(port);
  }
  if (occupied.length > 0) {
    fail(
      `Required current-run service port${occupied.length === 1 ? " is" : "s are"} already occupied on ${host}: ${occupied.join(", ")}. Refusing to start browser services.`,
    );
  }
}

function recordService([
  stateDirectory,
  service,
  containerId,
  imageId,
  imageTag,
  containerPort,
  hostPort,
]) {
  const metadata = validateMetadata({
    service,
    containerId,
    imageId,
    imageTag,
    containerPort: parsePort(containerPort, "Container port"),
    hostPort: parsePort(hostPort, "Host port"),
  });
  fs.mkdirSync(stateDirectory, { recursive: true });
  fs.writeFileSync(statePath(stateDirectory, service), `${JSON.stringify(metadata, null, 2)}\n`, {
    flag: "wx",
  });
  console.log(`Recorded current ${service} container ${containerId} with image ${imageId}.`);
}

function verifyService(stateDirectory, service) {
  const metadata = readMetadata(stateDirectory, service);
  const container = inspectContainer(metadata.containerId);
  if (!container) fail(`Current ${service} container ${metadata.containerId} no longer exists.`);
  if (container.Id !== metadata.containerId) fail(`Current ${service} container ID changed.`);
  if (container.Image !== metadata.imageId) {
    fail(`Current ${service} container image is ${container.Image}, expected ${metadata.imageId}.`);
  }
  if (container.State?.Running !== true) {
    fail(`Current ${service} container ${metadata.containerId} is not running.`);
  }
  if (container.HostConfig?.NetworkMode === "host") {
    fail(`Current ${service} container unexpectedly shares the Docker host network.`);
  }
  const bindings = container.NetworkSettings?.Ports?.[`${metadata.containerPort}/tcp`];
  if (
    !Array.isArray(bindings) ||
    !bindings.some((binding) => Number(binding.HostPort) === metadata.hostPort)
  ) {
    fail(
      `Current ${service} container does not own host port ${metadata.hostPort} for container port ${metadata.containerPort}.`,
    );
  }
  console.log(
    `Verified current ${service} container ${metadata.containerId}, image ${metadata.imageId}, and host port ${metadata.hostPort}.`,
  );
  return metadata;
}

function printLogs(stateDirectory, service) {
  const metadata = readMetadata(stateDirectory, service);
  console.log(`Sanitized logs for intended current ${service} container ${metadata.containerId}:`);
  const result = runDocker(["logs", metadata.containerId], { allowFailure: true });
  const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  process.stdout.write(sanitizeLogs(combined || "[No container logs were available.]\n"));
  if (result.status !== 0) fail(`Could not read current ${service} container logs.`);
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForHttp([stateDirectory, service, url, attemptsValue, delayValue]) {
  const attempts = Number(attemptsValue);
  const delayMs = Number(delayValue);
  if (!Number.isInteger(attempts) || attempts < 1) fail("Attempts must be a positive integer.");
  if (!Number.isInteger(delayMs) || delayMs < 0) fail("Delay must be a non-negative integer.");

  let metadata;
  try {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      metadata = verifyService(stateDirectory, service);
      const probeUrl = new URL(url);
      if (
        probeUrl.protocol !== "http:" ||
        !["127.0.0.1", "localhost"].includes(probeUrl.hostname) ||
        Number(probeUrl.port) !== metadata.containerPort
      ) {
        fail(
          `Current ${service} readiness must probe its recorded container-local port ${metadata.containerPort}.`,
        );
      }
      const result = runDocker(["exec", metadata.containerId, "node", "-e", PROBE_SCRIPT, url], {
        allowFailure: true,
      });
      if (result.status === 0) {
        verifyService(stateDirectory, service);
        console.log(`Current ${service} readiness passed on attempt ${attempt}.`);
        return;
      }
      console.log(`Current ${service} readiness attempt ${attempt}/${attempts} failed.`);
      if (attempt < attempts) await sleep(delayMs);
    }
    fail(`Current ${service} service did not become ready after ${attempts} attempts.`);
  } catch (error) {
    try {
      printLogs(stateDirectory, service);
    } catch (logError) {
      console.error(logError.message);
    }
    throw error;
  }
}

function cleanupService(stateDirectory, service) {
  const metadata = readMetadata(stateDirectory, service);
  const container = inspectContainer(metadata.containerId);
  if (container) {
    if (container.Id !== metadata.containerId || container.Image !== metadata.imageId) {
      fail(`Refusing to remove mismatched recorded ${service} container.`);
    }
    runDocker(["rm", "-f", metadata.containerId]);
  }
  if (inspectContainer(metadata.containerId)) {
    fail(`Recorded ${service} container ${metadata.containerId} remains after cleanup.`);
  }

  const image = inspectImage(metadata.imageTag);
  if (image) {
    if (image.Id !== metadata.imageId) {
      fail(`Refusing to remove mismatched recorded ${service} image tag ${metadata.imageTag}.`);
    }
    runDocker(["image", "rm", metadata.imageTag]);
  }
  if (inspectImage(metadata.imageTag)) {
    fail(`Recorded ${service} image tag ${metadata.imageTag} remains after cleanup.`);
  }
  console.log(`Verified exact cleanup for recorded ${service} container and image tag.`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "assert-ports-free":
      if (args.length < 2) fail("Usage: assert-ports-free <host> <port...>");
      await assertPortsFree(args[0], args.slice(1));
      console.log(`Required current-run service ports are free on ${args[0]}.`);
      break;
    case "record":
      if (args.length !== 7) {
        fail(
          "Usage: record <state-dir> <service> <container-id> <image-id> <image-tag> <container-port> <host-port>",
        );
      }
      recordService(args);
      break;
    case "verify":
      if (args.length !== 2) fail("Usage: verify <state-dir> <service>");
      verifyService(args[0], args[1]);
      break;
    case "wait-http":
      if (args.length !== 5) {
        fail("Usage: wait-http <state-dir> <service> <url> <attempts> <delay-ms>");
      }
      await waitForHttp(args);
      break;
    case "logs":
      if (args.length !== 2) fail("Usage: logs <state-dir> <service>");
      printLogs(args[0], args[1]);
      break;
    case "cleanup":
      if (args.length !== 2) fail("Usage: cleanup <state-dir> <service>");
      cleanupService(args[0], args[1]);
      break;
    default:
      fail(`Unknown current-run service command: ${command ?? "(missing)"}`);
  }
}

const isMain =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
