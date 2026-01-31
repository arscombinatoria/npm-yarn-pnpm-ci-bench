import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixture');
const WORK_DIR = path.join(ROOT, '.bench');
const HOME_DIR = path.join(ROOT, '.home');
const RESULTS_DIR = path.join(ROOT, 'results', 'partial');
const RUNS = Number.parseInt(process.env.BENCH_RUNS ?? '15', 10);
const NODE_MAJOR = process.versions.node.split('.')[0];

const BASE_ENV = {
  ...process.env,
  HOME: HOME_DIR,
  npm_config_fund: 'false',
  npm_config_audit: 'false'
};

const PM_CONFIGS = [
  {
    pm: 'npm',
    pm_mode: 'builtin',
    lockfile: 'package-lock.json',
    commands: [
      { name: 'install', cmd: 'npm install', type: 'install' },
      { name: 'ci', cmd: 'npm ci', type: 'ci' }
    ],
    supportsNodeModules: true,
    supportsArtifacts: false
  },
  {
    pm: 'yarn',
    pm_mode: 'node-modules',
    lockfile: 'yarn.lock',
    commands: [
      { name: 'install', cmd: 'yarn install', type: 'install' },
      { name: 'immutable', cmd: 'yarn install --immutable', type: 'ci' }
    ],
    supportsNodeModules: true,
    supportsArtifacts: false
  },
  {
    pm: 'yarn',
    pm_mode: 'pnp',
    lockfile: 'yarn.lock',
    commands: [
      { name: 'install', cmd: 'yarn install', type: 'install' },
      { name: 'immutable', cmd: 'yarn install --immutable', type: 'ci' }
    ],
    supportsNodeModules: false,
    supportsArtifacts: true
  },
  {
    pm: 'pnpm',
    pm_mode: 'store',
    lockfile: 'pnpm-lock.yaml',
    commands: [
      { name: 'install', cmd: 'pnpm install', type: 'install' },
      { name: 'frozen', cmd: 'pnpm install --frozen-lockfile', type: 'ci' }
    ],
    supportsNodeModules: true,
    supportsArtifacts: false
  }
];

const CACHE_DIRS = {
  npm: path.join(WORK_DIR, 'cache', 'npm'),
  yarn: path.join(WORK_DIR, 'cache', 'yarn'),
  pnpm: path.join(WORK_DIR, 'cache', 'pnpm')
};

const PM_CACHE_ENV = {
  npm: (cacheDir) => ({ npm_config_cache: cacheDir }),
  yarn: (cacheDir) => ({ YARN_CACHE_FOLDER: cacheDir }),
  pnpm: (cacheDir) => ({ PNPM_STORE_PATH: path.join(cacheDir, 'store') })
};

const WARM_MARKERS = new Set();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function removeDir(target) {
  await fs.rm(target, { recursive: true, force: true });
}

async function copyFixture(target) {
  await ensureDir(target);
  await fs.cp(FIXTURE_DIR, target, { recursive: true });
}

