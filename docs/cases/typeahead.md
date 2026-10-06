# Search typeahead

<!-- generated from cases/typeahead.json by `npm run docs`: do not edit by hand -->

> Suggest the most popular completions while a user types a search query.

## Requirements

**Functional**

- Return the top 10 completions for a prefix
- Rank by recent popularity
- Update rankings from new searches within hours

**Non-functional**

- p99 under 100 ms, since a request goes out on every keystroke
- Suggestions may be slightly stale
- No offensive completions

## Assumptions

| Assumption | Value | Why |
|---|---|---|
| `seconds_per_day` | 86400 s | Definition. |
| `days_per_year` | 365 | Definition. |
| `peak_to_average` | 3 | Daily traffic peaks at roughly 2 to 3 times its average for consumer products; 3 is the conservative end. |
| `headroom` | 0.7 | Plan to run servers at 70% of measured capacity so one failure or a spike does not overload the rest. |
| `replication_factor` | 3 | Three copies survive one lost node during maintenance of another, the common default for databases and object stores. |
| `daily_active_users` | 500M | A major search engine. |
| `searches_per_user_per_day` | 5 | Typical searches per user per day. |
| `keystrokes_per_search` | 8 | About eight characters typed before choosing a suggestion. |
| `debounce_ratio` | 0.5 | Clients wait 100 ms between keystrokes, halving requests. |
| `unique_queries` | 100M | Distinct queries worth suggesting after filtering rare ones. |
| `prefixes_per_query` | 20 | Average query length, each prefix storing its top 10. |
| `bytes_per_prefix_entry` | 50 B | Prefix node plus pointers to its top 10 completions. |
| `server_rps` | 50K/s | In-memory prefix lookup per node. |

## Estimates

| Estimate | Value | Formula |
|---|---|---|
| Suggestion requests per day | 10B/day | `daily_active_users * searches_per_user_per_day * keystrokes_per_search * debounce_ratio` |
| **Suggestion requests per second at peak** | 347K/s | `requests_per_day / seconds_per_day * peak_to_average` |
| **Prefix index in memory (one copy)** | 100 GB | `unique_queries * prefixes_per_query * bytes_per_prefix_entry` |
| **Suggestion servers** | 10 servers | `ceil(peak_qps / (server_rps * headroom))` |

## What moves the numbers

Each assumption raised by 10% in turn; the ones that change each headline estimate most, with the
change each causes:

| Estimate | Biggest drivers |
|---|---|
| Suggestion requests per second at peak | `daily_active_users` +10.0%, `debounce_ratio` +10.0%, `keystrokes_per_search` +10.0%, `peak_to_average` +10.0%, `searches_per_user_per_day` +10.0% |
| Prefix index in memory (one copy) | `bytes_per_prefix_entry` +10.0%, `prefixes_per_query` +10.0%, `unique_queries` +10.0% |
| Suggestion servers | `daily_active_users` +10.0%, `debounce_ratio` +10.0%, `keystrokes_per_search` +10.0%, `peak_to_average` +10.0%, `searches_per_user_per_day` +10.0% |

<!-- end of generated section -->

## What the numbers say

A request on every keystroke turns 2.5 billion searches a day into 10 billion suggestion requests (after halving with a debounce), 347K per second at peak. The index itself is modest, 100 GB for 100 million queries with their prefixes, so it fits in memory, replicated on each of 10 servers rather than sharded. The latency budget (100 ms including the network) leaves no room for disk or a database call per keystroke, which is the numerical argument for precomputed top-10 lists per prefix.

Next (M2): prototype a prefix index with precomputed top-k and measure p99 lookup latency.
