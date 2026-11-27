import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { callBridge } from '../src/bridge.mjs';
import { main } from '../src/cli.mjs';

const bridgeBin = fileURLToPath(new URL('../bin/arcline-bridge.mjs', import.meta.url));

function writeNativeMsg(stream, obj) {
  const payload = Buffer.from(JSON.stringify(obj), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  stream.write(Buffer.concat([header, payload]));
}

test('arcline-bridge relays JSON-RPC over Unix socket and 4-byte Native Messaging framing', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arcline-bridge-test-'));
  const socketPath = path.join(tmpDir, 'bridge.sock');
  const prevEnv = process.env.ARCLINE_BRIDGE_SOCKET;
  process.env.ARCLINE_BRIDGE_SOCKET = socketPath;

  const child = spawn(process.execPath, [bridgeBin], {
    env: { ...process.env, ARCLINE_BRIDGE_SOCKET: socketPath },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Mock Chrome extension side: echo back received method + params
  let outBuf = Buffer.alloc(0);
  child.stdout.on('data', (chunk) => {
    outBuf = Buffer.concat([outBuf, chunk]);
    while (outBuf.length >= 4) {
      const len = outBuf.readUInt32LE(0);
      if (outBuf.length < 4 + len) break;
      const req = JSON.parse(outBuf.subarray(4, 4 + len).toString('utf8'));
      outBuf = outBuf.subarray(4 + len);
      writeNativeMsg(child.stdin, {
        id: req.id,
        ok: true,
        data: { echoedMethod: req.method, params: req.params },
      });
    }
  });

  // Wait for socket to appear
  for (let i = 0; i < 40 && !fs.existsSync(socketPath); i += 1) {
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.equal(fs.existsSync(socketPath), true);

  try {
    const res = await callBridge('siteSearch.setEnabled', { id: 'reddit', enabled: false });
    assert.deepEqual(res, {
      echoedMethod: 'siteSearch.setEnabled',
      params: { id: 'reddit', enabled: false },
    });

    // Verify CLI command end-to-end against live bridge
    let stdout = '';
    let stderr = '';
    const code = await main(
      ['site-search', 'edit', '--prefix', 'docs', '--label', 'Internal Docs', '--json'],
      { stdout: { write: (s) => { stdout += s; } }, stderr: { write: (s) => { stderr += s; } } },
    );
    assert.equal(code, 0, stderr);
    const envelope = JSON.parse(stdout);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.echoedMethod, 'siteSearch.edit');
    assert.equal(envelope.data.params.prefix, 'docs');
    assert.equal(envelope.data.params.label, 'Internal Docs');
  } finally {
    child.stdin.end();
    child.kill();
    if (prevEnv === undefined) delete process.env.ARCLINE_BRIDGE_SOCKET;
    else process.env.ARCLINE_BRIDGE_SOCKET = prevEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
