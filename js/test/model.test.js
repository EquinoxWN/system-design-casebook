import assert from 'node:assert/strict';
import { test } from 'node:test';
import { caseIds, CaseError, compute, loadCase, results, validate } from '../src/model.js';

test('there are twelve cases and every one loads and validates', () => {
  const ids = caseIds();
  assert.equal(ids.length, 12);
  for (const id of ids) {
    const c = loadCase(id);
    assert.ok(c.functional.length >= 3 && c.non_functional.length >= 3, `${id} has requirements`);
    assert.ok(c.headline.length >= 3, `${id} has headline estimates`);
  }
});

test('known worked values', () => {
  const url = results(loadCase('url-shortener'));
  assert.equal(url.links_total, 36_500_000_000);
  assert.equal(url.key_length, 6);
  assert.equal(url.storage_total, 54_750_000_000_000);
  assert.equal(url.app_servers, 3);
  assert.equal(url.storage_nodes, 40);
  assert.equal(results(loadCase('chat')).gateway_servers, 1429);
  assert.equal(results(loadCase('notifications')).sms_cost_per_day, 375_000);
  assert.equal(Math.round(Number(results(loadCase('web-crawler')).concurrent_fetches)), 579);
});

test('what-if overrides change the estimates and unknown overrides are refused', () => {
  const c = loadCase('url-shortener');
  const base = results(c);
  const doubled = results(c, { daily_active_users: 200_000_000 });
  assert.equal(doubled.peak_redirect_qps, Number(base.peak_redirect_qps) * 2);
  assert.equal(doubled.key_length, 7, 'twice the users means 73 billion links, more than 6 base62 characters hold');
  assert.equal(results(c, { daily_active_users: 150_000_000 }).key_length, 6, '1.5 times still fits');
  assert.throws(() => compute(c, { dau: 1 }), CaseError);
});

test('case validation catches the mistakes a contributor could make', () => {
  const base = loadCase('pastebin');
  const broken = [
    [{ derived: [{ name: 'x', label: 'x', formula: 'later_value * 2', unit: 'count' }], headline: ['x'] }, /uses later_value before/],
    [{ derived: [{ name: 'daily_active_users', label: 'x', formula: '1', unit: 'count' }], headline: [] }, /defined twice/],
    [{ derived: [{ name: 'x', label: 'x', formula: '1', unit: 'furlongs' }], headline: [] }, /unknown unit/],
    [{ headline: ['nope'] }, /headline nope/],
    [{ assumptions: { ...base.assumptions, extra: { value: 1, unit: 'count', why: '' } } }, /needs a reason/],
    [{ assumptions: { ...base.assumptions, Bad: { value: 1, unit: 'count', why: 'x' } } }, /bad assumption name/],
  ];
  for (const [patch, why] of broken) {
    assert.throws(() => validate({ ...base, ...patch }), (e) => e instanceof CaseError && /** @type {RegExp} */ (why).test(e.message));
  }
});
