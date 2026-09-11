'use strict';
const { spawnSync } = require('node:child_process');
for (const file of ['scripts/security-behavior.test.cjs', 'scripts/backend-integrity.test.cjs']) {
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status || 1);
}
