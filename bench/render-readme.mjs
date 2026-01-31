import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const readmePath = path.join(rootDir, 'README.md');
const resultsPath = path.join(rootDir, 'results', 'results.json');

const readme = await fs.readFile(readmePath, 'utf8');
const resultsRaw = await fs.readFile(resultsPath, 'utf8');
const results = JSON.parse(resultsRaw);

const table = renderTable(results);
const updated = replaceSection(readme, table);

await fs.writeFile(readmePath, updated);

function replaceSection(content, tableMarkdown) {
  const startTag = '@-- BENCH:START --';
  const endTag = '@-- BENCH:END --';
  const startIndex = content.indexOf(startTag);
  const endIndex = content.indexOf(endTag);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error('Benchmark markers not found in README.md');
  }
  const before = content.slice(0, startIndex + startTag.length);
  const after = content.slice(endIndex);
  return `${before}\n\n${tableMarkdown}\n\n${after}`;
}

function renderTable(results) {
  const versions = results.versions ?? {};
  const npmVersions = versions.npm ?? {};
  const pnpmVersion = versions.pnpm ?? 'unknown';
  const yarnVersion = versions.yarn ?? 'unknown';

  const header = [
    'action',
    'cache',
    'lockfile',
    'node_modules',
    `npm(Node20 ${npmVersions['20'] ?? 'unknown'})`,
    `npm(Node22 ${npmVersions['22'] ?? 'unknown'})`,
    `npm(Node24 ${npmVersions['24'] ?? 'unknown'})`,
    `pnpm(${pnpmVersion})`,
    `Yarn(${yarnVersion})`,
    `Yarn PnP(${yarnVersion})`
  ];

  const rows = [
    header,
    header.map(() => '---')
  ];

  const cases = buildCases();
  for (const benchCase of cases) {
    const row = [
      benchCase.action,
      benchCase.cache ? '✓' : '',
      benchCase.lockfile ? '✓' : '',
      benchCase.nodeModules ? '✓' : ''
    ];

    row.push(
      formatCell(findEntry(results, benchCase, 'npm', 20))
    );
    row.push(
      formatCell(findEntry(results, benchCase, 'npm', 22))
    );
    row.push(
      formatCell(findEntry(results, benchCase, 'npm', 24))
    );
    row.push(
      formatCell(findEntry(results, benchCase, 'pnpm', 24))
    );
    row.push(
      formatCell(findEntry(results, benchCase, 'yarn', 24))
    );
    row.push(
      formatCell(findEntry(results, benchCase, 'yarn_pnp', 24))
    );

    rows.push(row);
  }

  return rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
}

function buildCases() {
  const installCases = [];
  for (const cache of [true, false]) {
    for (const lockfile of [true, false]) {
      for (const nodeModules of [true, false]) {
        installCases.push({ action: 'install', cache, lockfile, nodeModules });
      }
    }
  }

  const ciCases = [];
  for (const cache of [true, false]) {
    for (const nodeModules of [true, false]) {
      ciCases.push({ action: 'ci', cache, lockfile: true, nodeModules });
    }
  }

  return [...installCases, ...ciCases];
}

function findEntry(results, benchCase, manager, nodeMajor) {
  const entries = results.entries ?? [];
  return entries.find((entry) => (
    entry.manager === manager &&
    entry.nodeMajor === nodeMajor &&
    entry.action === benchCase.action &&
    entry.cache === benchCase.cache &&
    entry.lockfile === benchCase.lockfile &&
    entry.nodeModules === benchCase.nodeModules
  ));
}

function formatCell(entry) {
  if (!entry) {
    return '—';
  }
  return formatSeconds(entry.p90Ms);
}

function formatSeconds(milliseconds) {
  const seconds = milliseconds / 1000;
  return `${seconds.toFixed(1)}s`;
}
