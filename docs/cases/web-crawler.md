# Web crawler

<!-- generated from cases/web-crawler.json by `npm run docs`: do not edit by hand -->

> Fetch and store a billion web pages a month while being polite to every site.

## Requirements

**Functional**

- Fetch pages from a frontier of URLs
- Extract links and add new URLs to the frontier
- Skip duplicates and respect robots.txt and per-host limits

**Non-functional**

- At most one request per second per host
- Resume after crashes without refetching everything
- Detect duplicate content

## Assumptions

| Assumption | Value | Why |
|---|---|---|
| `seconds_per_day` | 86400 s | Definition. |
| `days_per_year` | 365 | Definition. |
| `peak_to_average` | 3 | Daily traffic peaks at roughly 2 to 3 times its average for consumer products; 3 is the conservative end. |
| `headroom` | 0.7 | Plan to run servers at 70% of measured capacity so one failure or a spike does not overload the rest. |
| `replication_factor` | 3 | Three copies survive one lost node during maintenance of another, the common default for databases and object stores. |
| `pages_per_month` | 1B | The target crawl rate. |
| `days_per_month` | 30 | Planning month. |
| `page_bytes` | 100 KB | Average HTML page around 100 KB. |
| `fetch_seconds` | 1.5 s | DNS, connect, TLS and download for an average page. |
| `duplicate_fraction` | 0.3 | Mirrors, tracking parameters and near-copies; not stored twice. |
| `retention_months` | 12 | Keep a year of snapshots. |
| `fetches_per_server` | 500 | Concurrent asynchronous fetches one crawler node handles. |

## Estimates

| Estimate | Value | Formula |
|---|---|---|
| **Pages fetched per second** | 386/s | `pages_per_month / (days_per_month * seconds_per_day)` |
| **Download bandwidth** | 309 Mbps | `pages_per_second * page_bytes * 8` |
| **Fetches in flight (Little's law)** | 579 | `pages_per_second * fetch_seconds` |
| Crawler servers | 2 servers | `ceil(concurrent_fetches / (fetches_per_server * headroom))` |
| New page storage per month, with replicas | 210 TB | `pages_per_month * (1 - duplicate_fraction) * page_bytes * replication_factor` |
| **Page storage for the retention period** | 2.52 PB | `storage_per_month * retention_months` |

## What moves the numbers

Each assumption raised by 10% in turn; the ones that change each headline estimate most, with the
change each causes:

| Estimate | Biggest drivers |
|---|---|
| Pages fetched per second | `pages_per_month` +10.0% |
| Download bandwidth | `page_bytes` +10.0%, `pages_per_month` +10.0% |
| Fetches in flight (Little's law) | `fetch_seconds` +10.0%, `pages_per_month` +10.0% |
| Page storage for the retention period | `page_bytes` +10.0%, `pages_per_month` +10.0%, `replication_factor` +10.0%, `retention_months` +10.0% |

<!-- end of generated section -->

## What the numbers say

A billion pages a month is only 386 pages per second and about 309 Mbps of download, which sounds small, but Little's law gives the real constraint: at 1.5 s per fetch, 579 fetches are in flight at once, and politeness (one request per second per host) means they must be spread over hundreds of different hosts at every moment. So the frontier must be organised by host, with per-host queues and timers, rather than as one global queue. Storage reaches 2.5 PB for a year of snapshots even after removing duplicates, which is why near-duplicate detection pays for itself.

Next (M2): prototype a per-host frontier and measure throughput while honouring the per-host delay.
