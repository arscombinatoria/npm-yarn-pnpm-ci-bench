import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const partialDir = path.join(repoRoot, 'results', 'partial');
const outputPath = path.join(repoRoot, 'results', 'results.json');

const partialFiles = await readJsonFiles(partialDir);
const partials = partialFiles.map((file) => file.data);

const npmVersions = {};
let pnpmVersion = null;
let yarnVersion = null;

const npmResults = {};
const pnpmResults = {};
const yarnResults = { 'node-modules': {}, pnp: {} };

for (const partial of partials) {
  if (!partial || !partial.versions) continue;
  if (partial.versions.npm) {
    npmVersions[partial.nodeMajor] = partial.versions.npm;
  }
  if (partial.nodeMajor === 24) {
    pnpmVersion = partial.versions.pnpm || pnpmVersion;
    yarnVersion = partial.versions.yarn || yarnVersion;
  }

  if (partial.results?.npm) {
    npmResults[partial.nodeMajor] = partial.results.npm;
  }
  if (partial.results?.pnpm) {
    Object.assign(pnpmResults, partial.results.pnpm);
  }
  if (partial.results?.yarn) {
    if (partial.results.yarn['node-modules']) {
      Object.assign(yarnResults['node-modules'], partial.results.yarn['node-modules']);
    }
    if (partial.results.yarn.pnp) {
      Object.assign(yarnResults.pnp, partial.results.yarn.pnp);
    }
  }
}

const caseList = buildCaseList();
const rows = caseList.map((caseItem) => {
  const key = caseKey(caseItem.action, caseItem);
  return {
    ...caseItem,
    npm: {
      20: npmResults[20]?.[caseItem.action]?.[key]?.p90 ?? null,
      22: npmResults[22]?.[caseItem.action]?.[key]?.p90 ?? null,
      24: npmResults[24]?.[caseItem.action]?.[key]?.p90 ?? null,
    },
    pnpm: pnpmResults[caseItem.action]?.[key]?.p90 ?? null,
    yarn: {
      'node-modules': yarnResults['node-modules'][caseItem.action]?.[key]?.p90 ?? null,
      pnp: yarnResults.pnp[caseItem.action]?.[key]?.p90 ?? null,
    },
  };
});

const results = {
  generatedAt: new Date().toISOString(),
  versions: {
    npm: npmVersions,
    pnpm: pnpmVersion,
    yarn: yarnVersion,
  },
  cases: rows,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(results, null, 2));

function buildCaseList() {
  const cases = [];
  for (const cache of [false, true]) {
    for (const lockfile of [false, true]) {
      for (const nodeModules of [false, true]) {
        cases.push({ action: 'install', cache, lockfile, nodeModules });
      }
    }
  }
  for (const cache of [false, true]) {
    for (const nodeModules of [false, true]) {
      cases.push({ action: 'ci', cache, lockfile: true, nodeModules });
    }
  }
  return cases;
}

function caseKey(action, { cache, lockfile, nodeModules }) {
  return [action, cache ? '1' : '0', lockfile ? '1' : '0', nodeModules ? '1' : '0'].join(':');
}

async function readJsonFiles(dir) {
  try {
    const entries = await fs.readdir(dir);
    const files = entries.filter((entry) => entry.endsWith('.json'));
    const data = [];
    for (const file of files) {
      const filePath = path.join(dir, file);
      const content = await fs.readFile(filePath, 'utf8');
      data.push({ file, data: JSON.parse(content) });
    }
    return data;
  } catch {
    return [];
  }
}