async function writeYarnRc(target, mode) {
  const contents = `nodeLinker: ${mode}\n`;
  await fs.writeFile(path.join(target, '.yarnrc.yml'), contents, 'utf8');
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function stats(values) {
  if (values.length === 0) {
    return { p50: null, p90: null, mean: null, min: null, max: null };
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {
    p50: percentile(values, 50),
    p90: percentile(values, 90),
    mean: sum / values.length,
    min,
    max
  };
}

async function runCommand(command, cwd, env) {
  const start = process.hrtime.bigint();
  await new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      env,
      stdio: 'inherit',
      shell: true
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${code}): ${command}`));
    });
  });
  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

async function warmCache(pmConfig, envOverrides) {
  const key = `${pmConfig.pm}:${pmConfig.pm_mode}`;
  if (WARM_MARKERS.has(key)) return;
  WARM_MARKERS.add(key);
  const warmDir = path.join(WORK_DIR, 'warm', key.replace(/[:/]/g, '-'));
  await removeDir(warmDir);
  await copyFixture(warmDir);
  if (pmConfig.pm === 'yarn') {
    await writeYarnRc(warmDir, pmConfig.pm_mode === 'pnp' ? 'pnp' : 'node-modules');
  }
  const env = { ...BASE_ENV, ...envOverrides };
  await runCommand(pmConfig.commands[0].cmd, warmDir, env);
  await removeDir(warmDir);
}

async function ensureLockfile(pmConfig, workspace, env) {
  const lockfilePath = path.join(workspace, pmConfig.lockfile);
  try {
    await fs.access(lockfilePath);
  } catch {
    await runCommand(pmConfig.commands[0].cmd, workspace, env);
  }
}

async function removeLockfile(pmConfig, workspace) {
  await fs.rm(path.join(workspace, pmConfig.lockfile), { force: true });
}

async function ensureNodeModules(workspace, env, pmConfig) {
  await runCommand(pmConfig.commands[0].cmd, workspace, env);
}

async function removeNodeModules(workspace) {
  await removeDir(path.join(workspace, 'node_modules'));
}

async function ensurePnpArtifacts(workspace, env, pmConfig) {
  await runCommand(pmConfig.commands[0].cmd, workspace, env);
}

async function removePnpArtifacts(workspace) {
  await fs.rm(path.join(workspace, '.pnp.cjs'), { force: true });
  await fs.rm(path.join(workspace, '.pnp.data.json'), { force: true });
}

function buildCases(pmConfig) {
  const cases = [];
  for (const command of pmConfig.commands) {
    if (command.type === 'install') {
      const cacheOptions = ['present', 'absent'];
      const lockOptions = ['present', 'absent'];
      if (pmConfig.supportsArtifacts) {
        const artifactsOptions = ['present', 'absent'];
        for (const cache of cacheOptions) {
          for (const lockfile of lockOptions) {
            for (const artifacts of artifactsOptions) {
              cases.push({
                command,
                cache,
                lockfile,
                node_modules: 'na',
                artifacts
              });
            }
          }
        }
      } else {
        const nodeModulesOptions = ['present', 'absent'];
        for (const cache of cacheOptions) {
          for (const lockfile of lockOptions) {
            for (const node_modules of nodeModulesOptions) {
              cases.push({
                command,
                cache,
                lockfile,
                node_modules,
                artifacts: 'na'
              });
            }
          }
        }
      }
    } else {
      const cacheOptions = ['present', 'absent'];
      if (pmConfig.supportsArtifacts) {
        const artifactsOptions = ['present', 'absent'];
        for (const cache of cacheOptions) {
          for (const artifacts of artifactsOptions) {
            cases.push({
              command,
              cache,
              lockfile: 'present',
              node_modules: 'na',
              artifacts
            });
          }
        }
      } else {
        const nodeModulesOptions = ['present', 'absent'];
        for (const cache of cacheOptions) {
          for (const node_modules of nodeModulesOptions) {
            cases.push({
              command,
              cache,
              lockfile: 'present',
              node_modules,
              artifacts: 'na'
            });
          }
        }
      }
    }
  }
  return cases;
}

async function prepareWorkspace(pmConfig, env, caseItem, workspace) {
  await removeDir(workspace);
  await copyFixture(workspace);
  if (pmConfig.pm === 'yarn') {
    await writeYarnRc(workspace, pmConfig.pm_mode === 'pnp' ? 'pnp' : 'node-modules');
  }
  let prepEnv = env;
  let tempCache = null;
  if (caseItem.cache === 'absent') {
    await removeDir(CACHE_DIRS[pmConfig.pm]);
    tempCache = path.join(WORK_DIR, 'cache-temp', pmConfig.pm, pmConfig.pm_mode, Date.now().toString());
    prepEnv = { ...env, ...PM_CACHE_ENV[pmConfig.pm](tempCache) };
  } else {
    await warmCache(pmConfig, env);
  }

  if (caseItem.lockfile === 'present') {
    await ensureLockfile(pmConfig, workspace, prepEnv);
  } else {
    await removeLockfile(pmConfig, workspace);
  }

  if (pmConfig.supportsArtifacts) {
    if (caseItem.artifacts === 'present') {
      await ensurePnpArtifacts(workspace, prepEnv, pmConfig);
    } else {
      await removePnpArtifacts(workspace);
    }
  } else {
    if (caseItem.node_modules === 'present') {
      await ensureNodeModules(workspace, prepEnv, pmConfig);
    } else {
      await removeNodeModules(workspace);
    }
  }

  if (pmConfig.supportsArtifacts && caseItem.artifacts === 'absent') {
    await removeNodeModules(workspace);
  }

  if (caseItem.lockfile === 'absent') {
    await removeLockfile(pmConfig, workspace);
  }

  if (tempCache) {
    await removeDir(tempCache);
  }
}

async function runCase(pmConfig, caseItem) {
  const cacheDir = CACHE_DIRS[pmConfig.pm];
  const envOverrides = {
    ...PM_CACHE_ENV[pmConfig.pm](cacheDir)
  };
  const env = { ...BASE_ENV, ...envOverrides };
  const timings = [];
  let status = 'ok';
  let error = null;

  for (let i = 0; i < RUNS; i += 1) {
    const workspace = path.join(WORK_DIR, 'workspaces', pmConfig.pm, pmConfig.pm_mode, `${caseItem.command.name}-${caseItem.cache}-${caseItem.lockfile}-${caseItem.node_modules}-${caseItem.artifacts}`, `run-${i + 1}`);
    try {
      await prepareWorkspace(pmConfig, env, caseItem, workspace);
      await delay(50);
      const duration = await runCommand(caseItem.command.cmd, workspace, env);
      timings.push(duration);
    } catch (err) {
      status = 'error';
      error = err instanceof Error ? err.message : String(err);
      break;
    }
  }

  const summary = stats(timings);
  return {
    pm: pmConfig.pm,
    pm_mode: pmConfig.pm_mode,
    node: NODE_MAJOR,
    command: caseItem.command.cmd,
    cache: caseItem.cache,
    lockfile: caseItem.lockfile,
    node_modules: caseItem.node_modules,
    artifacts: caseItem.artifacts,
    runs: timings.length,
    p50_ms: summary.p50,
    p90_ms: summary.p90,
    mean_ms: summary.mean,
    min_ms: summary.min,
    max_ms: summary.max,
    status,
    error
  };
}

async function main() {
  await ensureDir(WORK_DIR);
  await ensureDir(HOME_DIR);
  await ensureDir(RESULTS_DIR);

  const results = [];
  for (const pmConfig of PM_CONFIGS) {
    const cases = buildCases(pmConfig);
    for (const caseItem of cases) {
      const result = await runCase(pmConfig, caseItem);
      results.push(result);
    }
  }

  const output = {
    node: NODE_MAJOR,
    runs: RUNS,
    generated_at: new Date().toISOString(),
    results
  };

  await fs.writeFile(path.join(RESULTS_DIR, `${NODE_MAJOR}.json`), JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
