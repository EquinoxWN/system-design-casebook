import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadCase } from '../src/model.js';
import { sensitivity } from '../src/sensitivity.js';

const byHeadline = (/** @type {string} */ id) => new Map(sensitivity(loadCase(id)).map((s) => [s.headline, s]));

test('every input of a product moves it by the same 10%, so all are reported', () => {
  const s = byHeadline('url-shortener').get('peak_redirect_qps');
  assert.deepEqual(s?.drivers.map((d) => d.name), ['daily_active_users', 'links_per_user_per_day', 'peak_to_average', 'reads_per_write']);
  for (const d of s?.drivers ?? []) assert.ok(Math.abs(d.change - 0.1) < 1e-12);
});

test('inputs in a denominator are reported with a negative change', () => {
  const nodes = byHeadline('url-shortener').get('storage_nodes');
  const headroom = nodes?.drivers.find((d) => d.name === 'headroom');
  assert.ok(headroom && headroom.change < 0);
});

test('rounded values that no single 10% change moves have no drivers', () => {
  assert.deepEqual(byHeadline('url-shortener').get('key_length')?.drivers, []);
});

test('definitions such as seconds per day are never varied', () => {
  for (const id of ['url-shortener', 'chat', 'web-crawler']) {
    for (const s of sensitivity(loadCase(id))) {
      assert.ok(!s.drivers.some((d) => ['seconds_per_day', 'days_per_year', 'days_per_month'].includes(d.name)));
    }
  }
});
