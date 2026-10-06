# ADR 0003: Sensitivity lists every tied driver with its signed change

- **Status:** Accepted

## Context

The sensitivity pass raises each assumption by 10% and records how much each headline estimate
changes. A first version reported the single biggest driver per estimate. In practice most
estimates are products of several inputs, so all of them change the result by exactly 10%; picking
one (alphabetically) made the table look informative while hiding that the others matter equally.
Inputs in a denominator (headroom, node capacity) lower the estimate, which a single "+10%" column
also hid. Rounded values such as a key length or a server count often do not move at all.

## Decision

For each headline estimate, list every assumption whose effect ties for the largest magnitude, each
with its own signed change (for example `headroom -10.0%`). If no single 10% change moves the
estimate, say so explicitly ("a rounded or step value"). Definitions such as seconds per day are
never varied.

## Consequences

- The tables say what is true: for the URL shortener, database nodes are driven equally by users,
  links per user, record size, replicas and retention, and inversely by headroom and node size.
- Rows can be long when many inputs tie; that is still more useful than a misleading single name.
- Step values are visible as such, which is itself a design signal (for example, the key length
  stays at 6 characters until growth exceeds about 1.6 times the plan).
