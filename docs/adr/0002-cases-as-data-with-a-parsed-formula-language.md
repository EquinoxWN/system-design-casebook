# ADR 0002: Cases are data, with formulas in a tiny parsed language computed in two languages

- **Status:** Accepted

## Context

Each case needs its own derived quantities (key length for a URL shortener, concurrent fetches for a
crawler, SMS cost for notifications), so a fixed set of built-in formulas is not enough. Writing
each case's maths as JavaScript functions would work, but case files would then be code: they
could do anything when loaded, a reviewer must read them as code, and the Java side could not use
them. The M2 prototypes are in both Java and Node.js and must start from the same estimates.

## Decision

Case files are JSON. Every derived estimate is a formula string in a deliberately tiny language:
numbers, names, the four operators, parentheses and six functions (`ceil`, `floor`, `round`, `min`,
`max`, `log`). Both implementations parse formulas with a recursive-descent parser and evaluate the
tree; nothing is ever passed to `eval`. Formulas are evaluated in file order and may only use names
defined before them, which makes cycles impossible. The JavaScript calculator writes every result
at full precision to `cases/expected/`, and a Java test recomputes all cases and must match to a
relative error of 1e-12 (`log` uses `StrictMath` so the two agree).

## Consequences

- A new case or a changed assumption is a data change that anyone can review line by line, and
  `make lint` fails until the generated docs and expected values are regenerated.
- Malicious or broken formulas (`process.exit(1)`, `sqrt(4)`, division by zero, non-finite results)
  fail with a clear error in both languages; tests cover each.
- Some quantities are awkward to express (no conditionals, no exponent operator); that keeps
  formulas readable, and so far no case has needed more.
