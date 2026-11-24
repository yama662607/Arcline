#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const cwd = process.cwd();
const openspecRoot = path.join(cwd, 'openspec');

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function printUsage() {
  console.error('Usage: openspec <command> [options]');
  console.error('Commands:');
  console.error('  list [--specs]             List active changes or specs');
  console.error('  validate <change-id>       Validate a change');
}

async function listCommand(args) {
  const showSpecs = args.includes('--specs');
  const dir = showSpecs ? path.join(openspecRoot, 'specs') : path.join(openspecRoot, 'changes');

  if (!(await pathExists(dir))) {
    return;
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      console.log(entry.name);
    }
  }
}

async function collectMarkdownFiles(dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectMarkdownFiles(entryPath);
      files.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath);
    }
  }
  return files;
}

async function validateCommand(args) {
  let changeId;
  const flags = new Set();
  for (const arg of args) {
    if (arg.startsWith('--')) {
      flags.add(arg);
    } else if (!changeId) {
      changeId = arg;
    } else {
      console.error(`Unexpected argument: ${arg}`);
      process.exitCode = 1;
      return;
    }
  }

  if (!changeId) {
    console.error('Error: change-id is required.');
    process.exitCode = 1;
    return;
  }

  const changeDir = path.join(openspecRoot, 'changes', changeId);
  if (!(await pathExists(changeDir))) {
    console.error(`Error: change '${changeId}' not found under openspec/changes.`);
    process.exitCode = 1;
    return;
  }

  const errors = [];

  const tasksPath = path.join(changeDir, 'tasks.md');
  if (await pathExists(tasksPath)) {
    const tasksContent = await fs.readFile(tasksPath, 'utf8');
    const uncheckedMatches = tasksContent.match(/- \[ \]/g);
    if (uncheckedMatches) {
      errors.push(`Found ${uncheckedMatches.length} unchecked task(s) in ${path.relative(cwd, tasksPath)}.`);
    }
  } else {
    errors.push(`Missing tasks.md for change '${changeId}'.`);
  }

  const proposalPath = path.join(changeDir, 'proposal.md');
  if (!(await pathExists(proposalPath))) {
    errors.push(`Missing proposal.md for change '${changeId}'.`);
  }

  const specsDir = path.join(changeDir, 'specs');
  if (await pathExists(specsDir)) {
    const specFiles = await collectMarkdownFiles(specsDir);
    if (specFiles.length === 0) {
      errors.push(`No spec markdown files found under ${path.relative(cwd, specsDir)}.`);
    } else {
      for (const file of specFiles) {
        const text = await fs.readFile(file, 'utf8');
        if (!/##\s+(ADDED|MODIFIED|REMOVED|RENAMED) Requirements/m.test(text)) {
          errors.push(`Spec file ${path.relative(cwd, file)} is missing a requirements heading.`);
        }
        if (!/####\s+Scenario:/m.test(text)) {
          errors.push(`Spec file ${path.relative(cwd, file)} must include at least one scenario.`);
        }
      }
    }
  } else {
    errors.push(`Missing specs/ directory for change '${changeId}'.`);
  }

  if (errors.length > 0) {
    for (const message of errors) {
      console.error(`✖ ${message}`);
    }
    process.exitCode = 1;
    return;
  }

  const strict = flags.has('--strict');
  if (strict) {
    // Placeholder for additional strict checks in the future.
  }

  console.log(`✔ change '${changeId}' passed validation`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!(await pathExists(openspecRoot))) {
    console.error('Error: openspec/ directory not found in current working directory.');
    process.exitCode = 1;
    return;
  }

  switch (command) {
    case 'list':
      await listCommand(rest);
      break;
    case 'validate':
      await validateCommand(rest);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exitCode = 1;
      break;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
