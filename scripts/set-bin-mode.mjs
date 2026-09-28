#!/usr/bin/env node

import { chmod } from 'node:fs/promises';

// TypeScript emits new files using the process umask, so a clean build loses
// the executable bit required by npm-linked Unix command shims.
if (process.platform !== 'win32') {
  await chmod('dist/index.js', 0o755);
}
