// Human-readable numbers for estimates: three significant digits and the right unit.

/** Three significant digits, without trailing zeros. @param {number} x */
export function sig3(x) {
  return x === 0 ? '0' : String(Number(x.toPrecision(3)));
}

/** @param {number} x @param {[number, string][]} steps */
function scaled(x, steps) {
  for (const [size, suffix] of steps) if (Math.abs(x) >= size) return `${sig3(x / size)} ${suffix}`;
  const last = /** @type {[number, string]} */ (steps[steps.length - 1]);
  return `${sig3(x / last[0])} ${last[1]}`;
}

const COUNT = /** @type {[number, string][]} */ ([[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K'], [1, '']]);
const BYTES = /** @type {[number, string][]} */ ([[1e18, 'EB'], [1e15, 'PB'], [1e12, 'TB'], [1e9, 'GB'], [1e6, 'MB'], [1e3, 'KB'], [1, 'B']]);
const BITS = /** @type {[number, string][]} */ ([[1e12, 'Tbps'], [1e9, 'Gbps'], [1e6, 'Mbps'], [1e3, 'Kbps'], [1, 'bps']]);

/** A value with its unit, for tables and the CLI. @param {number} x @param {string} unit */
export function format(x, unit) {
  const count = () => scaled(x, COUNT).replace(' ', '');
  switch (unit) {
    case 'count':
      return count();
    case 'count/day':
      return `${count()}/day`;
    case 'req/s':
      return `${count()}/s`;
    case 'connections':
      return `${count()} connections`;
    case 'bytes':
      return scaled(x, BYTES);
    case 'bytes/s':
      return `${scaled(x, BYTES)}/s`;
    case 'bits/s':
      return scaled(x, BITS);
    case 'servers':
    case 'nodes':
    case 'chars': {
      const n = Math.round(x);
      return `${n.toLocaleString('en-US')} ${n === 1 ? unit.slice(0, -1) : unit}`;
    }
    case 'seconds':
      return `${sig3(x)} s`;
    case 'hours':
      return `${sig3(x)} h`;
    case 'usd':
      return `$${sig3(x)}`;
    case 'usd/day':
      return `$${count()}/day`;
    default:
      return sig3(x);
  }
}
