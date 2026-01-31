import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const nodeMajor = Number(process.env.BENCH_NODE ?? process.versions.node.split('.')[0]);
const scope = process.env.BENCH_SCOPE ?? 'npm';
const runsCached = Number(process.env.RUNS_CACHED ?? 11);
const runsNoCache = Number(process.env.RUNS_NOCACHE ?? 3);

const cacheRoot = path.join(rootDir, '.bench', 'cache');
const homeDir = path.join(rootDir, '.home');

const managers = scope === 'all'
  ? ['npm', 'pnpm', 'yarn', 'yarn_pnp']
  : ['npm'];

await fs.mkdir(cacheRoot, { recursive: true });
await fs.mkdir(homeDir, { recursive: true });
await fs.mkdir(path.join(rootDir, 'results', 'partial'), { recursive: true });

const versionInfo = await getVersions(managers);

const results = [];

for (const manager of managers) {
  const cases = buildCases();
  for (const benchCase of cases) {
    const runs = benchCase.cache ? runsCached : runsNoCache;
    const times = [];
    for (let i = 0; i < runs; i += 1) {
      await prepareEnvironment(manager, benchCase);
      const durationMs = await timeCommand(getCommand(manager, benchCase.action), buildEnv(manager));
      times.push(durationMs);
    }
    results.push({
      manager,
      nodeMajor,
      action: benchCase.action,
      cache: benchCase.cache,
      lockfile: benchCase.lockfile,
      nodeModules: benchCase.nodeModules,
      runs,
      p90Ms: quantile(times, 0.9),
      samplesMs: times
    });
  }
}

const payload = {
  nodeMajor,
  scope,
  versions: versionInfo,
  results
};

const outPath = path.join(rootDir, 'results', 'partial', `${nodeMajor}-${scope}.json`);
await fs.writeFile(outPath, JSON.stringify(payload, null, 2));

async function getVersions(activeManagers) {
  const versions = {
    node: process.version,
    npm: await execVersion('npm'),
    pnpm: null,
    yarn: null
  };

  if (activeManagers.includes('pnpm')) {
    versions.pnpm = await execVersion('pnpm');
  }
  if (activeManagers.includes('yarn') || activeManagers.includes('yarn_pnp')) {
    versions.yarn = await execVersion('yarn');
  }
  return versions;
}

