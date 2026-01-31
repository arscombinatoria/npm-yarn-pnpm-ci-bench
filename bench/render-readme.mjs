import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const resultsPath = path.join(repoRoot, 'results', 'results.json');
const readmePath = path.join(repoRoot, 'README.md');

function formatSeconds(ms) {
  if (!ms || Number.isNaN(ms)) {
    return '-';
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function buildTable(results) {
  const npm20 = results.partials['20-npm'];
  const npm22 = results.partials['22-npm'];
  const all24 = results.partials['24-all'];

  const npm20Ver = npm20?.versions?.npm ?? '-';
  const npm22Ver = npm22?.versions?.npm ?? '-';
  const npm24Ver = all24?.versions?.npm ?? '-';
  const pnpmVer = all24?.versions?.pnpm ?? '-';
  const yarnVer = all24?.versions?.yarn ?? '-';

  const header = [
    'action',
    'cache',
    'lockfile',
    'node_modules',
    `npm(Node20 ${npm20Ver})`,
    `npm(Node22 ${npm22Ver})`,
    `npm(Node24 ${npm24Ver})`,
    `pnpm(${pnpmVer})`,
    `Yarn(${yarnVer})`,
    `Yarn PnP(${yarnVer})`
  ];

  const rows = [];
  const settings = [];
  for (const cache of [true, false]) {
    for (const lockfile of [true, false]) {
      for (const nodeModules of [true, false]) {
        settings.push({ action: 'install', cache, lockfile, nodeModules });
      }
    }
  }
  for (const cache of [true, false]) {
    for (const nodeModules of [true, false]) {
      settings.push({ action: 'ci', cache, lockfile: true, nodeModules });
    }
  }

  function findResult(partial, tool, setting) {
    if (!partial) {
      return null;
    }
    return partial.results.find(
      (entry) =>
        entry.tool === tool &&
        entry.action === setting.action &&
        entry.cache === setting.cache &&
        entry.lockfile === setting.lockfile &&
        entry.nodeModules === setting.nodeModules
    );
  }

  for (const setting of settings) {
    const row = [
      setting.action,
      setting.cache ? '✓' : '',
      setting.lockfile ? '✓' : '',
      setting.nodeModules ? '✓' : ''
    ];

    const npm20Result = findResult(npm20, 'npm', setting);
    const npm22Result = findResult(npm22, 'npm', setting);
    const npm24Result = findResult(all24, 'npm', setting);
    const pnpmResult = findResult(all24, 'pnpm', setting);
    const yarnResult = findResult(all24, 'yarn', setting);
    const yarnPnpResult = findResult(all24, 'yarn-pnp', setting);

    row.push(formatSeconds(npm20Result?.p90_ms));
    row.push(formatSeconds(npm22Result?.p90_ms));
    row.push(formatSeconds(npm24Result?.p90_ms));
    row.push(formatSeconds(pnpmResult?.p90_ms));
    row.push(formatSeconds(yarnResult?.p90_ms));
    row.push(formatSeconds(yarnPnpResult?.p90_ms));

    rows.push(row);
  }

  const lines = [];
  lines.push(`| ${header.join(' | ')} |`);
  lines.push(`| ${header.map(() => '---').join(' | ')} |`);
  for (const row of rows) {
    lines.push(`| ${row.join(' | ')} |`);
  }

  return lines.join('\n');
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const readme = fs.readFileSync(readmePath, 'utf8');
const table = buildTable(results);
const startMarker = '@-- BENCH:START --';
const endMarker = '@-- BENCH:END --';

const startIndex = readme.indexOf(startMarker);
const endIndex = readme.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
  throw new Error('README markers not found or invalid.');
}

const before = readme.slice(0, startIndex + startMarker.length);
const after = readme.slice(endIndex);
const updated = `${before}\n${table}\n${after}`;

fs.writeFileSync(readmePath, updated);
