import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluate, FormulaError, MAX_DEPTH, MAX_LENGTH, names, parse } from '../src/expr.js';

const calc = (/** @type {string} */ f, /** @type {Record<string, number>} */ env = {}) => evaluate(parse(f), new Map(Object.entries(env)), f);

test('arithmetic follows the usual precedence and associativity', () => {
  assert.equal(calc('1 + 2 * 3'), 7);
  assert.equal(calc('(1 + 2) * 3'), 9);
  assert.equal(calc('10 - 4 - 3'), 3);
  assert.equal(calc('100 / 10 / 5'), 2);
  assert.equal(calc('-2 * -3'), 6);
  assert.equal(calc('1.5e3 + 2E-1'), 1500.2);
});

test('prototype names are unknown functions, and huge or deeply nested input is refused cleanly', () => {
  for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.throws(() => parse(`${name}(1)`), (e) => e instanceof FormulaError && /unknown function|unexpected character/.test(e.message), name);
  }
  assert.throws(() => parse('('.repeat(MAX_DEPTH + 1) + '1' + ')'.repeat(MAX_DEPTH + 1)), (e) => e instanceof FormulaError && /nested/.test(e.message));
  assert.throws(() => parse('-'.repeat(MAX_DEPTH + 1) + '1'), (e) => e instanceof FormulaError && /nested/.test(e.message));
  assert.throws(() => parse('1+'.repeat(MAX_LENGTH) + '1'), (e) => e instanceof FormulaError && /longer than/.test(e.message));
  assert.equal(evaluate(parse('('.repeat(50) + '2' + ')'.repeat(50)), new Map(), 'x'), 2);
});

test('names and functions', () => {
  assert.equal(calc('users * per_user', { users: 1e6, per_user: 0.5 }), 500_000);
  assert.equal(calc('ceil(2.1) + floor(2.9) + round(2.5)'), 3 + 2 + 3);
  assert.equal(calc('min(3, 4) + max(3, 4)'), 7);
  assert.equal(calc('ceil(log(36500000000, 62))'), 6);
  assert.deepEqual([...names(parse('ceil(a / (b * c)) + a'))].sort(), ['a', 'b', 'c']);
});

test('broken formulas fail with a clear error instead of a wrong number', () => {
  const cases = [
    ['1 +', /unexpected end/],
    ['(1 + 2', /expected '\)'/],
    ['1 2', /unexpected '2'/],
    ['2 ** 3', /unexpected '\*'/],
    ['users * 2', /unknown name 'users'/],
    ['sqrt(4)', /unknown function 'sqrt'/],
    ['min(1)', /takes 2 argument/],
    ['1 / 0', /division by zero/],
    ['log(0, 10)', /not a finite number/],
    ['process.exit(1)', /unexpected character/],
    ['a; b', /unexpected character/],
  ];
  for (const [formula, why] of cases) assert.throws(() => calc(/** @type {string} */ (formula)), (e) => e instanceof FormulaError && /** @type {RegExp} */ (why).test(e.message), String(formula));
});
