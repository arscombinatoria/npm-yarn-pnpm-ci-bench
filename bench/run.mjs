import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FIXTURE_DIR = path.join(ROOT, "bench", "fixture");
const BENCH_DIR = path.join(ROOT, ".bench");
const WORK_DIR = path.join(BENCH_DIR, "workdir");
const CACHE_DIR = path.join(BENCH_DIR, "cache");
const COREPACK_HOME = path.join(BENCH_DIR, "corepack");
const HOME_DIR = path.join(ROOT, ".home");
const RESULTS_DIR = path.join(ROOT, "results", "partial");
const RUNS = Number.parseInt(process.env.BENCH_RUNS ?? "15", 10);
const NODE_MAJOR = Number.parseInt(process.versions.node.split(".")[0], 10);

const PM_MODES = {
  npm: "default",
  pnpm: "default",
  yarnNodeModules: "node-modules",
  yarnPnp: "pnp"
};

const npmLockfile = "package-lock.json";
const yarnLockfile = "yarn.lock";
const pnpmLockfile = "pnpm-lock.yaml";

await fs.mkdir(BENCH_DIR, { recursive: true });
await fs.mkdir(CACHE_DIR, { recursive: true });
await fs.mkdir(WORK_DIR, { recursive: true });
await fs.mkdir(COREPACK_HOME, { recursive: true });
await fs.mkdir(HOME_DIR, { recursive: true });
await fs.mkdir(RESULTS_DIR, { recursive: true });

const baseEnv = {
  ...process.env,
  HOME: HOME_DIR,
  COREPACK_HOME
};

const cachePaths = {
  npm: path.join(CACHE_DIR, "npm"),
  yarn: path.join(CACHE_DIR, "yarn"),
  pnpm: path.join(CACHE_DIR, "pnpm")
};

function envFor(pm) {
  if (pm === "npm") {
    return {
      ...baseEnv,
      npm_config_cache: cachePaths.npm,
      npm_config_fund: "false",
      npm_config_audit: "false",
      npm_config_update_notifier: "false"
    };
  }
  if (pm === "yarn") {
    return {
      ...baseEnv,
      YARN_CACHE_FOLDER: cachePaths.yarn
    };
  }
  if (pm === "pnpm") {
    return {
      ...baseEnv,
      PNPM_STORE_PATH: cachePaths.pnpm
    };
  }
  return { ...baseEnv };
}

async function execCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: "ignore"
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}

async function runTimed(command, args, options = {}) {
  const start = process.hrtime.bigint();
  await execCommand(command, args, options);
  const end = process.hrtime.bigint();
  return Number(end - start) / 1e6;
}

