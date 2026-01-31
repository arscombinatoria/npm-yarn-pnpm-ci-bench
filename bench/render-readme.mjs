import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const resultsPath = path.join(repoRoot, 'results', 'results.json');
const readmePath = path.join(repoRoot, 'README.md');

const results = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
const readme = await fs.readFile(readmePath, 'utf8');

const table = renderTable(results);
const updated = replaceSection(readme, table);

await fs.writeFile(readmePath, updated);

function renderTable(data) {
  const npmVersions = data.versions?.npm || {};
  const npm20 = npmVersions['20'] || 'n/a';
  const npm22 = npmVersions['22'] || 'n/a';
  const npm24 = npmVersions['24'] || 'n/a';
  const pnpmVersion = data.versions?.pnpm || 'n/a';
  const yarnVersion = data.versions?.yarn || 'n/a';

  const headers = [
    'action',
    'cache',
    'lockfile',
    'node_modules',
    `npm(Node20 ${npm20})`,
    `npm(Node22 ${npm22})`,
    `npm(Node24 ${npm24})`,
    `pnpm(${pnpmVersion})`,
    `Yarn(${yarnVersion})`,
    `Yarn PnP(${yarnVersion})`,
  ];

  const rows = data.cases.map((row) => {
    return [
      row.action,
      row.cache ? '✓' : '',
      row.lockfile ? '✓' : '',
      row.nodeModules ? '✓' : '',
      formatSeconds(row.npm?.['20']),
      formatSeconds(row.npm?.['22']),
      formatSeconds(row.npm?.['24']),
      formatSeconds(row.pnpm),
      formatSeconds(row.yarn?.['node-modules']),
      formatSeconds(row.yarn?.pnp),
    ];
  });

  const tableLines = [];
  tableLines.push(`| ${headers.join(' | ')} |`);
  tableLines.push(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const row of rows) {
    tableLines.push(`| ${row.join(' | ')} |`);
  }

  return tableLines.join('\n');
}

function formatSeconds(ms) {
  if (ms == null) return '';
  const seconds = ms / 1000;
  return `${seconds.toFixed(1)}s`;
}

function replaceSection(content, table) {
  const start = '<!-- BENCH:START -->';
  const end = '<!-- BENCH:END -->';
  const regex = new RegExp(`${start}[\\s\\S]*?${end}`);
  const block = `${start}\n${table}\n${end}`;
  if (regex.test(content)) {
    return content.replace(regex, block);
  }
  return `${content.trim()}\n\n${block}\n`;
}
