import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const resultsPath = path.join(repoRoot, 'results', 'results.json');
const readmePath = path.join(repoRoot, 'README.md');
const summaryPath = path.join(repoRoot, 'results', 'summary.svg');

function formatSeconds(ms) {
  if (!ms || Number.isNaN(ms)) {
    return '-';
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function median(values) {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function buildSummary(results) {
  const npm20 = results.partials['20-npm'];
  const npm22 = results.partials['22-npm'];
  const all24 = results.partials['24-all'];

  const series = [
    { key: 'npm20', label: 'npm Node20', partial: npm20, tool: 'npm' },
    { key: 'npm22', label: 'npm Node22', partial: npm22, tool: 'npm' },
    { key: 'npm24', label: 'npm Node24', partial: all24, tool: 'npm' },
    { key: 'pnpm', label: 'pnpm', partial: all24, tool: 'pnpm' },
    { key: 'yarn', label: 'Yarn', partial: all24, tool: 'yarn' },
    { key: 'yarnpnp', label: 'Yarn PnP', partial: all24, tool: 'yarn-pnp' }
  ];

  const actions = ['install', 'ci'];

  function collectP90(partial, tool, action) {
    if (!partial) {
      return [];
    }
    return partial.results
      .filter((entry) => entry.tool === tool && entry.action === action)
      .map((entry) => entry.p90_ms)
      .filter((value) => typeof value === 'number' && !Number.isNaN(value));
  }

  const data = {};
  for (const action of actions) {
    data[action] = series.map((entry) => {
      const p90Values = collectP90(entry.partial, entry.tool, action);
      const medianMs = median(p90Values);
      return {
        ...entry,
        valueMs: medianMs,
        valueSec: medianMs ? medianMs / 1000 : null
      };
    });
  }

  return { actions, series, data };
}

function buildSummarySvg(summary) {
  const width = 960;
  const height = 300;
  const margin = {
    top: 36,
    right: 24,
    bottom: 56,
    left: 64
  };

  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const palette = [
    '#2563eb',
    '#0ea5e9',
    '#38bdf8',
    '#10b981',
    '#f97316',
    '#a855f7'
  ];

  const allValues = summary.actions.flatMap((action) =>
    summary.data[action].map((entry) => entry.valueSec ?? 0)
  );
  const maxValue = Math.max(0.1, ...allValues);

  const groupWidth = chartWidth / summary.actions.length;
  const groupPadding = 32;
  const barGap = 6;
  const barCount = summary.series.length;
  const available = groupWidth - groupPadding * 2;
  const barWidth =
    (available - barGap * (barCount - 1)) / barCount;

  const rows = [];

  rows.push(
    `<rect width="${width}" height="${height}" fill="white" />`
  );

  const yTicks = 4;
  for (let i = 0; i <= yTicks; i += 1) {
    const value = (maxValue / yTicks) * i;
    const y = margin.top + chartHeight - (value / maxValue) * chartHeight;
    rows.push(
      `<line x1="${margin.left}" x2="${width - margin.right}" y1="${y.toFixed(
        2
      )}" y2="${y.toFixed(2)}" stroke="#e5e7eb" stroke-width="1" />`
    );
    rows.push(
      `<text x="${margin.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6b7280">${value.toFixed(
        1
      )}</text>`
    );
  }

  summary.actions.forEach((action, actionIndex) => {
    const groupX = margin.left + actionIndex * groupWidth + groupPadding;
    const groupCenter =
      margin.left + actionIndex * groupWidth + groupWidth / 2;
    rows.push(
      `<text x="${groupCenter}" y="${height - margin.bottom + 28}" text-anchor="middle" font-size="12" fill="#111827">${action}</text>`
    );

    summary.data[action].forEach((entry, seriesIndex) => {
      const value = entry.valueSec ?? 0;
      const barHeight = (value / maxValue) * chartHeight;
      const x =
        groupX + seriesIndex * (barWidth + barGap);
      const y = margin.top + chartHeight - barHeight;
      const color = palette[seriesIndex % palette.length];
      rows.push(
        `<rect x="${x.toFixed(2)}" y="${y.toFixed(
          2
        )}" width="${barWidth.toFixed(
          2
        )}" height="${barHeight.toFixed(
          2
        )}" rx="2" fill="${color}" />`
      );
      const label = entry.valueSec
        ? `${entry.valueSec.toFixed(1)}s`
        : '-';
      rows.push(
        `<text x="${(x + barWidth / 2).toFixed(
          2
        )}" y="${(y - 6).toFixed(
          2
        )}" text-anchor="middle" font-size="11" fill="#111827">${label}</text>`
      );
    });
  });

  const legendX = margin.left;
  const legendY = 12;
  const legendItemGap = 18;
  summary.series.forEach((entry, index) => {
    const x = legendX + index * 150;
    const color = palette[index % palette.length];
    rows.push(
      `<rect x="${x}" y="${legendY}" width="12" height="12" fill="${color}" rx="2" />`
    );
    rows.push(
      `<text x="${x + 18}" y="${legendY + 11}" font-size="11" fill="#111827">${entry.label}</text>`
    );
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    ...rows,
    `</svg>`
  ].join('\n');
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
const summary = buildSummary(results);
const summarySvg = buildSummarySvg(summary);
const startMarker = '<!-- BENCH:START -->';
const endMarker = '<!-- BENCH:END -->';

const startIndex = readme.indexOf(startMarker);
const endIndex = readme.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
  throw new Error('README markers not found or invalid.');
}

const before = readme.slice(0, startIndex + startMarker.length);
const after = readme.slice(endIndex);
const updated = `${before}\n![Benchmark summary](./results/summary.svg)\n\n${table}\n${after}`;

fs.writeFileSync(readmePath, updated);
fs.writeFileSync(summaryPath, summarySvg);