async function execVersion(bin) {
  const output = await captureCommand(`${bin} --version`, buildEnv(bin));
  return output.trim();
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

function getCommand(manager, action) {
  if (manager === 'npm') {
    return action === 'install' ? 'npm install' : 'npm ci';
  }
  if (manager === 'pnpm') {
    return action === 'install' ? 'pnpm install' : 'pnpm install --frozen-lockfile';
  }
  if (manager === 'yarn' || manager === 'yarn_pnp') {
    return action === 'install' ? 'yarn install' : 'yarn install --immutable';
  }
  throw new Error(`Unknown manager: ${manager}`);
}

function getLockfile(manager) {
  if (manager === 'npm') {
    return 'package-lock.json';
  }
  if (manager === 'pnpm') {
    return 'pnpm-lock.yaml';
  }
  if (manager === 'yarn' || manager === 'yarn_pnp') {
    return 'yarn.lock';
  }
  return null;
}

function buildEnv(manager) {
  const env = {
    ...process.env,
    HOME: homeDir
  };

  if (manager === 'npm') {
    env.npm_config_cache = path.join(cacheRoot, 'npm');
  }
  if (manager === 'pnpm') {
    env.PNPM_STORE_PATH = path.join(cacheRoot, 'pnpm');
  }
  if (manager === 'yarn' || manager === 'yarn_pnp') {
    env.YARN_CACHE_FOLDER = path.join(cacheRoot, 'yarn');
  }
  return env;
}

async function prepareEnvironment(manager, benchCase) {
  if (manager === 'yarn') {
    await writeYarnRc('node-modules');
  }
  if (manager === 'yarn_pnp') {
    await writeYarnRc('pnp');
  }

  if (!benchCase.cache) {
    await removePath(getCacheDir(manager));
  }

  if (!benchCase.lockfile) {
    await removePath(getLockfile(manager));
  }

  if (!benchCase.nodeModules) {
    await removeNodeModules(manager);
  }

  if (benchCase.cache) {
    const hasCache = await hasCacheDir(manager);
    if (!hasCache) {
      await warmInstall(manager);
      if (!benchCase.lockfile) {
        await removePath(getLockfile(manager));
      }
      if (!benchCase.nodeModules) {
        await removeNodeModules(manager);
      }
    }
  }

  if (benchCase.lockfile) {
    const lockfilePath = getLockfile(manager);
    if (lockfilePath) {
      const exists = await pathExists(lockfilePath);
      if (!exists) {
        await warmInstall(manager);
        if (!benchCase.nodeModules) {
          await removeNodeModules(manager);
        }
      }
    }
  }

  if (benchCase.nodeModules) {
    const hasModules = await hasNodeModules(manager);
    if (!hasModules) {
      await warmInstall(manager);
      if (!benchCase.lockfile) {
        await removePath(getLockfile(manager));
      }
    }
  }

  if (benchCase.cache) {
    await fs.mkdir(getCacheDir(manager), { recursive: true });
  }
}

async function warmInstall(manager) {
  await timeCommand(getCommand(manager, 'install'), buildEnv(manager));
}

async function writeYarnRc(nodeLinker) {
  const contents = `nodeLinker: ${nodeLinker}\n`;
  await fs.writeFile(path.join(rootDir, '.yarnrc.yml'), contents);
}

async function hasNodeModules(manager) {
  if (manager === 'yarn_pnp') {
    return pathExists('.pnp.cjs');
  }
  return pathExists('node_modules');
}

async function removeNodeModules(manager) {
  if (manager === 'yarn_pnp') {
    await Promise.all([
      removePath('.pnp.cjs'),
      removePath('.pnp.loader.mjs'),
      removePath(path.join('.yarn', 'install-state.gz')),
      removePath(path.join('.yarn', 'unplugged'))
    ]);
    return;
  }
  await removePath('node_modules');
}

function getCacheDir(manager) {
  if (manager === 'npm') {
    return path.join(cacheRoot, 'npm');
  }
  if (manager === 'pnpm') {
    return path.join(cacheRoot, 'pnpm');
  }
  if (manager === 'yarn' || manager === 'yarn_pnp') {
    return path.join(cacheRoot, 'yarn');
  }
  return cacheRoot;
}

async function hasCacheDir(manager) {
  const cacheDir = getCacheDir(manager);
  try {
    const entries = await fs.readdir(cacheDir);
    return entries.length > 0;
  } catch {
    return false;
  }
}

async function removePath(target) {
  if (!target) {
    return;
  }
  await fs.rm(path.join(rootDir, target), { recursive: true, force: true });
}

async function pathExists(target) {
  try {
    await fs.access(path.join(rootDir, target));
    return true;
  } catch {
    return false;
  }
}

function timeCommand(command, env) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const child = spawn(command, { shell: true, stdio: 'inherit', env });
    child.on('error', reject);
    child.on('exit', (code) => {
      const end = process.hrtime.bigint();
      if (code !== 0) {
        reject(new Error(`Command failed (${code}): ${command}`));
        return;
      }
      const durationMs = Number(end - start) / 1e6;
      resolve(durationMs);
    });
  });
}

function captureCommand(command, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, stdio: ['ignore', 'pipe', 'inherit'], env });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed (${code}): ${command}`));
        return;
      }
      resolve(output);
    });
  });
}

function quantile(samples, q) {
  const sorted = [...samples].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return 0;
  }
  if (sorted.length === 1) {
    return sorted[0];
  }
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = pos - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
