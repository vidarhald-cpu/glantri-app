import { execFileSync } from "node:child_process";

const inheritedDebtBaseline = "581841e99afd536d41cce4e5a5bac5a09f2be194";
const requestedBase =
  process.argv.slice(2).find((argument) => argument !== "--") ?? process.env.FORMAT_BASE_SHA;
const base = requestedBase && !/^0+$/.test(requestedBase) ? requestedBase : inheritedDebtBaseline;

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    ...options,
  });
}

try {
  git(["cat-file", "-e", `${base}^{commit}`]);
} catch {
  console.error(`Formatting base is not available: ${base}`);
  process.exit(2);
}

const mergeBase = git(["merge-base", base, "HEAD"]).trim();

function isAncestor(ancestor, descendant) {
  try {
    git(["merge-base", "--is-ancestor", ancestor, descendant]);
    return true;
  } catch {
    return false;
  }
}

const formattingBase =
  isAncestor(mergeBase, inheritedDebtBaseline) && isAncestor(inheritedDebtBaseline, "HEAD")
    ? inheritedDebtBaseline
    : mergeBase;

git(["diff", "--check", formattingBase], { stdio: "inherit" });

const changedFiles = [
  ...new Set(
    [
      git(["diff", "--name-only", "--diff-filter=ACMRTUXB", "-z", formattingBase]),
      git(["ls-files", "--others", "--exclude-standard", "-z"]),
    ]
      .join("")
      .split("\0")
      .filter(Boolean),
  ),
];

if (changedFiles.length === 0) {
  console.log(`No changed files require formatting checks relative to ${base}.`);
  process.exit(0);
}

console.log(
  `Checking formatting for ${changedFiles.length} changed files relative to ${formattingBase}.`,
);
execFileSync("pnpm", ["exec", "prettier", "--check", "--ignore-unknown", "--", ...changedFiles], {
  stdio: "inherit",
});
