import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const rootDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(rootDir, '..');
const appDir = resolve(repoRoot, 'apps/demo');
const nextBin = resolve(appDir, 'node_modules/.bin/next');

rmSync(resolve(appDir, '.next'), { recursive: true, force: true });

const result = spawnSync(nextBin, ['build'], {
  cwd: appDir,
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
