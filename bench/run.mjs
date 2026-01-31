import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const argMap = new Map();
for (let i = 0; i < args.length; i += 2) {
  argMap.set(args[i], args[i + 1]);
}

const nodeMajor = Number(argMap.get('--node')) || Number(process.versions.node.split('.')[0]);
const scope = argMap.get('--scope') || 'all';

const runsCached = Number(process.env.RUNS_CACHED || 11);
const runsNoCache = Number(process.env.RUNS_NOCACHE || 3);

const benchDir = path.join(repoRoot, '.bench');
const cacheDir = path.join(benchDir, 'cache');
const homeDir = path.join(repoRoot, '.home');

const npmCache = path.join(cacheDir, 'npm');
const pnpmStore = path.join(cacheDir, 'pnpm');
const yarnCache = path.join(cacheDir, 'yarn');

const lockfiles = {
  npm: 'package-lock.json',
  pnpm: 'pnpm-lock.yaml',
  yarn: 'yarn.lock',
};

const yarnArtifacts = [
  '.pnp.cjs',
  '.pnp.loader.mjs',
  path.join('.yarn', 'install-state.gz'),
  path.join('.yarn', 'unplugged'),
];

const cases = {
  install: buildInstallCases(),
  ci: buildCiCases(),
};

await fs.mkdir(cacheDir, { recursive: true });
await fs.mkdir(homeDir, { recursive: true });

const versions = {
  node: process.version,
  npm: scope === 'npm' || scope === 'all' ? await getVersion('npm') : null,
  pnpm: scope === 'all' && nodeMajor === 24 ? await getVersion('pnpm') : null,
  yarn: scope === 'all' && nodeMajor === 24 ? await getVersion('yarn') : null,
};

const results = {
  npm: scope === 'npm' || scope === 'all' ? await runManager('npm') : null,
  pnpm: scope === 'all' && nodeMajor === 24 ? await runManager('pnpm') : null,
  yarn: scope === 'all' && nodeMajor === 24 ? await runYarn() : null,
};

const output = {
  nodeMajor,
  scope,
  versions,
  results,
};

const partialDir = path.join(repoRoot, 'results', 'partial');
await fs.mkdir(partialDir, { recursive: true });
const outputPath = path.join(partialDir, `${nodeMajor}-${scope}.json`);
await fs.writeFile(outputPath, JSON.stringify(output, null, 2));

async function runManager(manager) {
  const managerResults = {};
  for (const action of ['install', 'ci']) {
    const actionResults = {};
    const actionCases = cases[action];
    for (const caseItem of actionCases) {
      const key = caseKey(action, caseItem);
      const measurements = await measureCase({ manager, action, ...caseItem });
      actionResults[key] = measurements;
    }
    managerResults[action] = actionResults;
  }
  return managerResults;
}

async function runYarn() {
  const modes = ['node-modules', 'pnp'];
  const resultsByMode = {};
  for (const mode of modes) {
    resultsByMode[mode] = await runYarnMode(mode);
  }
  return resultsByMode;
}

async function runYarnMode(nodeLinker) {
  await setYarnNodeLinker(nodeLinker);
  const modeResults = {};
  for (const action of ['install', 'ci']) {
    const actionResults = {};
    const actionCases = cases[action];
    for (const caseItem of actionCases) {
      const key = caseKey(action, caseItem);
      const measurements = await measureCase({ manager: 'yarn', action, nodeLinker, ...caseItem });
      actionResults[key] = measurements;
    }
    modeResults[action] = actionResults;
  }
  return modeResults;
}

async function measureCase({ manager, action, cache, lockfile, nodeModules, nodeLinker }) {
  const runs = cache ? runsCached : runsNoCache;
  const timings = [];

  if (manager === 'yarn' && nodeLinker) {
    await setYarnNodeLinker(nodeLinker);
  }

  if (lockfile) {
    await ensureLockfile(manager, nodeLinker);
  }

  if (nodeModules) {
    await ensureNodeModules(manager, action, nodeLinker, cache);
  }

  for (let i = 0; i < runs; i += 1) {
    await prepareState({ manager, cache, lockfile, nodeModules, nodeLinker });
    const durationMs = await timeCommand(commandFor(manager, action), envFor(manager));
    timings.push(durationMs);
  }

  const p90 = quantile(timings, 0.9);
  return {
    runs,
    timings,
    p90,
  };
}

