import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PARTIAL_DIR = path.join(ROOT, 'results', 'partial');
const OUTPUT_FILE = path.join(ROOT, 'results', 'results.json');

async function readPartialFiles() {
  try {
    const entries = await fs.readdir(PARTIAL_DIR);
    const jsonFiles = entries.filter((entry) => entry.endsWith('.json'));
    const partials = [];
    for (const file of jsonFiles) {
      const raw = await fs.readFile(path.join(PARTIAL_DIR, file), 'utf8');
      partials.push(JSON.parse(raw));
    }
    return partials;
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
}

async function main() {
  const partials = await readPartialFiles();
  const results = partials.flatMap((partial) => partial.results ?? []);
  const merged = {
    updated_at: new Date().toISOString(),
    results
  };
  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(merged, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
