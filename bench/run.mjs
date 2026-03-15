import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const nodeArgIndex = args.indexOf('--node');
const scopeArgIndex = args.indexOf('--scope');
const nodeMajor = nodeArgIndex !== -1 ? Number(args[nodeArgIndex + 1]) : Number(process.versions.node.split('.')[0]);
const scope = scopeArgIndex !== -1 ? args[scopeArgIndex + 1] : 'all';

const RUNS_CACHED = Number(process.env.RUNS_CACHED || 11);
const RUNS_NOCACHE = Number(process.env.RUNS_NOCACHE || 3);
const MIN_RUNS = Number(process.env.MIN_RUNS || 3);
const MAX_RUNS = Number(process.env.MAX_RUNS || 0);
const TARGET_RSE = Number(process.env.TARGET_RSE || 0.05);
const TARGET_IQR_RATIO = Number(process.env.TARGET_IQR_RATIO || 0.1);
const repoRoot = path.resolve(process.cwd());
const resultsDir = path.join(repoRoot, 'results', 'partial');

const cases = [];
for (const cache of [true, false]) {
  for (const lockfile of [true, false]) {
    for (const nodeModules of [true, false]) {
      cases.push({ action: 'install', cache, lockfile, nodeModules });
    }
  }
}
for (const cache of [true, false]) {
  for (const nodeModules of [true, false]) {
    cases.push({ action: 'ci', cache, lockfile: true, nodeModules });
  }
}