async function ensureNodeModules(manager, action, nodeLinker, cache) {
  const exists = await hasNodeModules(manager, nodeLinker);
  if (exists) return;

  await prepareState({
    manager,
    cache,
    lockfile: true,
    nodeModules: false,
    nodeLinker,
  });
  await timeCommand(commandFor(manager, action), envFor(manager), false);
}

async function ensureLockfile(manager, nodeLinker) {
  const lockfile = lockfiles[manager];
  const lockPath = path.join(repoRoot, lockfile);
  if (await exists(lockPath)) return;

  if (manager === 'npm') {
    await timeCommand('npm install --package-lock-only', envFor(manager), false);
    return;
  }
  if (manager === 'pnpm') {
    await timeCommand('pnpm install --lockfile-only', envFor(manager), false);
    return;
  }

  if (manager === 'yarn') {
    await setYarnNodeLinker(nodeLinker || 'node-modules');
    await timeCommand('yarn install --mode=skip-build', envFor(manager), false);
  }
}

async function prepareState({ manager, cache, lockfile, nodeModules, nodeLinker }) {
  if (!cache) {
    await removePath(cacheDirFor(manager));
  } else {
    await fs.mkdir(cacheDirFor(manager), { recursive: true });
  }

  if (!lockfile) {
    await removePath(path.join(repoRoot, lockfiles[manager]));
  }

  if (!nodeModules) {
    await removeNodeModules(manager, nodeLinker);
  }
}

async function removeNodeModules(manager, nodeLinker) {
  if (manager === 'yarn' && nodeLinker === 'pnp') {
    for (const artifact of yarnArtifacts) {
      await removePath(path.join(repoRoot, artifact));
    }
    return;
  }
  await removePath(path.join(repoRoot, 'node_modules'));
}

async function hasNodeModules(manager, nodeLinker) {
  if (manager === 'yarn' && nodeLinker === 'pnp') {
    const pnpFile = path.join(repoRoot, '.pnp.cjs');
    return exists(pnpFile);
  }
  return exists(path.join(repoRoot, 'node_modules'));
}

async function setYarnNodeLinker(nodeLinker) {
  const content = `nodeLinker: ${nodeLinker}\n`;
  await fs.writeFile(path.join(repoRoot, '.yarnrc.yml'), content);
}

function cacheDirFor(manager) {
  if (manager === 'npm') return npmCache;
  if (manager === 'pnpm') return pnpmStore;
  return yarnCache;
}

function envFor(manager) {
  return {
    ...process.env,
    HOME: homeDir,
    npm_config_cache: npmCache,
    PNPM_STORE_DIR: pnpmStore,
    YARN_CACHE_FOLDER: yarnCache,
  };
}

function commandFor(manager, action) {
  if (manager === 'npm') {
    return action === 'ci' ? 'npm ci' : 'npm install';
  }
  if (manager === 'pnpm') {
    return action === 'ci' ? 'pnpm install --frozen-lockfile' : 'pnpm install';
  }
  return action === 'ci' ? 'yarn install --immutable' : 'yarn install';
}

async function timeCommand(command, env, shouldMeasure = true) {
  const start = shouldMeasure ? process.hrtime.bigint() : null;
  await runCommand(command, env);
  if (!shouldMeasure || !start) return 0;
  const end = process.hrtime.bigint();
  return Number(end - start) / 1e6;
}

function runCommand(command, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: repoRoot,
      env,
      stdio: 'inherit',
      shell: true,
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${code}): ${command}`));
    });
  });
}

function buildInstallCases() {
  const cases = [];
  for (const cache of [false, true]) {
    for (const lockfile of [false, true]) {
      for (const nodeModules of [false, true]) {
        cases.push({ cache, lockfile, nodeModules });
      }
    }
  }
  return cases;
}

function buildCiCases() {
  const cases = [];
  for (const cache of [false, true]) {
    for (const nodeModules of [false, true]) {
      cases.push({ cache, lockfile: true, nodeModules });
    }
  }
  return cases;
}

function caseKey(action, { cache, lockfile, nodeModules }) {
  return [action, cache ? '1' : '0', lockfile ? '1' : '0', nodeModules ? '1' : '0'].join(':');
}

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  const weight = pos - lower;
  if (upper >= sorted.length) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

async function removePath(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getVersion(command) {
  try {
    const output = await captureCommand(`${command} --version`);
    return output.trim();
  } catch {
    return null;
  }
}

function captureCommand(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: repoRoot,
      env: envFor('npm'),
      shell: true,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    child.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`Version command failed (${code}): ${command}`));
    });
  });
}
