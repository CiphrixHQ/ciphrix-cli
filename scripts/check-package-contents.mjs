import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cacheDirectory = mkdtempSync(join(tmpdir(), 'ciphrix-package-check-'));
let manifest;

try {
  manifest = JSON.parse(
    execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
      encoding: 'utf8',
      env: { ...process.env, npm_config_cache: cacheDirectory },
      stdio: ['ignore', 'pipe', 'inherit'],
    }),
  )[0];
} finally {
  rmSync(cacheDirectory, { recursive: true, force: true });
}

const files = manifest.files.map(({ path }) => path);
const forbidden = files.filter(
  (path) =>
    path.endsWith('.map') ||
    path === '.DS_Store' ||
    path.includes('/.DS_Store') ||
    path.startsWith('assets/') ||
    path.startsWith('src/') ||
    path.startsWith('test/'),
);

if (forbidden.length > 0) {
  console.error(`Package contains forbidden public-release files:\n${forbidden.join('\n')}`);
  process.exit(1);
}

const required = [
  'LICENSE',
  'README.md',
  'dist/index.js',
  'skills/ciphrix/SKILL.md',
  'skills/ciphrix/references/commands.md',
];
const missing = required.filter((path) => !files.includes(path));

if (missing.length > 0) {
  console.error(`Package is missing required files:\n${missing.join('\n')}`);
  process.exit(1);
}

console.log(`Package contents verified: ${files.length} files, no forbidden release artifacts.`);
