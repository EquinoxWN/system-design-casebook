import assert from 'node:assert/strict';
import { test } from 'node:test';
import { format, sig3 } from '../src/format.js';

test('three significant digits', () => {
  assert.equal(sig3(34722.22), '34700');
  assert.equal(sig3(0.0075), '0.0075');
  assert.equal(sig3(1.37), '1.37');
  assert.equal(sig3(0), '0');
});

test('every unit has a readable form', () => {
  assert.equal(format(34722.2, 'req/s'), '34.7K/s');
  assert.equal(format(1e9, 'count/day'), '1B/day');
  assert.equal(format(54.75e12, 'bytes'), '54.8 TB');
  assert.equal(format(1.05e18, 'bytes'), '1.05 EB');
  assert.equal(format(17.36e6, 'bytes/s'), '17.4 MB/s');
  assert.equal(format(111.1e12, 'bits/s'), '111 Tbps');
  assert.equal(format(1429, 'servers'), '1,429 servers');
  assert.equal(format(1, 'servers'), '1 server');
  assert.equal(format(375000, 'usd/day'), '$375K/day');
  assert.equal(format(100, 'seconds'), '100 s');
  assert.equal(format(1e8, 'connections'), '100M connections');
});
