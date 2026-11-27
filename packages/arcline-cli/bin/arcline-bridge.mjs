#!/usr/bin/env node
/**
 * Arcline Native Messaging Host (`com.arcline.bridge`).
 * Spawned by Brave/Chrome when the Arcline extension calls `chrome.runtime.connectNative`.
 * Exposes a user-only (0600) Unix domain socket at `~/.arcline/bridge.sock` so `arcline` CLI
 * commands can invoke live `chrome.bookmarks` / `chrome.storage` operations safely with full Sync.
 */
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const bridgeDir = path.join(os.homedir(), '.arcline');
const socketPath = process.env.ARCLINE_BRIDGE_SOCKET || path.join(bridgeDir, 'bridge.sock');

fs.mkdirSync(path.dirname(socketPath), { recursive: true, mode: 0o700 });
try { fs.unlinkSync(socketPath); } catch { /* ignore */ }

/** @type {Map<string, net.Socket>} */
const pending = new Map();

function writeNativeMessage(obj) {
  const payload = Buffer.from(JSON.stringify(obj), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  process.stdout.write(Buffer.concat([header, payload]));
}

// Read 4-byte length-prefixed JSON messages from browser stdout->host stdin
let inBuf = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
  inBuf = Buffer.concat([inBuf, chunk]);
  while (inBuf.length >= 4) {
    const len = inBuf.readUInt32LE(0);
    if (len > 16 * 1024 * 1024) {
      cleanupAndExit(1);
      return;
    }
    if (inBuf.length < 4 + len) break;
    const body = inBuf.subarray(4, 4 + len).toString('utf8');
    inBuf = inBuf.subarray(4 + len);
    try {
      const msg = JSON.parse(body);
      if (msg && typeof msg.id === 'string') {
        const client = pending.get(msg.id);
        if (client) {
          pending.delete(msg.id);
          if (!client.destroyed) {
            client.write(`${JSON.stringify(msg)}\n`);
            client.end();
          }
        }
      }
    } catch {
      // Ignore malformed responses
    }
  }
});

const server = net.createServer((socket) => {
  let reqBuf = '';
  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    reqBuf += chunk;
    const nl = reqBuf.indexOf('\n');
    if (nl < 0) return;
    const line = reqBuf.slice(0, nl).trim();
    reqBuf = reqBuf.slice(nl + 1);
    if (!line) return;
    try {
      const req = JSON.parse(line);
      if (!req || typeof req.id !== 'string' || typeof req.method !== 'string') {
        socket.write(`${JSON.stringify({ id: req?.id ?? '', ok: false, error: { code: 'INVALID_REQUEST', message: 'id and method required' } })}\n`);
        socket.end();
        return;
      }
      pending.set(req.id, socket);
      socket.on('close', () => pending.delete(req.id));
      writeNativeMessage(req);
    } catch {
      socket.write(`${JSON.stringify({ id: '', ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON request' } })}\n`);
      socket.end();
    }
  });
});

function cleanupAndExit(code = 0) {
  try { server.close(); } catch { /* ignore */ }
  try { fs.unlinkSync(socketPath); } catch { /* ignore */ }
  process.exit(code);
}

server.listen(socketPath, () => {
  try { fs.chmodSync(socketPath, 0o600); } catch { /* ignore */ }
});

server.on('error', () => cleanupAndExit(1));
process.stdin.on('end', () => cleanupAndExit(0));
process.on('SIGINT', () => cleanupAndExit(0));
process.on('SIGTERM', () => cleanupAndExit(0));
