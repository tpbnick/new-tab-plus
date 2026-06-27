import { createWriteStream, existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZipArchive } from 'archiver';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, 'dist');

if (!existsSync(distDir)) {
  console.error('dist/ not found - run `npm run build` first.');
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const outFile = path.join(rootDir, `new-tab-plus-v${version}.zip`);

const output = createWriteStream(outFile);
const archive = new ZipArchive({ zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Wrote ${outFile} (${archive.pointer()} bytes)`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(distDir, false);
await archive.finalize();
