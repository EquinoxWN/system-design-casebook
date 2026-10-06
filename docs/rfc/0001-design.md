# RFC 0001: system-design-casebook design

- **Status:** Accepted (M1 implemented)
- **Author:** EquinoxWN
- **Created:** 2026

## Problem

System-design answers in interviews and design reviews are often hand-waving: "we'll need a lot
of servers", "a cache will help". The useful answers rest on numbers: how many requests per
second at peak, how much storage after five years, whether the bottleneck is connections, disk or
memory. Those numbers are usually done once on a whiteboard, with hidden assumptions and
arithmetic mistakes, and nobody can change an assumption and see what follows. This casebook
makes the estimates reproducible: every case states its assumptions with a reason, computes its
estimates with formulas anyone can read and change, and (in later milestones) proves the critical
path with a small prototype measured against the estimate.

## Goals

- Twelve classic problems, each starting with functional and non-functional requirements and
  explicit assumptions (users, rates, sizes), each with a one-line reason.
- A capacity calculator in JavaScript turns assumptions into estimates using formulas stored in the
  case files, so an estimate can be re-run with different numbers ("what if users double?").
- A sensitivity pass shows which assumptions move each headline estimate, so reviews argue about the
  numbers that matter.
- The generated part of each case document (requirements, assumptions, estimates, drivers) is
  rebuilt from the case file and checked in CI, so docs and numbers cannot drift; a hand-written
  section explains what the numbers imply for the design.
- A Java implementation recomputes every case from the same files and must agree with the
  JavaScript results, so the Java and Node.js prototypes in M2 share one set of estimates.
- Later: an architecture with at least two alternatives per case and prototypes of the critical
  path (M2), k6 measurements compared with the estimates, failure modes and cost (M3).

## Non-goals

- A general spreadsheet: the formula language is deliberately tiny.
- Precision: estimates are orders of magnitude with stated assumptions, not forecasts.
- Cloud cost modelling beyond the few per-unit prices a case needs (SMS and email).

## Proposed design

![architecture](../architecture.png)

```
cases/defaults.json ─┐
cases/<case>.json  ──┴─► JS calculator ─► estimates ─┬─► docs/cases/<case>.md (generated section, CI-checked)
  requirements          (parse formulas,              ├─► sensitivity table (each input +10%)
  assumptions + why      compute in order)            ├─► CLI: show, what-if overrides
  derived formulas                                    └─► cases/expected/<case>.json ─► Java must match (1e-12)
```

| Part | M1 implementation |
|---|---|
| Case files | JSON: requirements, assumptions (`value`, `unit`, `why`), ordered derived formulas with labels and units, headline estimates; shared defaults (peak factor 3, 70% headroom, 3 replicas) |
| Formula language | Numbers, names, `+ - * /`, parentheses, `ceil floor round min max log(x, base)`; a recursive-descent parser in each language, never `eval` |
| Validation | Names, units from a fixed list, a reason for every assumption, each formula only uses names defined earlier, headline estimates exist |
| Formatting | Three significant digits with SI units (K/M/B/T, KB to EB, bps to Tbps, dollars per day) |
| Sensitivity | Each non-definitional assumption raised by 10%; all assumptions tied for the largest effect are listed with their signed change; step values that do not move are reported as such |
| Docs | Generated section between markers, rebuilt by `make docs`, checked by `make lint`; hand-written "What the numbers say" kept after it |
| Java | `Formula` and `CaseModel` (Jackson 3) recompute every case; `log` uses `StrictMath` to match JavaScript |

The twelve cases: URL shortener, pastebin, distributed rate limiter, news feed, chat, notification
service, web crawler, search typeahead, ride hailing, video streaming, file sync, metrics
monitoring.

## Alternatives considered

| Option | Why not (yet) |
|---|---|
| Spreadsheets per case | Familiar, but formulas hide in cells, diffs are unreadable in review, and nothing checks that the doc quotes the current numbers. |
| Formulas as JavaScript code per case | Most flexible, but then case files are code that must be trusted and reviewed as such, and Java could not read them. A tiny parsed language keeps cases as data. See ADR 0002. |
| Only one implementation (JavaScript) | Simpler, but the M2 prototypes are in Java and Node.js; a cross-check guarantees both use the same numbers and catches calculator bugs in either. |
| Monte Carlo ranges instead of point estimates | Better for real capacity planning, but harder to discuss in a design review; the sensitivity table shows the main uncertainty cheaply. Ranges could come later. |
| Report one "biggest driver" per estimate | Misleading: in a product every input moves the result by the same 10%. All tied drivers are listed with signed changes. See ADR 0003. |

## Measurement plan

- M1: 19 JavaScript tests (formula language and its error cases, case validation, worked values,
  what-if overrides, formatting, sensitivity, docs generation and staleness, CLI) and 23 Java tests
  (formula language, and every estimate of all twelve cases matching JavaScript to 1e-12).
  `make lint` fails if a case file changed without regenerating docs and expected values.
- M2: a prototype of each case's critical path measured with k6; the doc compares measured numbers
  with the estimates.
- M3: failure modes, scaling limits and a cost estimate per case.

## Milestones

- **M1 (done):** twelve cases with requirements and reasoned assumptions, calculator, sensitivity,
  generated and hand-written docs, Java cross-check, 42 tests.
- **M2:** architecture with at least two alternatives per case; prototypes (Java with Spring Boot,
  Node.js) of the critical paths; k6 measurements against the estimates.
- **M3:** failure modes, limits and cost per case, in the format of a staff-level design review.

## Risks and open questions

- Assumptions can be argued forever; each carries a reason so a reviewer can disagree with a
  specific line, and the CLI shows the effect of their alternative immediately.
- Simple linear models ignore effects such as cache hit rates changing with size, or contention;
  the M2 prototypes exist to show where the linear estimate breaks.
- The sensitivity pass varies one assumption at a time; correlated assumptions (more users and more
  posts per user) are not modelled.
