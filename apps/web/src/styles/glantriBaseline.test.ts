import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const css = readFileSync(path.join(repoRoot, "apps/web/src/styles/glantri-baseline.css"), "utf8");

const tokenLines = css.split("\n").filter((line) => /^\s*--glantri-[\w-]+:/.test(line));

const allowedCitationFiles = [
  "apps/web/src/features/chargen/ChargenWizardExperience.module.css",
  "apps/web/src/features/combat-round-manager/CombatRoundManagerPanel.tsx",
];

describe("glantri-baseline.css hard rule (#538)", () => {
  it("declares tokens", () => {
    expect(tokenLines.length).toBeGreaterThan(10);
  });

  it.each(tokenLines)(
    "token is cited to a Combat/Chargen line containing its value: %s",
    (line) => {
      const match = /^\s*(--glantri-[\w-]+):\s*([^;]+);\s*\/\*\s*cite:\s*(\S+?):(\d+)\s*\*\//.exec(
        line,
      );
      expect(match, "token must carry a `cite: file:line` comment").not.toBeNull();
      const [, , value, file, lineNo] = match!;
      expect(allowedCitationFiles).toContain(file);
      const cited =
        readFileSync(path.join(repoRoot, file), "utf8").split("\n")[Number(lineNo) - 1] ?? "";
      // Combat writes numeric radius as `12`; every other value appears literally.
      const needle = value.trim();
      const bare = needle.replace(/px$/, "");
      expect(
        cited.includes(needle) || (/^\d+px$/.test(needle) && cited.includes(`: ${bare},`)),
      ).toBe(true);
    },
  );

  it("uses no element selectors and wraps every class selector in :where()", () => {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [...withoutComments.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim());
    for (const selector of selectors) {
      expect(selector === ":root" || /^:where\(\.glantri-[\w-]+\)$/.test(selector)).toBe(true);
    }
  });

  it("rule bodies use only var(--glantri-*) or keywords, never literal colours/sizes", () => {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const ruleBodies = [...withoutComments.matchAll(/:where\([^)]*\)\s*\{([^}]*)\}/g)].map(
      (m) => m[1],
    );
    for (const body of ruleBodies) {
      expect(body).not.toMatch(/#[0-9a-f]{3,6}\b/i);
      expect(body).not.toMatch(/\d+(\.\d+)?(rem|px)/);
    }
  });
});
