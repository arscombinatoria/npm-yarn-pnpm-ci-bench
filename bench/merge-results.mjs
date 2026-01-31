import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PARTIAL_DIR = path.join(ROOT, "results", "partial");
const OUTPUT_PATH = path.join(ROOT, "results", "results.json");

async function loadPartials() {
  const entries = await fs.readdir(PARTIAL_DIR).catch(() => []);
  const partials = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const fullPath = path.join(PARTIAL_DIR, entry);
    const content = await fs.readFile(fullPath, "utf8");
    partials.push(JSON.parse(content));
  }
  return partials;
}

function sortKey(row) {
  return [
    row.pm,
    row.pm_mode,
    row.node,
    row.command,
    row.cache,
    row.lockfile,
    row.node_modules,
    row.artifacts
  ].join("|");
}

async function main() {
  const partials = await loadPartials();
  const results = partials.flatMap((partial) => partial.results ?? []);
  results.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  const output = {
    generated_at: new Date().toISOString(),
    nodes: partials.map((partial) => partial.node).sort((a, b) => a - b),
    results
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

await main();
