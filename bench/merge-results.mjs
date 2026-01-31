import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const partialDir = path.join(rootDir, 'results', 'partial');
const outPath = path.join(rootDir, 'results', 'results.json');

const partialFiles = await fs.readdir(partialDir);
const partials = [];

for (const file of partialFiles) {
  if (!file.endsWith('.json')) {
    continue;
  }
  const content = await fs.readFile(path.join(partialDir, file), 'utf8');
  partials.push(JSON.parse(content));
}

const merged = {
  generatedAt: new Date().toISOString(),
  versions: {
    node: {},
    npm: {},
    pnpm: null,
    yarn: null
  },
  entries: []
};

for (const partial of partials) {
  const nodeKey = String(partial.nodeMajor);
  if (partial.versions?.node) {
    merged.versions.node[nodeKey] = partial.versions.node;
  }
  if (partial.versions?.npm) {
    merged.versions.npm[nodeKey] = partial.versions.npm;
  }
  if (partial.versions?.pnpm && !merged.versions.pnpm) {
    merged.versions.pnpm = partial.versions.pnpm;
  }
  if (partial.versions?.yarn && !merged.versions.yarn) {
    merged.versions.yarn = partial.versions.yarn;
  }

  if (Array.isArray(partial.results)) {
    merged.entries.push(...partial.results);
  }
}

await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, JSON.stringify(merged, null, 2));
