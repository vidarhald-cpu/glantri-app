import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, realpathSync, lstatSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { check, resolveConfig, getFileInfo } from "prettier";
import { parsers } from "prettier/plugins/markdown";
import { environmentPlan } from "./dev-integration-gate.mjs";

function nodes(root) {
  return [root, ...(root.children ?? []).flatMap(nodes)];
}

function text(node) {
  return node.value ?? (node.children ?? []).map(text).join("");
}

export async function checkLinks(files, cwd = process.cwd(), affectedTargets) {
  const cache = new Map();
  async function document(file) {
    if (!cache.has(file))
      cache.set(file, nodes(await parsers.markdown.parse(readFileSync(file, "utf8"))));
    return cache.get(file);
  }
  for (const file of files) {
    const absolute = path.resolve(cwd, file);
    const ast = await document(absolute);
    const definitions = new Map(
      ast.filter((n) => n.type === "definition").map((n) => [n.identifier, n.url]),
    );
    for (const node of ast) {
      if (!["link", "image", "linkReference", "imageReference", "definition"].includes(node.type))
        continue;
      const url = node.url ?? definitions.get(node.identifier);
      // Unresolved shortcut references are ordinary bracketed prose. For
      // unchanged sources, only resolved links can target an affected file.
      if (!url && (affectedTargets || node.referenceType === "shortcut")) continue;
      if (!url) throw new Error(`${file}: undefined reference ${node.identifier}`);
      if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) continue;
      const [location, fragment] = url.split("#");
      const decoded = decodeURIComponent(location.split("?")[0]);
      const target = decoded
        ? path.resolve(
            decoded.startsWith("/") ? cwd : path.dirname(absolute),
            decoded.replace(/^\//, ""),
          )
        : absolute;
      if (affectedTargets && !affectedTargets.has(path.relative(cwd, target))) continue;
      if (
        !target.startsWith(`${cwd}${path.sep}`) ||
        !existsSync(target) ||
        !realpathSync(target).startsWith(`${realpathSync(cwd)}${path.sep}`)
      ) {
        throw new Error(`${file}: missing or out-of-repository link ${url}`);
      }
      if (fragment && target.endsWith(".md")) {
        const ids = new Set();
        for (const heading of (await document(target)).filter((n) => n.type === "heading")) {
          const slug = text(heading)
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\p{M}\- _]/gu, "")
            .replace(/ /g, "-");
          let id = slug;
          for (let suffix = 1; ids.has(id); suffix++) id = `${slug}-${suffix}`;
          ids.add(id);
        }
        // Explicit HTML anchors are also used in repository Markdown.
        const source = readFileSync(target, "utf8");
        for (const match of source.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) ids.add(match[1]);
        if (!ids.has(decodeURIComponent(fragment)))
          throw new Error(`${file}: missing heading ${url}`);
      }
    }
  }
}

export async function checkDocuments(plan, cwd = process.cwd()) {
  execFileSync("git", ["diff", "--check", plan.mergeBase, plan.head, "--"], {
    cwd,
    stdio: "inherit",
  });
  const files = plan.changes.filter((c) => c.newMode === "100644").map((c) => c.path);
  for (const file of files) {
    const absolute = path.resolve(cwd, file);
    const info = await getFileInfo(absolute);
    if (
      info.inferredParser &&
      !(await check(readFileSync(absolute, "utf8"), {
        ...(await resolveConfig(absolute)),
        filepath: absolute,
      }))
    ) {
      throw new Error(`Formatting failed: ${file}`);
    }
  }
  const markdown = files.filter((file) => file.endsWith(".md"));
  await checkLinks(markdown, cwd);
  // A removed/renamed document or heading must not leave inbound references broken.
  const affected = new Set(plan.changes.map((c) => c.path));
  const trackedMarkdown = execFileSync("git", ["ls-files", "-z", "--", "*.md"], {
    cwd,
    encoding: "utf8",
  })
    .split("\0")
    .filter((file) => file && lstatSync(path.resolve(cwd, file)).isFile());
  await checkLinks(
    trackedMarkdown.filter((file) => !markdown.includes(file)),
    cwd,
    affected,
  );
  console.log(
    `Documentation/formatting PASS: ${plan.head}; ${files.length} changed regular files, ${markdown.length} Markdown documents.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await checkDocuments(environmentPlan());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
