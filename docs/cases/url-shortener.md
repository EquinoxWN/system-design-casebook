# URL shortener

<!-- generated from cases/url-shortener.json by `npm run docs`: do not edit by hand -->

> Turn long URLs into short links and redirect anyone who opens one.

## Requirements

**Functional**

- Create a short link for a long URL, optionally with a custom alias
- Redirect a short link to its long URL
- Links expire after the retention period

**Non-functional**

- Redirect p99 latency under 50 ms
- 99.99% availability for redirects (writes may degrade first)
- Short links are not guessable in order

## Assumptions

| Assumption | Value | Why |
|---|---|---|
| `seconds_per_day` | 86400 s | Definition. |
| `days_per_year` | 365 | Definition. |
| `peak_to_average` | 3 | Daily traffic peaks at roughly 2 to 3 times its average for consumer products; 3 is the conservative end. |
| `headroom` | 0.7 | Plan to run servers at 70% of measured capacity so one failure or a spike does not overload the rest. |
| `replication_factor` | 3 | Three copies survive one lost node during maintenance of another, the common default for databases and object stores. |
| `daily_active_users` | 100M | A large consumer service; Bitly-scale products create links for a small fraction of users daily. |
| `links_per_user_per_day` | 0.1 | Most users only click links; one in ten creates one per day. |
| `reads_per_write` | 100 | Shared links are opened far more often than created; 100:1 is the usual planning ratio. |
| `record_bytes` | 500 B | Long URL (about 100 to 200 bytes) plus key, owner, timestamps and indexes. |
| `redirect_response_bytes` | 500 B | A 301 response with headers. |
| `retention_years` | 10 | Links printed on paper must keep working for years. |
| `cache_hot_fraction` | 0.2 | 80/20 rule: a fifth of the day's requests cover most hot links (an upper bound, since requests repeat). |
| `server_rps` | 20K/s | A key lookup served from cache needs little CPU; 20k requests/s per node is typical for a small Go or Java service. |
| `node_storage_bytes` | 2 TB | 2 TB of usable SSD per database node. |

## Estimates

| Estimate | Value | Formula |
|---|---|---|
| New links per day | 10M/day | `daily_active_users * links_per_user_per_day` |
| Redirects per day | 1B/day | `writes_per_day * reads_per_write` |
| Link creations per second (average) | 116/s | `writes_per_day / seconds_per_day` |
| **Redirects per second at peak** | 34.7K/s | `redirects_per_day / seconds_per_day * peak_to_average` |
| Links stored after the retention period | 36.5B | `writes_per_day * days_per_year * retention_years` |
| **Base62 key length needed** | 6 chars | `ceil(log(links_total, 62))` |
| **Database storage with replicas** | 54.8 TB | `links_total * record_bytes * replication_factor` |
| Redirect bandwidth at peak | 17.4 MB/s | `peak_redirect_qps * redirect_response_bytes` |
| **Cache for the hot 20% of a day's redirects** | 100 GB | `redirects_per_day * cache_hot_fraction * record_bytes` |
| **Redirect servers** | 3 servers | `ceil(peak_redirect_qps * (1 + 1 / reads_per_write) / (server_rps * headroom))` |
| **Database nodes for storage** | 40 nodes | `ceil(storage_total / (node_storage_bytes * headroom))` |

## What moves the numbers

Each assumption raised by 10% in turn; the ones that change each headline estimate most, with the
change each causes:

| Estimate | Biggest drivers |
|---|---|
| Redirects per second at peak | `daily_active_users` +10.0%, `links_per_user_per_day` +10.0%, `peak_to_average` +10.0%, `reads_per_write` +10.0% |
| Base62 key length needed | none: no single +10% change moves it (a rounded or step value) |
| Database storage with replicas | `daily_active_users` +10.0%, `links_per_user_per_day` +10.0%, `record_bytes` +10.0%, `replication_factor` +10.0%, `retention_years` +10.0% |
| Cache for the hot 20% of a day's redirects | `cache_hot_fraction` +10.0%, `daily_active_users` +10.0%, `links_per_user_per_day` +10.0%, `reads_per_write` +10.0%, `record_bytes` +10.0% |
| Redirect servers | none: no single +10% change moves it (a rounded or step value) |
| Database nodes for storage | `daily_active_users` +10.0%, `headroom` -10.0%, `links_per_user_per_day` +10.0%, `node_storage_bytes` -10.0%, `record_bytes` +10.0%, `replication_factor` +10.0%, `retention_years` +10.0% |

<!-- end of generated section -->

## What the numbers say

Redirect traffic is easy: 34.7K requests per second at peak fits on 3 small servers, and the whole hot set (100 GB, an upper bound) fits in one cache cluster. What grows without limit is storage: 36.5 billion links over ten years is about 55 TB with replicas, so the database is sized by disk (40 nodes), not by queries. A 6-character base62 key covers 56.8 billion codes, so 36.5 billion links fit, but with only 1.6x headroom: if growth beats the plan, 7 characters (3.5 trillion codes) is the safe choice, and generating keys from a counter or a pre-allocated key range avoids collision checks on every write.

Next (M2): compare two key-generation schemes (hash and truncate vs counter ranges) and measure redirect latency of the prototype against the 50 ms p99 target.
