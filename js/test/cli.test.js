import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseOverride, run } from '../src/cli.js';

/** Run the CLI and capture its output. @param {string[]} args */
function cli(args) {
  /** @type {string[]} */
  const out = [];
  /** @type {string[]} */
  const err = [];
  const code = run(args, (l) => out.push(l), (l) => err.push(l));
  return { code, out, err };
}

test('list shows all twelve cases', () => {
  assert.equal(cli(['list']).out.length, 12);
});

test('show prints estimates and accepts what-if overrides', () => {
  const base = cli(['show', 'chat']);
  assert.ok(base.out.some((l) => l.includes('1,429 servers')));
  const whatIf = cli(['show', 'chat', '--set', 'online_fraction=0.1']);
  assert.match(whatIf.out[0] ?? '', /what if/);
  assert.ok(whatIf.out.some((l) => l.includes('715 servers')));
});

test('bad input exits with 2', () => {
  assert.equal(cli(['show', 'chat', '--set', 'online_fraction=lots']).code, 2);
  assert.equal(cli(['explode']).code, 2);
  assert.equal(cli(['show']).code, 2);
});

test('an unknown case or assumption is a clear error with exit 2, not a crash', () => {
  const unknownAssumption = cli(['show', 'url-shortener', '--set', 'dau=2']);
  assert.equal(unknownAssumption.code, 2);
  assert.match(unknownAssumption.err.join(' '), /cannot override unknown assumption dau/);
  for (const id of ['nope', '../../package', 'defaults']) {
    const r = cli(['show', id]);
    assert.equal(r.code, 2, id);
    assert.match(r.err.join(' '), /unknown case/, id);
  }
});

test('a --set value must be a plain finite number', () => {
  assert.deepEqual(parseOverride('online_fraction=0.1'), { name: 'online_fraction', value: 0.1 });
  assert.deepEqual(parseOverride('users=1e6'), { name: 'users', value: 1e6 });
  for (const bad of ['online_fraction=', 'online_fraction=lots', 'online_fraction=1=2', 'online_fraction=Infinity', 'online_fraction=0x10', '=1', 'online_fraction', undefined]) {
    assert.equal(parseOverride(bad), undefined, String(bad));
  }
  for (const bad of ['online_fraction=', 'online_fraction=lots', 'online_fraction=1=2']) {
    const r = cli(['show', 'chat', '--set', bad]);
    assert.equal(r.code, 2, bad);
    assert.match(r.err.join(' '), /use --set name=number/, bad);
  }
  assert.equal(cli(['show', 'chat', '--set']).code, 2, 'a missing value');
});
