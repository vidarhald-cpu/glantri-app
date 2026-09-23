/**
 * Competency Content V2 — CANONICAL Product Owner content (#250), accepted 2026-09-23; see
 * `docs/decisions/rules/0008-competency-content-v2-canonical-acceptance.md`.
 *
 * Deliberately not re-exported from `packages/content/src/index.ts`: importing this module must be
 * an explicit, visible choice, and no runtime or Chargen path may depend on it until #251/#252
 * scope that wiring in.
 */
export * from "./competencyContentV2Source";
export * from "./competencyContentV2";
