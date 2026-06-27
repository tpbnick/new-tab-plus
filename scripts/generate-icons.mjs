import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(root, 'icons', 'new-tab-plus.png');
const sizes = [16, 48, 128];

if (!existsSync(sourcePath)) {
  console.error('Missing icons/new-tab-plus.png — add the master icon and re-run npm run icons.');
  process.exit(1);
}

const source = sharp(sourcePath).ensureAlpha();

for (const size of sizes) {
  const png = await source
    .clone()
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9, palette: size <= 48 })
    .toBuffer();

  writeFileSync(join(root, 'icons', `icon-${size}.png`), png);
}

console.log(`Generated icon-16/48/128.png from icons/new-tab-plus.png (${sizes.join(', ')}px)`);
