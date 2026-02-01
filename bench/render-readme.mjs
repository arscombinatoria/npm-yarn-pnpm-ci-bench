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

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return null;
  }
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function buildSummarySvg(results) {
  const actions = ['install', 'ci'];
  const series = [
    { key: 'npm20', label: 'npm Node20', partial: results.partials['20-npm'], tool: 'npm' },
    { key: 'npm22', label: 'npm Node22', partial: results.partials['22-npm'], tool: 'npm' },
    { key: 'npm24', label: 'npm Node24', partial: results.partials['24-all'], tool: 'npm' },
    { key: 'pnpm', label: 'pnpm', partial: results.partials['24-all'], tool: 'pnpm' },
    { key: 'yarn', label: 'Yarn', partial: results.partials['24-all'], tool: 'yarn' },
    { key: 'yarnPnp', label: 'Yarn PnP', partial: results.partials['24-all'], tool: 'yarn-pnp' }
  ];
  const colors = ['#4C78A8', '#F58518', '#E45756', '#72B7B2', '#54A24B', '#B279A2'];

  const valuesByAction = actions.map((action) =>
    series.map((item) => {
      if (!item.partial) {
        return null;
      }
      const entries = item.partial.results.filter(
        (entry) => entry.tool === item.tool && entry.action === action
      );
      const p90Values = entries.map((entry) => entry.p90_ms);
      return median(p90Values);
    })
  );

  const flatValues = valuesByAction.flat().filter((value) => Number.isFinite(value));
  const maxValue = flatValues.length ? Math.max(...flatValues) : 1;

  const width = 960;
  const height = 300;
  const margin = { top: 40, right: 30, bottom: 70, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const groupWidth = chartWidth / actions.length;
  const groupPadding = 16;
  const barGap = 6;
  const barWidth =
    (groupWidth - groupPadding * 2 - barGap * (series.length - 1)) / series.length;

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, index) => (maxValue / yTicks) * index);

  const svgParts = [];
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Benchmark p90 summary">`
  );
  svgParts.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);

  // Grid lines and Y axis labels
  tickValues.forEach((tick) => {
    const y = margin.top + chartHeight - (tick / maxValue) * chartHeight;
    svgParts.push(
      `<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${width - margin.right}" y2="${y.toFixed(
        1
      )}" stroke="#e5e7eb" stroke-width="1"/>`
    );
    svgParts.push(
      `<text x="${margin.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#4b5563">${(
        tick / 1000
      ).toFixed(1)}s</text>`
    );
  });

  // Bars
  actions.forEach((action, actionIndex) => {
    const groupStart = margin.left + actionIndex * groupWidth + groupPadding;
    const centerX = margin.left + actionIndex * groupWidth + groupWidth / 2;
    svgParts.push(
      `<text x="${centerX}" y="${height - margin.bottom + 40}" text-anchor="middle" font-size="12" fill="#111827">${action}</text>`
    );
    series.forEach((item, seriesIndex) => {
      const value = valuesByAction[actionIndex][seriesIndex];
      const barHeight = value ? (value / maxValue) * chartHeight : 0;
      const x = groupStart + seriesIndex * (barWidth + barGap);
      const y = margin.top + chartHeight - barHeight;
      svgParts.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(
          1
        )}" height="${barHeight.toFixed(1)}" fill="${colors[seriesIndex]}" rx="2" ry="2"/>`
      );
      const label = value ? `${(value / 1000).toFixed(1)}s` : '-';
      const labelY = Math.max(y - 6, margin.top + 12);
      svgParts.push(
        `<text x="${(x + barWidth / 2).toFixed(
          1
        )}" y="${labelY.toFixed(1)}" text-anchor="middle" font-size="11" fill="#111827">${label}</text>`
      );
    });
  });

  // Axis
  svgParts.push(
    `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}" stroke="#111827" stroke-width="1"/>`
  );
  svgParts.push(
    `<line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${
      margin.top + chartHeight
    }" stroke="#111827" stroke-width="1"/>`
  );

  // Legend
  const legendStartX = margin.left;
  const legendStartY = 16;
  const legendGap = 140;
  series.forEach((item, index) => {
    const x = legendStartX + index * legendGap;
    svgParts.push(
      `<rect x="${x}" y="${legendStartY}" width="12" height="12" fill="${colors[index]}" rx="2" ry="2"/>`
    );
    svgParts.push(
      `<text x="${x + 18}" y="${legendStartY + 11}" font-size="12" fill="#111827">${item.label}</text>`
    );
  });

  svgParts.push(
    `<text x="${margin.left}" y="${height - 12}" font-size="11" fill="#6b7280">P90 median by action (seconds)</text>`
  );
  svgParts.push('</svg>');

  return svgParts.join('\n');
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
const summarySvg = buildSummarySvg(results);
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
fs.writeFileSync(path.join(repoRoot, 'results', 'summary.svg'), summarySvg);
