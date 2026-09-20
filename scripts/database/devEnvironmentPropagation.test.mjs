import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repositoryRoot, relativePath), "utf8"));
}

function matchesDeclaration(declarations, name) {
  return declarations.some((declaration) => {
    if (declaration.endsWith("*")) {
      return name.startsWith(declaration.slice(0, -1));
    }

    return declaration === name;
  });
}

// Turborepo 2.x runs tasks in strict environment mode, so a variable present in
// the guarded parent environment never reaches `next dev` / `tsx watch` unless
// the task declares it. Without these declarations `pnpm dev:full` starts an API
// that has no DATABASE_URL while still looking superficially alive.
test("the turbo dev task declares the environment local startup depends on", () => {
  const turboConfig = readJson("turbo.json");
  const devTask = turboConfig.tasks?.dev;

  assert.ok(devTask, "turbo.json must define a dev task.");

  const declarations = [...(devTask.passThroughEnv ?? []), ...(devTask.env ?? [])];

  for (const name of [
    "DATABASE_URL",
    "DATABASE_URL_TEST",
    "GLANTRI_DB_APPLICATION_URL",
    "GLANTRI_DB_CONTAINER",
    "GLANTRI_DB_MODE",
    "GLANTRI_DB_OWNER",
    "GLANTRI_DB_TASK",
    "API_HOST",
    "API_PORT",
    "WEB_ORIGIN",
    "NEXT_PUBLIC_API_BASE_URL",
  ]) {
    assert.ok(
      matchesDeclaration(declarations, name),
      `turbo dev must propagate ${name} to child processes.`,
    );
  }
});

test("the canonical local startup chain still runs through the guarded database command", () => {
  const { scripts } = readJson("package.json");

  assert.equal(scripts.dev, "node --import tsx scripts/database/guardedDatabaseCommand.ts dev");
  assert.equal(scripts["dev:full"], "pnpm --filter @glantri/content build && pnpm dev");
});
