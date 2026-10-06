# Metrics monitoring

<!-- generated from cases/metrics-monitoring.json by `npm run docs`: do not edit by hand -->

> Collect time series from a large fleet, store them, and evaluate alerts.

## Requirements

**Functional**

- Scrape or receive metrics from every host
- Query recent and historical series
- Evaluate alert rules every few seconds

**Non-functional**

- Alert evaluation delay under 30 s
- No data loss during a single node failure
- Queries over the last hour return in under a second

## Assumptions

| Assumption | Value | Why |
|---|---|---|
| `seconds_per_day` | 86400 s | Definition. |
| `days_per_year` | 365 | Definition. |
| `peak_to_average` | 3 | Daily traffic peaks at roughly 2 to 3 times its average for consumer products; 3 is the conservative end. |
| `headroom` | 0.7 | Plan to run servers at 70% of measured capacity so one failure or a spike does not overload the rest. |
| `replication_factor` | 2 | Two ingesters receive every series. |
| `hosts` | 100K | Machines and containers in the fleet. |
| `metrics_per_host` | 1K | Series per host across system and application metrics. |
| `scrape_interval_seconds` | 15 s | The usual Prometheus scrape interval. |
| `bytes_per_sample` | 1.37 B | Gorilla-style compression of timestamp and value. |
| `memory_per_series` | 4 KB | In-memory head block, labels and index per active series. |
| `retention_days` | 30 | Raw samples kept for a month; older data is downsampled. |
| `node_memory_bytes` | 64 GB | 64 GB of RAM per ingester. |

## Estimates

| Estimate | Value | Formula |
|---|---|---|
| **Samples ingested per second** | 6.67M/s | `hosts * metrics_per_host / scrape_interval_seconds` |
| **Active series** | 100M | `hosts * metrics_per_host` |
| Compressed samples per day | 789 GB | `samples_per_second * seconds_per_day * bytes_per_sample` |
| **Storage for the retention period, with replicas** | 47.3 TB | `storage_per_day * retention_days * replication_factor` |
| **Ingester nodes (memory-bound)** | 18 nodes | `ceil(active_series * memory_per_series * replication_factor / (node_memory_bytes * headroom))` |

## What moves the numbers

Each assumption raised by 10% in turn; the ones that change each headline estimate most, with the
change each causes:

| Estimate | Biggest drivers |
|---|---|
| Samples ingested per second | `hosts` +10.0%, `metrics_per_host` +10.0% |
| Active series | `hosts` +10.0%, `metrics_per_host` +10.0% |
| Storage for the retention period, with replicas | `bytes_per_sample` +10.0%, `hosts` +10.0%, `metrics_per_host` +10.0%, `replication_factor` +10.0%, `retention_days` +10.0% |
| Ingester nodes (memory-bound) | `hosts` +11.1%, `memory_per_series` +11.1%, `metrics_per_host` +11.1%, `replication_factor` +11.1% |

<!-- end of generated section -->

## What the numbers say

6.67 million samples per second sounds daunting, but compressed to 1.37 bytes each it is only 789 GB a day and 47 TB for a month with two replicas. The binding constraint is memory: 100 million active series at about 4 KB each need 18 ingesters with 64 GB of RAM, and series count grows with every new label value. That is why limiting label cardinality (no user ids or request ids as labels) matters more than raw sample volume, and why the design keeps recent data in memory and older data downsampled in object storage.

Next (M2): prototype an ingester and measure memory per series and query latency over the last hour.
