import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CliError } from './common.mjs';

function signature(file) {
  try {
    const s = fs.statSync(file, { bigint: true });
    return [s.size, s.mtimeNs, s.ctimeNs, s.ino].join(':');
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// Copy DB and WAL as one stable observed set; never open the live DB with SQLite.
export function copyHistory(source, directory) {
  const target = path.join(directory, 'History');
  const suffixes = ['', '-wal', '-journal'];
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = suffixes.map(s => signature(source + s));
    if (!before[0]) throw new CliError('NO_HISTORY', `History file is missing: ${source}`);
    if (before[2] && fs.statSync(`${source}-journal`).size > 0) {
      throw new CliError('HISTORY_BUSY', 'History has an active rollback journal. Retry when the browser is idle.');
    }
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(target + suffix, { force: true });
    try {
      fs.copyFileSync(source, target);
      if (before[1]) fs.copyFileSync(`${source}-wal`, `${target}-wal`);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (JSON.stringify(before) === JSON.stringify(suffixes.map(s => signature(source + s)))) return target;
  }
  throw new CliError('HISTORY_BUSY', 'History changed during snapshot creation. Retry when the browser is idle.');
}

export async function searchHistory(source, query, limit = 20, { now = Date.now(), sqliteModule, run = spawnSync } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new CliError('INVALID_LIMIT', 'History limit must be between 1 and 10000.');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'arcline-history-'));
  try {
    const file = copyHistory(source, directory);
    const cutoff = BigInt(now - 30 * 86400000) * 1000n + 11644473600000000n;
    const needle = query.toLowerCase();
    const sql = `SELECT url, title, last_visit_time FROM urls
      WHERE last_visit_time >= ? AND (instr(lower(url), ?) > 0 OR instr(lower(coalesce(title, '')), ?) > 0)
      ORDER BY last_visit_time DESC, id DESC LIMIT ?`;
    let sqlite = sqliteModule;
    if (sqlite === undefined) {
      try { sqlite = await import('node:sqlite'); }
      catch (error) {
        if (!['ERR_UNKNOWN_BUILTIN_MODULE', 'ERR_MODULE_NOT_FOUND'].includes(error.code)) throw error;
        sqlite = null;
      }
    }
    let rows;
    if (sqlite) {
      const db = new sqlite.DatabaseSync(file, { readOnly: true });
      try {
        db.exec('PRAGMA query_only = ON; PRAGMA trusted_schema = OFF;');
        const statement = db.prepare(sql);
        statement.setReadBigInts(true);
        rows = statement.all(cutoff, needle, needle, limit);
      } finally { db.close(); }
    } else {
      // Hex literals carry arbitrary text without SQL or CLI metacommand interpolation.
      const literal = `CAST(X'${Buffer.from(needle, 'utf8').toString('hex')}' AS TEXT)`;
      const values = [String(cutoff), literal, literal, String(limit)];
      const statement = sql.replace(/\?/g, () => values.shift());
      const result = run('sqlite3', ['-readonly', '-json', file, `PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; ${statement}`],
        { encoding: 'utf8', timeout: 15000, maxBuffer: 16 * 1024 * 1024 });
      if (result.error || result.status !== 0) throw new CliError('SQLITE_UNAVAILABLE', `History needs working node:sqlite or sqlite3 with -json support: ${result.error?.message ?? result.stderr}`);
      rows = JSON.parse(result.stdout || '[]');
    }
    return rows.map(row => ({ source: 'history', kind: 'pin', title: row.title || row.url, url: row.url,
      lastVisited: new Date(Number((BigInt(row.last_visit_time) - 11644473600000000n) / 1000n)).toISOString() }));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
