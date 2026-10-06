import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { format } from './format.js';
import { compute } from './model.js';
import { sensitivity } from './sensitivity.js';

export const START = '<!-- generated from cases/{id}.json by `npm run docs`: do not edit by hand -->';
export const END = '<!-- end of generated section -->';

/** Signed percentage with one decimal. @param {number} x */
const pct = (x) => `${x >= 0 ? '+' : '-'}${Math.abs(x * 100).toFixed(1)}%`;

/** The generated part of a case's design doc. @param {import('./model.js').Case} c */
export function render(c) {
  const { rows } = compute(c);
  const lines = [
    START.replace('{id}', c.id),
    '',
    `> ${c.summary}`,
    '',
    '## Requirements',
    '',
    '**Functional**',
    '',
    ...c.functional.map((f) => `- ${f}`),
    '',
    '**Non-functional**',
    '',
    ...c.non_functional.map((f) => `- ${f}`),
    '',
    '## Assumptions',
    '',
    '| Assumption | Value | Why |',
    '|---|---|---|',
    ...Object.entries(c.assumptions).map(([name, a]) => `| \`${name}\` | ${format(a.value, a.unit)} | ${a.why} |`),
    '',
    '## Estimates',
    '',
    '| Estimate | Value | Formula |',
    '|---|---|---|',
    ...rows.map((r) => `| ${c.headline.includes(r.name) ? `**${r.label}**` : r.label} | ${format(r.value, r.unit)} | \`${r.formula}\` |`),
    '',
    '## What moves the numbers',
    '',
    'Each assumption raised by 10% in turn; the ones that change each headline estimate most, with the',
    'change each causes:',
    '',
    '| Estimate | Biggest drivers |',
    '|---|---|',
    ...sensitivity(c).map((s) =>
      s.drivers.length === 0
        ? `| ${s.label} | none: no single +10% change moves it (a rounded or step value) |`
        : `| ${s.label} | ${s.drivers.map((d) => `\`${d.name}\` ${pct(d.change)}`).join(', ')} |`,
    ),
    '',
    END,
  ];
  return lines.join('\n');
}

/**
 * Replace the generated section of a doc (or check it is current); hand-written text after it is kept.
 * Returns true when the file is (or already was) up to date.
 * @param {string} path @param {import('./model.js').Case} c @param {{check: boolean}} options
 */
export function updateDoc(path, c, { check }) {
  const generated = render(c);
  const current = existsSync(path) ? readFileSync(path, 'utf8') : `# ${c.title}\n\n${START.replace('{id}', c.id)}\n${END}\n`;
  const start = current.indexOf(START.replace('{id}', c.id));
  const end = current.indexOf(END);
  if (start < 0 || end < start) throw new Error(`${path}: generated markers are missing`);
  const next = current.slice(0, start) + generated + current.slice(end + END.length);
  if (next === current) return true;
  if (!check) writeFileSync(path, next);
  return false;
}
