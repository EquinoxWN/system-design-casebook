// A tiny, safe formula language: numbers, names, + - * / and parentheses, and a few functions.
// Formulas come from data files, so they are parsed, never passed to eval().

/** Raised for a formula that cannot be parsed or evaluated. */
export class FormulaError extends Error {
  /** @param {string} message @param {string} formula */
  constructor(message, formula) {
    super(`${message} in formula: ${formula}`);
    this.name = 'FormulaError';
  }
}

/** @typedef {{kind: 'num', value: number} | {kind: 'name', name: string} | {kind: 'neg', arg: Node} | {kind: 'bin', op: string, left: Node, right: Node} | {kind: 'call', fn: string, args: Node[]}} Node */

/** Functions a formula may call, with their exact number of arguments. */
export const FUNCTIONS = {
  ceil: { arity: 1, fn: (/** @type {number[]} */ a) => Math.ceil(/** @type {number} */ (a[0])) },
  floor: { arity: 1, fn: (/** @type {number[]} */ a) => Math.floor(/** @type {number} */ (a[0])) },
  round: { arity: 1, fn: (/** @type {number[]} */ a) => Math.round(/** @type {number} */ (a[0])) },
  min: { arity: 2, fn: (/** @type {number[]} */ a) => Math.min(/** @type {number} */ (a[0]), /** @type {number} */ (a[1])) },
  max: { arity: 2, fn: (/** @type {number[]} */ a) => Math.max(/** @type {number} */ (a[0]), /** @type {number} */ (a[1])) },
  // log(x, base) as ln(x) / ln(base), computed the same way in Java (StrictMath.log).
  log: { arity: 2, fn: (/** @type {number[]} */ a) => Math.log(/** @type {number} */ (a[0])) / Math.log(/** @type {number} */ (a[1])) },
};

const TOKEN = /\s*(?:(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([a-z_][a-z0-9_]*)|([-+*/(),]))/y;

/** Longest formula accepted, so evaluation recursion stays shallow. */
export const MAX_LENGTH = 2000;
/** Deepest nesting of parentheses and unary minus accepted. */
export const MAX_DEPTH = 100;

/** Parse a formula into a tree; throws FormulaError on any syntax problem. @param {string} formula */
export function parse(formula) {
  if (formula.length > MAX_LENGTH) throw new FormulaError(`formula is longer than ${MAX_LENGTH} characters`, formula.slice(0, 40) + '...');
  /** @type {string[]} */
  const tokens = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < formula.length) {
    if (/^\s*$/.test(formula.slice(TOKEN.lastIndex))) break;
    const m = TOKEN.exec(formula);
    if (!m) throw new FormulaError(`unexpected character at ${TOKEN.lastIndex}`, formula);
    tokens.push(/** @type {string} */ (m[1] ?? m[2] ?? m[3]));
  }
  let i = 0;
  let depth = 0;
  const peek = () => tokens[i];
  const take = () => tokens[i++];
  const expect = (/** @type {string} */ t) => {
    if (take() !== t) throw new FormulaError(`expected '${t}'`, formula);
  };
  /** @returns {Node} */
  const expr = () => {
    let left = term();
    while (peek() === '+' || peek() === '-') left = { kind: 'bin', op: /** @type {string} */ (take()), left, right: term() };
    return left;
  };
  /** @returns {Node} */
  const term = () => {
    let left = unary();
    while (peek() === '*' || peek() === '/') left = { kind: 'bin', op: /** @type {string} */ (take()), left, right: unary() };
    return left;
  };
  /** @returns {Node} */
  const unary = () => {
    if (++depth > MAX_DEPTH) throw new FormulaError(`nested more than ${MAX_DEPTH} levels deep`, formula);
    try {
      if (peek() === '-') {
        take();
        return { kind: 'neg', arg: unary() };
      }
      return primary();
    } finally {
      depth--;
    }
  };
  /** @returns {Node} */
  const primary = () => {
    const t = take();
    if (t === undefined) throw new FormulaError('unexpected end', formula);
    if (t === '(') {
      const inner = expr();
      expect(')');
      return inner;
    }
    if (/^\d/.test(t)) return { kind: 'num', value: Number(t) };
    if (/^[a-z_]/.test(t)) {
      if (peek() !== '(') return { kind: 'name', name: t };
      take();
      /** @type {Node[]} */
      const args = [];
      if (peek() !== ')') {
        do args.push(expr());
        while (peek() === ',' && take());
      }
      expect(')');
      // Own properties only: names like `constructor` must not reach Object.prototype.
      const f = Object.hasOwn(FUNCTIONS, t) ? FUNCTIONS[/** @type {keyof typeof FUNCTIONS} */ (t)] : undefined;
      if (!f) throw new FormulaError(`unknown function '${t}'`, formula);
      if (args.length !== f.arity) throw new FormulaError(`'${t}' takes ${f.arity} argument(s)`, formula);
      return { kind: 'call', fn: t, args };
    }
    throw new FormulaError(`unexpected '${t}'`, formula);
  };
  const tree = expr();
  if (i !== tokens.length) throw new FormulaError(`unexpected '${tokens[i]}'`, formula);
  return tree;
}

/** Every name a formula refers to. @param {Node} node @returns {Set<string>} */
export function names(node, out = new Set()) {
  if (node.kind === 'name') out.add(node.name);
  else if (node.kind === 'neg') names(node.arg, out);
  else if (node.kind === 'bin') {
    names(node.left, out);
    names(node.right, out);
  } else if (node.kind === 'call') for (const a of node.args) names(a, out);
  return out;
}

/** Evaluate a tree with the given values; results must be finite numbers. @param {Node} node @param {Map<string, number>} env @param {string} formula */
export function evaluate(node, env, formula) {
  /** @returns {number} */
  const ev = (/** @type {Node} */ n) => {
    switch (n.kind) {
      case 'num':
        return n.value;
      case 'name': {
        const v = env.get(n.name);
        if (v === undefined) throw new FormulaError(`unknown name '${n.name}'`, formula);
        return v;
      }
      case 'neg':
        return -ev(n.arg);
      case 'bin': {
        const l = ev(n.left);
        const r = ev(n.right);
        if (n.op === '/' && r === 0) throw new FormulaError('division by zero', formula);
        return n.op === '+' ? l + r : n.op === '-' ? l - r : n.op === '*' ? l * r : l / r;
      }
      case 'call':
        return FUNCTIONS[/** @type {keyof typeof FUNCTIONS} */ (n.fn)].fn(n.args.map(ev));
    }
  };
  const value = ev(node);
  if (!Number.isFinite(value)) throw new FormulaError('result is not a finite number', formula);
  return value;
}
