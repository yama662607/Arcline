import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class CliError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new CliError('READ_FAILED', `Cannot read JSON at ${file}: ${error.message}`);
  }
}

export function sanitizeUrl(value) {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new CliError('INVALID_URL', 'URL must be nonempty and contain no control characters.');
  }
  let url;
  try { url = new URL(value.trim()); } catch {
    throw new CliError('INVALID_URL', 'Provide an absolute URL, such as https://example.com/.');
  }
  if (!['https:', 'http:', 'file:', 'ftp:', 'mailto:', 'chrome:', 'brave:', 'arc:', 'about:'].includes(url.protocol)) {
    throw new CliError('UNSAFE_URL', `URL scheme ${url.protocol} is not allowed.`);
  }
  return url.href;
}

export function countNodes(nodes) {
  let pins = 0;
  let folders = 0;
  for (const node of nodes) {
    if (node.kind === 'folder') {
      const counts = countNodes(node.children);
      pins += counts.pins;
      folders += 1 + counts.folders;
    } else pins += 1;
  }
  return { pins, folders };
}

export function portable(favorites, spaces) {
  const totals = spaces.reduce((sum, space) => {
    const counts = countNodes(space.pinned);
    return { pins: sum.pins + counts.pins, folders: sum.folders + counts.folders };
  }, { pins: 0, folders: 0 });
  return {
    format: 'arcline', version: '1.0.0', favorites, spaces,
    stats: { spaces: spaces.length, favorites: countNodes(favorites).pins, ...totals },
  };
}

export function durableWrite(file, data, mode = 0o600) {
  const fd = fs.openSync(file, 'wx', mode);
  try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

// Export files are created exclusively: an accidental --out must not overwrite browser data.
export function writeExport(file, document) {
  const resolved = path.resolve(file);
  const temporary = `${resolved}.${randomUUID()}.tmp`;
  try {
    durableWrite(temporary, `${JSON.stringify(document, null, 2)}\n`);
    fs.linkSync(temporary, resolved);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return resolved;
}
