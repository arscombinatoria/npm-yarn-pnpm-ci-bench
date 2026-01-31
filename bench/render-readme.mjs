import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RESULTS_PATH = path.join(ROOT, "results", "results.json");
const README_PATH = path.join(ROOT, "README.md");

function formatNumber(value) {
  if (value === null || value === undefined) return "na";
  if (Number.isNaN(value)) return "na";
  return value.toFixed(2);
}

function renderTable(results) {
  const header = [
    "pm",
    "pm_mode",
    "node",
    "command",
    "cache",
    "lockfile",
    "node_modules",
    "artifacts",
    "runs",
    "p50_ms",
    "p90_ms",
    "mean_ms",
    "min_ms",
    "max_ms",
    "status"
  ];
  const lines = [];
  lines.push(`| ${header.join(" | ")} |`);
  lines.push(`| ${header.map(() => "---").join(" | ")} |`);

  for (const row of results) {
    lines.push(
      `| ${[
        row.pm,
        row.pm_mode,
        row.node,
        row.command,
        row.cache,
        row.lockfile,
        row.node_modules,
        row.artifacts,
        row.runs,
        formatNumber(row.p50_ms),
        formatNumber(row.p90_ms),
        formatNumber(row.mean_ms),
        formatNumber(row.min_ms),
        formatNumber(row.max_ms),
        row.status
      ].join(" | ")} |`
    );
  }

  return lines.join("\n");
}

async function main() {
  const resultsContent = await fs.readFile(RESULTS_PATH, "utf8");
  const resultsJson = JSON.parse(resultsContent);
  const table = renderTable(resultsJson.results ?? []);

  const readme = await fs.readFile(README_PATH, "utf8");
  const startMarker = "<!-- BENCH:START -->";
  const endMarker = "<!-- BENCH:END -->";
  const startIndex = readme.indexOf(startMarker);
  const endIndex = readme.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error("README markers not found");
  }

  const before = readme.slice(0, startIndex + startMarker.length);
  const after = readme.slice(endIndex);
  const updated = `${before}\n\n${table}\n\n${after}`;

  await fs.writeFile(README_PATH, updated, "utf8");
  console.log("Updated README.md");
}

await main();
