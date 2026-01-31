import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RESULTS_FILE = path.join(ROOT, 'results', 'results.json');
const README_FILE = path.join(ROOT, 'README.md');

const START_MARKER = '<!-- BENCH:START -->';
const END_MARKER = '<!-- BENCH:END -->';

function formatNumber(value) {
  if (value === null || value === undefined) return 'na';
  return value.toFixed(2);
}

function buildTable(results) {
  if (results.length === 0) {
    return 'No benchmark results yet.';
  }
  const headers = [
    'pm',
    'pm_mode',
    'node',
    'command',
    'cache',
    'lockfile',
    'node_modules',
    'artifacts',
    'runs',
    'p50_ms',
    'p90_ms',
    'mean_ms',
    'min_ms',
    'max_ms',
    'status'
  ];
  const lines = [];
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);

  const sorted = [...results].sort((a, b) => {
    const fields = ['pm', 'pm_mode', 'node', 'command', 'cache', 'lockfile', 'node_modules', 'artifacts'];
    for (const field of fields) {
      const aVal = String(a[field]);
      const bVal = String(b[field]);
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
    }
    return 0;
  });

  for (const row of sorted) {
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
      ].join(' | ')} |`
    );
  }

  return lines.join('\n');
}

async function main() {
  const [readmeRaw, resultsRaw] = await Promise.all([
    fs.readFile(README_FILE, 'utf8'),
    fs.readFile(RESULTS_FILE, 'utf8')
  ]);
  const results = JSON.parse(resultsRaw).results ?? [];
  const table = buildTable(results);
  const startIndex = readmeRaw.indexOf(START_MARKER);
  const endIndex = readmeRaw.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('README markers not found or invalid.');
  }

  const before = readmeRaw.slice(0, startIndex + START_MARKER.length);
  const after = readmeRaw.slice(endIndex);
  const next = `${before}\n\n${table}\n\n${after}`;

  await fs.writeFile(README_FILE, next, 'utf8');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