async function rmIfExists(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function ensureYarnConfig(workdir, nodeLinker) {
  const config = [
    `nodeLinker: ${nodeLinker}`,
    `enableGlobalCache: false`,
    `cacheFolder: ${cachePaths.yarn}`,
    `installStatePath: .yarn/install-state.gz`
  ].join("\n");
  await fs.writeFile(path.join(workdir, ".yarnrc.yml"), `${config}\n`, "utf8");
}

async function ensureCachePrimed(pm, config) {
  const cacheDir = cachePaths[pm];
  const entries = await fs.readdir(cacheDir).catch(() => []);
  if (entries.length > 0) {
    return;
  }
  const warmupDir = path.join(BENCH_DIR, "cache-warmup", pm);
  await rmIfExists(warmupDir);
  await copyDir(FIXTURE_DIR, warmupDir);
  if (pm === "yarn") {
    await ensureYarnConfig(warmupDir, config.nodeLinker);
  }
  const env = envFor(pm === "yarn" ? "yarn" : pm);
  if (pm === "npm") {
    await execCommand("npm", ["install"], { cwd: warmupDir, env });
  } else if (pm === "pnpm") {
    await execCommand("pnpm", ["install"], { cwd: warmupDir, env });
  } else if (pm === "yarn") {
    await execCommand("yarn", ["install"], { cwd: warmupDir, env });
  }
  await rmIfExists(warmupDir);
}

async function generateLockfile(pm, config, workdir) {
  const env = envFor(pm === "yarn" ? "yarn" : pm);
  if (pm === "npm") {
    await execCommand("npm", ["install", "--package-lock-only", "--ignore-scripts"], {
      cwd: workdir,
      env
    });
    return;
  }
  if (pm === "pnpm") {
    await execCommand("pnpm", ["install", "--lockfile-only"], { cwd: workdir, env });
    return;
  }
  if (pm === "yarn") {
    await ensureYarnConfig(workdir, config.nodeLinker);
    await execCommand("yarn", ["install", "--mode=skip-build"], { cwd: workdir, env });
  }
}

async function prepareWorkspace(config) {
  await rmIfExists(config.workdir);
  await copyDir(FIXTURE_DIR, config.workdir);
  if (config.pm === "yarn") {
    await ensureYarnConfig(config.workdir, config.nodeLinker);
  }

  if (config.cache === "present") {
    await fs.mkdir(cachePaths[config.pm], { recursive: true });
    await ensureCachePrimed(config.pm, config);
  }

  if (config.nodeModulesState === "present" || config.artifactsState === "present") {
    const env = envFor(config.pm === "yarn" ? "yarn" : config.pm);
    if (config.pm === "npm") {
      await execCommand("npm", ["install"], { cwd: config.workdir, env });
    } else if (config.pm === "pnpm") {
      await execCommand("pnpm", ["install"], { cwd: config.workdir, env });
    } else if (config.pm === "yarn") {
      await execCommand("yarn", ["install"], { cwd: config.workdir, env });
    }
  }

  if (config.lockfile === "present") {
    const lockfilePath = path.join(config.workdir, config.lockfileName);
    const exists = await fs
      .access(lockfilePath)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      await generateLockfile(config.pm, config, config.workdir);
    }
  }

  if (config.lockfile === "absent") {
    await rmIfExists(path.join(config.workdir, npmLockfile));
    await rmIfExists(path.join(config.workdir, yarnLockfile));
    await rmIfExists(path.join(config.workdir, pnpmLockfile));
  }

  if (config.nodeModulesState === "absent") {
    await rmIfExists(path.join(config.workdir, "node_modules"));
  }

  if (config.artifactsState === "absent") {
    await rmIfExists(path.join(config.workdir, ".pnp.cjs"));
    await rmIfExists(path.join(config.workdir, ".pnp.data.json"));
    await rmIfExists(path.join(config.workdir, ".pnp.loader.mjs"));
    await rmIfExists(path.join(config.workdir, ".yarn", "install-state.gz"));
    await rmIfExists(path.join(config.workdir, ".yarn", "unplugged"));
  }

  if (config.cache === "absent") {
    await rmIfExists(cachePaths[config.pm]);
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const index = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function summarize(values) {
  if (values.length === 0) {
    return {
      p50: null,
      p90: null,
      mean: null,
      min: null,
      max: null
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, value) => acc + value, 0);
  return {
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    mean: sum / values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1]
  };
}

function buildCases() {
  const cases = [];
  const cacheStates = ["absent", "present"];
  const lockfileStates = ["absent", "present"];
  const nodeModulesStates = ["absent", "present"];
  const artifactsStates = ["absent", "present"];

  for (const cache of cacheStates) {
    for (const lockfile of lockfileStates) {
      for (const nodeModulesState of nodeModulesStates) {
        cases.push({
          pm: "npm",
          pm_mode: PM_MODES.npm,
          command: "npm install",
          cache,
          lockfile,
          node_modules: nodeModulesState,
          artifacts: "na",
          kind: "install",
          lockfileName: npmLockfile,
          nodeLinker: "node-modules"
        });
        cases.push({
          pm: "pnpm",
          pm_mode: PM_MODES.pnpm,
          command: "pnpm install",
          cache,
          lockfile,
          node_modules: nodeModulesState,
          artifacts: "na",
          kind: "install",
          lockfileName: pnpmLockfile,
          nodeLinker: "node-modules"
        });
        cases.push({
          pm: "yarn",
          pm_mode: PM_MODES.yarnNodeModules,
          command: "yarn install",
          cache,
          lockfile,
          node_modules: nodeModulesState,
          artifacts: "na",
          kind: "install",
          lockfileName: yarnLockfile,
          nodeLinker: "node-modules"
        });
      }
      for (const artifactsState of artifactsStates) {
        cases.push({
          pm: "yarn",
          pm_mode: PM_MODES.yarnPnp,
          command: "yarn install",
          cache,
          lockfile,
          node_modules: "na",
          artifacts: artifactsState,
          kind: "install",
          lockfileName: yarnLockfile,
          nodeLinker: "pnp"
        });
      }
    }
  }

  for (const cache of cacheStates) {
    for (const nodeModulesState of nodeModulesStates) {
      cases.push({
        pm: "npm",
        pm_mode: PM_MODES.npm,
        command: "npm ci",
        cache,
        lockfile: "present",
        node_modules: nodeModulesState,
        artifacts: "na",
        kind: "ci",
        lockfileName: npmLockfile,
        nodeLinker: "node-modules"
      });
      cases.push({
        pm: "pnpm",
        pm_mode: PM_MODES.pnpm,
        command: "pnpm install --frozen-lockfile",
        cache,
        lockfile: "present",
        node_modules: nodeModulesState,
        artifacts: "na",
        kind: "ci",
        lockfileName: pnpmLockfile,
        nodeLinker: "node-modules"
      });
      cases.push({
        pm: "yarn",
        pm_mode: PM_MODES.yarnNodeModules,
        command: "yarn install --immutable",
        cache,
        lockfile: "present",
        node_modules: nodeModulesState,
        artifacts: "na",
        kind: "ci",
        lockfileName: yarnLockfile,
        nodeLinker: "node-modules"
      });
    }
    for (const artifactsState of artifactsStates) {
      cases.push({
        pm: "yarn",
        pm_mode: PM_MODES.yarnPnp,
        command: "yarn install --immutable",
        cache,
        lockfile: "present",
        node_modules: "na",
        artifacts: artifactsState,
        kind: "ci",
        lockfileName: yarnLockfile,
        nodeLinker: "pnp"
      });
    }
  }

  return cases;
}

async function main() {
  await execCommand("corepack", ["enable"], { env: baseEnv });
  await execCommand("corepack", ["prepare", "yarn@stable", "--activate"], { env: baseEnv });
  await execCommand("corepack", ["prepare", "pnpm@latest", "--activate"], { env: baseEnv });

  const cases = buildCases();
  const results = [];

  for (const [index, config] of cases.entries()) {
    const workdir = path.join(WORK_DIR, `${config.pm}-${config.kind}-${index}`);
    const timings = [];
    let status = "ok";
    let errorMessage = "";
    for (let run = 0; run < RUNS; run += 1) {
      try {
        await prepareWorkspace({
          ...config,
          workdir,
          nodeModulesState: config.node_modules,
          artifactsState: config.artifacts
        });
        const env = envFor(config.pm === "yarn" ? "yarn" : config.pm);
        const [command, ...args] = config.command.split(" ");
        const duration = await runTimed(command, args, { cwd: workdir, env });
        timings.push(duration);
      } catch (error) {
        status = "error";
        errorMessage = error instanceof Error ? error.message : String(error);
        break;
      }
    }

    const summary = summarize(timings);
    results.push({
      pm: config.pm,
      pm_mode: config.pm_mode,
      node: NODE_MAJOR,
      command: config.command,
      cache: config.cache,
      lockfile: config.lockfile,
      node_modules: config.node_modules,
      artifacts: config.artifacts,
      runs: timings.length,
      p50_ms: summary.p50,
      p90_ms: summary.p90,
      mean_ms: summary.mean,
      min_ms: summary.min,
      max_ms: summary.max,
      status,
      error: errorMessage || undefined
    });
  }

  const output = {
    node: NODE_MAJOR,
    runs: RUNS,
    generated_at: new Date().toISOString(),
    results
  };

  const outputPath = path.join(RESULTS_DIR, `${NODE_MAJOR}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outputPath}`);
}

await main();
