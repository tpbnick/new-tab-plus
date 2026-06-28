import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(root, 'icons', 'new-tab-plus.png');
const stampPath = join(root, 'icons', '.icons-source-hash');
const sizes = [16, 48, 128];

if (!existsSync(sourcePath)) {
  console.error('Missing icons/new-tab-plus.png — add the master icon and re-run npm run icons.');
  process.exit(1);
}

const sourceHash = createHash('sha256').update(readFileSync(sourcePath)).digest('hex');
const outputsExist = sizes.every((size) => existsSync(join(root, 'icons', `icon-${size}.png`)));

if (outputsExist && existsSync(stampPath) && readFileSync(stampPath, 'utf8') === sourceHash) {
  console.log('Icons up to date (source unchanged)');
  process.exit(0);
}

const source = sharp(sourcePath).ensureAlpha();

for (const size of sizes) {
  const outPath = join(root, 'icons', `icon-${size}.png`);
  const png = await source
    .clone()
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9, palette: size <= 48 })
    .toBuffer();

  const existing = existsSync(outPath) ? readFileSync(outPath) : null;
  if (!existing || !existing.equals(png)) {
    writeFileSync(outPath, png);
  }
}

writeFileSync(stampPath, sourceHash);
console.log(`Generated icon-16/48/128.png from icons/new-tab-plus.png (${sizes.join(', ')}px)`);