const commandMap = {
  npm: {
    install: 'npm install',
    ci: 'npm ci'
  },
  pnpm: {
    install: 'pnpm install',
    ci: 'pnpm install --frozen-lockfile'
  },
  yarn: {
    install: 'YARN_ENABLE_HARDENED_MODE=0 yarn install --no-immutable',
    ci: 'yarn install --immutable'
  },
  'yarn-pnp': {
    install: 'YARN_ENABLE_HARDENED_MODE=0 yarn install --no-immutable',
    ci: 'yarn install --immutable'
  }
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fileExists(targetPath) {
  return fs.existsSync(targetPath);
}

function removePath(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function getCommandVersion(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function quantileLinear(values, q) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) {
    return sorted[0];
  }
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStdDev(values) {
  if (values.length < 2) {
    return 0;
  }
  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function calculateStability(runs) {
  const mean = average(runs);
  const stdDev = sampleStdDev(runs);
  const standardError = runs.length < 2 ? null : stdDev / Math.sqrt(runs.length);
  const rse = !standardError || mean === 0 ? null : standardError / mean;
  const p25 = runs.length < 4 ? null : quantileLinear(runs, 0.25);
  const p75 = runs.length < 4 ? null : quantileLinear(runs, 0.75);
  const iqr = p25 === null || p75 === null ? null : p75 - p25;
  const median = runs.length ? quantileLinear(runs, 0.5) : null;
  const iqrRatio = iqr === null || median === null || median === 0 ? null : iqr / median;
  const meetsRse = rse !== null && rse <= TARGET_RSE;
  const meetsIqr = iqrRatio !== null && iqrRatio <= TARGET_IQR_RATIO;

  return {
    mean_ms: mean,
    stddev_ms: stdDev,
    standard_error_ms: standardError,
    rse,
    iqr_ms: iqr,
    iqr_ratio: iqrRatio,
    target_rse: TARGET_RSE,
    target_iqr_ratio: TARGET_IQR_RATIO,
    passed: meetsRse || meetsIqr,
    criterion: meetsRse ? 'rse' : meetsIqr ? 'iqr_ratio' : null
  };
}

function runCommand(command) {
  const start = process.hrtime.bigint();
  const result = spawnSync(command, { stdio: 'inherit', shell: true });
  const end = process.hrtime.bigint();
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command}`);
  }
  return Number(end - start) / 1e6;
}

function writeYarnConfig(nodeLinker) {
  const contents = `nodeLinker: ${nodeLinker}\n`;
  fs.writeFileSync(path.join(repoRoot, '.yarnrc.yml'), contents);
}

function getCachePaths(tool) {
  if (tool === 'npm') {
    const cacheDir = execSync('npm config get cache', { encoding: 'utf8' }).trim();
    return [cacheDir];
  }
  if (tool === 'pnpm') {
    const storeDir = execSync('pnpm store path', { encoding: 'utf8' }).trim();
    return [storeDir];
  }
  if (tool === 'yarn' || tool === 'yarn-pnp') {
    return [path.join(repoRoot, '.yarn', 'cache')];
  }
  return [];
}

function getLockfilePath(tool) {
  if (tool === 'npm') {
    return path.join(repoRoot, 'package-lock.json');
  }
  if (tool === 'pnpm') {
    return path.join(repoRoot, 'pnpm-lock.yaml');
  }
  if (tool === 'yarn' || tool === 'yarn-pnp') {
    return path.join(repoRoot, 'yarn.lock');
  }
  return null;
}

function getNodeModulesPaths(tool) {
  if (tool === 'yarn-pnp') {
    return [];
  }
  return [path.join(repoRoot, 'node_modules')];
}

function getPnpArtifacts() {
  return [
    path.join(repoRoot, '.pnp.cjs'),
    path.join(repoRoot, '.pnp.loader.mjs'),
    path.join(repoRoot, '.yarn', 'install-state.gz'),
    path.join(repoRoot, '.yarn', 'unplugged'),
    path.join(repoRoot, '.yarn', 'build-state.yml')
  ];
}

function cleanupForSettings(tool, settings) {
  const lockfilePath = getLockfilePath(tool);
  if (!settings.lockfile && lockfilePath) {
    removePath(lockfilePath);
  }

  if (!settings.nodeModules) {
    for (const targetPath of getNodeModulesPaths(tool)) {
      removePath(targetPath);
    }
    if (tool === 'yarn-pnp') {
      for (const targetPath of getPnpArtifacts()) {
        removePath(targetPath);
      }
    }
  }

  if (!settings.cache) {
    for (const cachePath of getCachePaths(tool)) {
      removePath(cachePath);
    }
  }
}

function ensureState(tool, settings) {
  const lockfilePath = getLockfilePath(tool);
  const preCommand = commandMap[tool].install;
  const needsLockfile = settings.lockfile && lockfilePath && !fileExists(lockfilePath);
  const needsNodeModules = settings.nodeModules && getNodeModulesPaths(tool).some((dirPath) => !fileExists(dirPath));
  const needsPnp = tool === 'yarn-pnp' && settings.nodeModules && !fileExists(path.join(repoRoot, '.pnp.cjs'));

  if (needsLockfile || needsNodeModules || needsPnp) {
    const result = spawnSync(preCommand, { stdio: 'inherit', shell: true });
    if (result.status !== 0) {
      throw new Error(`Command failed: ${preCommand}`);
    }
  }

  if (!settings.lockfile && lockfilePath) {
    removePath(lockfilePath);
  }
  if (!settings.cache) {
    for (const cachePath of getCachePaths(tool)) {
      removePath(cachePath);
    }
  }
  if (!settings.nodeModules) {
    for (const targetPath of getNodeModulesPaths(tool)) {
      removePath(targetPath);
    }
    if (tool === 'yarn-pnp') {
      for (const targetPath of getPnpArtifacts()) {
        removePath(targetPath);
      }
    }
  }
}

function runCases(tool) {
  const results = [];
  for (const settings of cases) {
    if (settings.action === 'ci' && !settings.lockfile) {
      continue;
    }
    const runs = [];
    const defaultRunCount = settings.cache ? RUNS_CACHED : RUNS_NOCACHE;
    const maxRuns = MAX_RUNS > 0 ? MAX_RUNS : defaultRunCount;
    const minRuns = Math.min(MIN_RUNS, maxRuns);
    let stability = null;

    for (let i = 0; i < maxRuns; i += 1) {
      cleanupForSettings(tool, settings);
      ensureState(tool, settings);
      cleanupForSettings(tool, settings);
      const durationMs = runCommand(commandMap[tool][settings.action]);
      runs.push(durationMs);
      stability = calculateStability(runs);

      if (runs.length >= minRuns && stability.passed) {
        break;
      }
    }

    results.push({
      tool,
      action: settings.action,
      cache: settings.cache,
      lockfile: settings.lockfile,
      nodeModules: settings.nodeModules,
      runs,
      actual_runs: runs.length,
      stability,
      p90_ms: quantileLinear(runs, 0.9)
    });
  }
  return results;
}

function getVersions(tools) {
  const versions = {
    node: process.version,
    npm: getCommandVersion('npm --version'),
    pnpm: null,
    yarn: null
  };
  if (tools.includes('pnpm')) {
    versions.pnpm = getCommandVersion('pnpm --version');
  }
  if (tools.includes('yarn') || tools.includes('yarn-pnp')) {
    versions.yarn = getCommandVersion('yarn --version');
  }
  return versions;
}

function resolveTools(scopeValue) {
  if (scopeValue === 'npm') {
    return ['npm'];
  }
  return ['npm', 'pnpm', 'yarn', 'yarn-pnp'];
}

function applyYarnLinker(tool) {
  if (tool === 'yarn') {
    writeYarnConfig('node-modules');
  }
  if (tool === 'yarn-pnp') {
    writeYarnConfig('pnp');
  }
}

function main() {
  ensureDir(resultsDir);
  const tools = resolveTools(scope);
  const versions = getVersions(tools);
  const allResults = [];

  for (const tool of tools) {
    applyYarnLinker(tool);
    if (tool === 'yarn-pnp') {
      for (const targetPath of getNodeModulesPaths('yarn-pnp')) {
        removePath(targetPath);
      }
    }
    const toolResults = runCases(tool);
    allResults.push(...toolResults);
  }

  const payload = {
    nodeMajor,
    scope,
    versions,
    generatedAt: new Date().toISOString(),
    results: allResults
  };

  const filename = path.join(resultsDir, `${nodeMajor}-${scope}.json`);
  fs.writeFileSync(filename, `${JSON.stringify(payload, null, 2)}\n`);
}

main();
