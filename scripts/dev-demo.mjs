import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const rootDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(rootDir, '..');
const appDir = resolve(repoRoot, 'apps/demo');
const nextBin = resolve(appDir, 'node_modules/.bin/next');

const child = spawn(nextBin, ['dev'], {
  cwd: appDir,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
