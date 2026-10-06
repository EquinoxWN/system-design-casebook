import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { evaluate, names, parse } from './expr.js';

/** Units a value may have; each has a formatter in format.js. */
export const UNITS = new Set([
  'count', 'count/day', 'req/s', 'bytes', 'bytes/s', 'bits/s', 'servers', 'nodes', 'connections',
  'chars', 'seconds', 'hours', 'ratio', 'usd', 'usd/day',
]);

/** @typedef {{value: number, unit: string, why: string}} Assumption */
/** @typedef {{name: string, label: string, formula: string, unit: string}} Derived */
/** @typedef {{id: string, title: string, summary: string, functional: string[], non_functional: string[], assumptions: Record<string, Assumption>, derived: Derived[], headline: string[]}} Case */
/** @typedef {{name: string, label: string, value: number, unit: string, formula: string}} Row */

/** The cases directory next to js/. */
export const CASES_DIR = new URL('../../cases/', import.meta.url);

/** Raised when a case file breaks the rules. */
export class CaseError extends Error {
  /** @param {string} id @param {string} message */
  constructor(id, message) {
    super(`case ${id}: ${message}`);
    this.name = 'CaseError';
  }
}

/** Ids of every case, sorted. */
export function caseIds(dir = CASES_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'defaults.json')
    .map((f) => f.slice(0, -5))
    .sort();
}

/** Load a case and merge in the default assumptions it does not override. @param {string} id */
export function loadCase(id, dir = CASES_DIR) {
  // Only names of files in the cases folder: an id can never become a path elsewhere.
  if (!/^[a-z0-9-]{1,64}$/.test(id) || !caseIds(dir).includes(id)) throw new CaseError(id, 'unknown case');
  const read = (/** @type {string} */ f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
  const defaults = read('defaults.json').assumptions;
  /** @type {Case} */
  const c = read(`${id}.json`);
  if (c.id !== id) throw new CaseError(id, `file declares id ${c.id}`);
  const merged = { ...c, assumptions: { ...defaults, ...c.assumptions } };
  validate(merged);
  return merged;
}

/** Check names, units, formulas and that every formula only uses names defined before it. @param {Case} c */
export function validate(c) {
  const known = new Set();
  for (const [name, a] of Object.entries(c.assumptions)) {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new CaseError(c.id, `bad assumption name ${name}`);
    if (!Number.isFinite(a.value)) throw new CaseError(c.id, `${name} must be a number`);
    if (!UNITS.has(a.unit)) throw new CaseError(c.id, `${name} has unknown unit ${a.unit}`);
    if (!a.why) throw new CaseError(c.id, `${name} needs a reason ("why")`);
    known.add(name);
  }
  for (const d of c.derived) {
    if (known.has(d.name)) throw new CaseError(c.id, `${d.name} is defined twice`);
    if (!UNITS.has(d.unit)) throw new CaseError(c.id, `${d.name} has unknown unit ${d.unit}`);
    for (const n of names(parse(d.formula))) {
      if (!known.has(n)) throw new CaseError(c.id, `${d.name} uses ${n} before it is defined`);
    }
    known.add(d.name);
  }
  for (const h of c.headline) if (!c.derived.some((d) => d.name === h)) throw new CaseError(c.id, `headline ${h} is not derived`);
}

/**
 * Compute every derived value in order; overrides replace assumption values ("what if").
 * @param {Case} c @param {Record<string, number>} overrides
 */
export function compute(c, overrides = {}) {
  /** @type {Map<string, number>} */
  const env = new Map(Object.entries(c.assumptions).map(([k, a]) => [k, a.value]));
  for (const [k, v] of Object.entries(overrides)) {
    if (!env.has(k)) throw new CaseError(c.id, `cannot override unknown assumption ${k}`);
    env.set(k, v);
  }
  /** @type {Row[]} */
  const rows = c.derived.map((d) => {
    const value = evaluate(parse(d.formula), env, d.formula);
    env.set(d.name, value);
    return { name: d.name, label: d.label, value, unit: d.unit, formula: d.formula };
  });
  return { env, rows };
}

/** The derived values as a plain object. @param {Case} c @param {Record<string, number>} overrides */
export function results(c, overrides = {}) {
  return Object.fromEntries(compute(c, overrides).rows.map((r) => [r.name, r.value]));
}

/** Directory of a case file for documentation links. */
export const casePath = (/** @type {string} */ id) => join('cases', `${id}.json`);
