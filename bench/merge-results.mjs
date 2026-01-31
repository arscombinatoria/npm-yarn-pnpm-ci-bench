import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const partialDir = path.join(repoRoot, 'results', 'partial');
const outputPath = path.join(repoRoot, 'results', 'results.json');

function readPartialFiles() {
  if (!fs.existsSync(partialDir)) {
    return [];
  }
  return fs
    .readdirSync(partialDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(partialDir, file));
}

const partialFiles = readPartialFiles();
const partials = {};

for (const filePath of partialFiles) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const key = `${content.nodeMajor}-${content.scope}`;
  partials[key] = content;
}

const payload = {
  generatedAt: new Date().toISOString(),
  partials
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
