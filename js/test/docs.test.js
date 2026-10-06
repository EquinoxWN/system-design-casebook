import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { END, render, START, updateDoc } from '../src/docs.js';
import { run } from '../src/cli.js';
import { loadCase } from '../src/model.js';

test('the generated section has requirements, assumptions, estimates and drivers', () => {
  const text = render(loadCase('chat'));
  for (const heading of ['## Requirements', '## Assumptions', '## Estimates', '## What moves the numbers']) assert.ok(text.includes(heading), heading);
  assert.ok(text.includes('| **Connection gateway servers** | 1,429 servers |'));
});

test('updating a doc replaces only the generated section and keeps hand-written text', () => {
  const c = loadCase('pastebin');
  const file = join(mkdtempSync(join(process.env.TMP ?? tmpdir(), 'casebook-')), 'pastebin.md');
  writeFileSync(file, `# Pastebin\n\n${START.replace('{id}', 'pastebin')}\nstale\n${END}\n\n## What the numbers say\n\nMine.\n`);
  assert.equal(updateDoc(file, c, { check: true }), false, 'check mode reports a stale doc');
  assert.ok(readFileSync(file, 'utf8').includes('stale'), 'check mode does not write');
  assert.equal(updateDoc(file, c, { check: false }), false);
  const updated = readFileSync(file, 'utf8');
  assert.ok(updated.includes('## Estimates') && updated.endsWith('## What the numbers say\n\nMine.\n'));
  assert.equal(updateDoc(file, c, { check: true }), true, 'now up to date');
});

test('the committed docs and expected values match the case files', () => {
  const quiet = () => {};
  assert.equal(run(['docs', '--check'], quiet, quiet), 0);
  assert.equal(run(['expected', '--check'], quiet, quiet), 0);
});
