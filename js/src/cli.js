#!/usr/bin/env node
// casebook list | show <id> [--set name=value ...] | sensitivity <id> | docs [--check] | expected [--check]
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { updateDoc, writeAtomic } from './docs.js';
import { format } from './format.js';
import { FormulaError } from './expr.js';
import { CaseError, caseIds, CASES_DIR, compute, loadCase, results } from './model.js';
import { sensitivity } from './sensitivity.js';

const DOCS = new URL('../../docs/cases/', import.meta.url);
const EXPECTED = new URL('expected/', CASES_DIR);
/** A plain decimal number, optionally with an exponent (no hex, no Infinity, no empty string). */
const NUMBER = /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;

/** Parse one `name=number` override, or undefined if it is not one. @param {string | undefined} arg */
export function parseOverride(arg) {
  const at = arg === undefined ? -1 : arg.indexOf('=');
  if (arg === undefined || at < 1) return undefined;
  const name = arg.slice(0, at);
  const text = arg.slice(at + 1);
  const value = Number(text);
  if (!NUMBER.test(text) || !Number.isFinite(value)) return undefined;
  return { name, value };
}

/** Expected values file content for a case (full precision, used by the Java cross-check). @param {string} id */
export function expectedJson(id) {
  return `${JSON.stringify(results(loadCase(id)), null, 2)}\n`;
}

/** Run a command; returns the exit code (2 for bad input, with the reason on stderr). @param {string[]} args */
export function run(args, out = console.log, err = console.error) {
  try {
    return dispatch(args, out, err);
  } catch (e) {
    if (!(e instanceof CaseError || e instanceof FormulaError)) throw e;
    err(`error: ${e.message}`);
    return 2;
  }
}

/** One command. @param {string[]} args @param {(s: string) => void} out @param {(s: string) => void} err */
function dispatch(args, out, err) {
  const [cmd, ...rest] = args;
  const check = rest.includes('--check');
  switch (cmd) {
    case 'list':
      for (const id of caseIds()) out(`${id.padEnd(20)} ${loadCase(id).title}`);
      return 0;
    case 'show': {
      const id = rest[0];
      if (!id) break;
      /** @type {Record<string, number>} */
      const overrides = {};
      for (let i = 1; i < rest.length; i++) {
        if (rest[i] !== '--set') continue;
        const o = parseOverride(rest[++i]);
        if (!o) {
          err('use --set name=number');
          return 2;
        }
        overrides[o.name] = o.value;
      }
      const c = loadCase(id);
      out(`${c.title}${Object.keys(overrides).length ? ` (what if: ${JSON.stringify(overrides)})` : ''}`);
      for (const r of compute(c, overrides).rows) out(`  ${r.label.padEnd(58)} ${format(r.value, r.unit)}`);
      return 0;
    }
    case 'sensitivity': {
      const id = rest[0];
      if (!id) break;
      for (const s of sensitivity(loadCase(id))) {
        out(`  ${s.label.padEnd(58)} ${s.drivers.map((d) => `${d.name} ${(d.change * 100).toFixed(1)}%`).join(', ') || 'none'}`);
      }
      return 0;
    }
    case 'docs':
    case 'expected': {
      const stale = [];
      for (const id of caseIds()) {
        if (cmd === 'docs') {
          if (!updateDoc(fileURLToPath(new URL(`${id}.md`, DOCS)), loadCase(id), { check })) stale.push(id);
        } else {
          const file = new URL(`${id}.json`, EXPECTED);
          const want = expectedJson(id);
          let have = '';
          try {
            have = readFileSync(file, 'utf8');
          } catch (e) {
            // A missing file is simply out of date; any other read error is reported.
            if (/** @type {NodeJS.ErrnoException} */ (e).code !== 'ENOENT') throw e;
          }
          if (have !== want) {
            stale.push(id);
            if (!check) writeAtomic(fileURLToPath(file), want);
          }
        }
      }
      if (check && stale.length) {
        err(`out of date (run npm run ${cmd}): ${stale.join(', ')}`);
        return 1;
      }
      out(stale.length ? `updated: ${stale.join(', ')}` : `all ${cmd} up to date`);
      return 0;
    }
  }
  err('usage: casebook list | show <id> [--set name=value] | sensitivity <id> | docs [--check] | expected [--check]');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = run(process.argv.slice(2));
}
