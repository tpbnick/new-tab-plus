import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZipArchive } from 'archiver';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, 'dist');
const distManifestPath = path.join(distDir, 'manifest.json');

if (!existsSync(distDir)) {
  console.error('dist/ not found - run `npm run build` first.');
  process.exit(1);
}

if (!existsSync(distManifestPath)) {
  console.error('dist/manifest.json not found - run `npm run build` first.');
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const { version: distVersion } = JSON.parse(readFileSync(distManifestPath, 'utf8'));

if (distVersion !== version) {
  console.error(
    `Version mismatch: dist/manifest.json has "${distVersion}", expected "${version}" (from package.json). Run \`npm run build\` first.`
  );
  process.exit(1);
}

const outFile = path.join(rootDir, `new-tab-plus-v${version}.zip`);

const output = createWriteStream(outFile);
const archive = new ZipArchive({ zlib: { level: 9 } });

const done = new Promise((resolve, reject) => {
  output.on('close', resolve);
  output.on('error', reject);
  archive.on('error', reject);
});

archive.pipe(output);
archive.directory(distDir, false);
await Promise.all([done, archive.finalize()]);

console.log(`Wrote ${outFile} (${archive.pointer()} bytes)`);
