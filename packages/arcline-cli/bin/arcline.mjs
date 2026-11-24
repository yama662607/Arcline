#!/usr/bin/env node
import { main } from '../src/cli.mjs';

if (Number(process.versions.node.split('.')[0]) < 22) {
  const message = 'Arcline requires Node.js 22 or newer.';
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: false, error: { code: 'NODE_VERSION', message } }));
  else console.error(message);
  process.exitCode = 1;
} else {
  process.exitCode = await main();
}
