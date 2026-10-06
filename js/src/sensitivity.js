import { compute } from './model.js';

/** Assumptions that are definitions, not estimates, and are never varied. */
const FIXED = new Set(['seconds_per_day', 'days_per_year', 'days_per_month']);

/** @typedef {{headline: string, label: string, drivers: {name: string, change: number}[]}} Driver */

/**
 * Which assumptions move each headline number most: raise each assumption by 10% in turn and
 * record the relative change of every headline value. Ties are all reported (in a product of
 * inputs, each input moves the result by the same 10%); a step function such as ceil() may not
 * move at all, which is reported as no drivers.
 * @param {import('./model.js').Case} c
 * @returns {Driver[]}
 */
export function sensitivity(c, bump = 0.1) {
  const base = new Map(compute(c).rows.map((r) => [r.name, r.value]));
  /** @type {Map<string, Map<string, number>>} */
  const changes = new Map(c.headline.map((h) => [h, new Map()]));
  for (const [name, a] of Object.entries(c.assumptions)) {
    if (FIXED.has(name)) continue;
    const bumped = new Map(compute(c, { [name]: a.value * (1 + bump) }).rows.map((r) => [r.name, r.value]));
    for (const h of c.headline) {
      const b = /** @type {number} */ (base.get(h));
      const change = b === 0 ? 0 : (/** @type {number} */ (bumped.get(h)) - b) / Math.abs(b);
      changes.get(h)?.set(name, change);
    }
  }
  return c.headline.map((h) => {
    const byName = /** @type {Map<string, number>} */ (changes.get(h));
    const largest = Math.max(...[...byName.values()].map(Math.abs));
    const drivers = largest < 1e-12 ? [] : [...byName]
      .filter(([, v]) => Math.abs(Math.abs(v) - largest) < 1e-9)
      .map(([name, change]) => ({ name, change }))
      .sort((a, b) => (a.name < b.name ? -1 : 1));
    const label = c.derived.find((x) => x.name === h)?.label ?? h;
    return { headline: h, label, drivers };
  });
}
