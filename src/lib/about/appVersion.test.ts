import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from './appMeta.generated';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function readJsonVersion(filename: string): string {
  const parsed = JSON.parse(readFileSync(join(root, filename), 'utf8')) as { version: string };
  return parsed.version;
}

describe('app version consistency', () => {
  it('matches package.json and manifest.json', () => {
    expect(APP_VERSION).toBe(readJsonVersion('package.json'));
    expect(APP_VERSION).toBe(readJsonVersion('manifest.json'));
  });
});
