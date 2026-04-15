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
  const toolOrder = ['npm', 'pnpm', 'yarn', 'yarn-pnp'];
  const toolLabel = {
    npm: 'npm',
    pnpm: 'pnpm',
    yarn: 'Yarn',
    'yarn-pnp': 'Yarn PnP'
  };

  const partialEntries = Object.entries(results.partials ?? {})
    .map(([key, partial]) => {
      const match = /^(\d+)-(.+)$/.exec(key);
      const nodeMajor = match ? Number.parseInt(match[1], 10) : Number(partial?.nodeMajor);
      const scope = match ? match[2] : String(partial?.scope ?? '');
      const tools = [...new Set((partial?.results ?? []).map((entry) => entry.tool))];
      return { key, nodeMajor, scope, partial, tools };
    })
    .filter((entry) => Number.isInteger(entry.nodeMajor))
    .sort(
      (a, b) =>
        a.nodeMajor - b.nodeMajor ||
        a.scope.localeCompare(b.scope) ||
        a.key.localeCompare(b.key)
    );

  function scopePriority(scope, tool) {
    if (scope === tool) return 0;
    if (scope === 'all') return 1;
    return 2;
  }

  const toolColumns = [];
  const seenColumns = new Set();
  for (const entry of partialEntries) {
    for (const tool of entry.tools) {
      const key = `${entry.nodeMajor}-${tool}`;
      if (seenColumns.has(key)) {
        continue;
      }
      seenColumns.add(key);
      toolColumns.push({
        key,
        nodeMajor: entry.nodeMajor,
        tool
      });
    }
  }

  toolColumns.sort(
    (a, b) =>
      a.nodeMajor - b.nodeMajor ||
      (toolOrder.indexOf(a.tool) === -1 ? Number.MAX_SAFE_INTEGER : toolOrder.indexOf(a.tool)) -
        (toolOrder.indexOf(b.tool) === -1 ? Number.MAX_SAFE_INTEGER : toolOrder.indexOf(b.tool)) ||
      a.tool.localeCompare(b.tool)
  );

  function pickPartialForTool(nodeMajor, tool) {
    const candidates = partialEntries
      .filter((entry) => entry.nodeMajor === nodeMajor && entry.tools.includes(tool))
      .sort(
        (a, b) =>
          scopePriority(a.scope, tool) - scopePriority(b.scope, tool) ||
          a.scope.localeCompare(b.scope) ||
          a.key.localeCompare(b.key)
      );
    return candidates[0]?.partial ?? null;
  }

  function resolveToolVersion(partial, tool) {
    if (!partial) {
      return '-';
    }
    if (tool === 'yarn-pnp') {
      return partial.versions?.['yarn-pnp'] ?? partial.versions?.yarn ?? '-';
    }
    return partial.versions?.[tool] ?? '-';
  }

  const header = [
    'action',
    'cache',
    'lockfile',
    'node_modules',
    ...toolColumns.map((column) => {
      const partial = pickPartialForTool(column.nodeMajor, column.tool);
      const version = resolveToolVersion(partial, column.tool);
      return `${toolLabel[column.tool] ?? column.tool}(Node${column.nodeMajor} ${version})`;
    })
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

    for (const column of toolColumns) {
      const partial = pickPartialForTool(column.nodeMajor, column.tool);
      const result = findResult(partial, column.tool, setting);
      row.push(formatSeconds(result?.p90_ms));
    }

    rows.push(row);
  }

  const lines = [];
  lines.push(`| ${header.join(' | ')} |`);
  lines.push(`| ${header
    .map((_, index) => {
      if (index >= 4) return '---:';
      if (index >= 1 && index <= 3) return ':---:';
      return '---';
    })
    .join(' | ')} |`);
  for (const row of rows) {
    lines.push(`| ${row.join(' | ')} |`);
  }

  return lines.join('\n');
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const readme = fs.readFileSync(readmePath, 'utf8');
const table = buildTable(results);
const startMarker = '<!-- BENCH:START -->';
const endMarker = '<!-- BENCH:END -->';

const startIndex = readme.indexOf(startMarker);
const endIndex = readme.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
  throw new Error('README markers not found or invalid.');
}

const before = readme.slice(0, startIndex + startMarker.length);
const after = readme.slice(endIndex);
const updated = `${before}\n${table}\n${after}`;

fs.writeFileSync(readmePath, updated);
