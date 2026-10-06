# Distributed rate limiter

<!-- generated from cases/rate-limiter.json by `npm run docs`: do not edit by hand -->

> Limit how many requests each client may make, consistently across a fleet of API gateways.

## Requirements

**Functional**

- Allow or reject each request by client key and rule
- Rules per key: N requests per window, with bursts
- Return remaining quota and retry-after

**Non-functional**

- Adds under 5 ms p99 to each request
- Fails open if the counter store is down (availability over strictness)
- Accurate within a few percent across the fleet

## Assumptions

| Assumption | Value | Why |
|---|---|---|
| `seconds_per_day` | 86400 s | Definition. |
| `days_per_year` | 365 | Definition. |
| `peak_to_average` | 3 | Daily traffic peaks at roughly 2 to 3 times its average for consumer products; 3 is the conservative end. |
| `headroom` | 0.7 | Plan to run servers at 70% of measured capacity so one failure or a spike does not overload the rest. |
| `replication_factor` | 2 | Counters are cheap to lose; one replica per shard is enough. |
| `api_requests_per_day` | 5B/day | A large public API across all clients. |
| `active_keys` | 20M | Users, API tokens and IP addresses seen in a window. |
| `bytes_per_key` | 100 B | Sliding-window counter: key, two counters and expiry, plus store overhead. |
| `store_ops_per_check` | 1 | One atomic script call (read, increment, expire) per request. |
| `store_ops_per_node` | 100K/s | Measured order of magnitude for one Redis or Valkey shard with small scripts. |

## Estimates

| Estimate | Value | Formula |
|---|---|---|
| Requests per second (average) | 57.9K/s | `api_requests_per_day / seconds_per_day` |
| **Requests per second at peak** | 174K/s | `request_qps * peak_to_average` |
| **Counter memory, with replicas** | 4 GB | `active_keys * bytes_per_key * replication_factor` |
| **Counter-store operations per second at peak** | 174K/s | `peak_qps * store_ops_per_check` |
| **Counter-store shards** | 3 nodes | `ceil(store_ops / (store_ops_per_node * headroom))` |

## What moves the numbers

Each assumption raised by 10% in turn; the ones that change each headline estimate most, with the
change each causes:

| Estimate | Biggest drivers |
|---|---|
| Requests per second at peak | `api_requests_per_day` +10.0%, `peak_to_average` +10.0% |
| Counter memory, with replicas | `active_keys` +10.0%, `bytes_per_key` +10.0%, `replication_factor` +10.0% |
| Counter-store operations per second at peak | `api_requests_per_day` +10.0%, `peak_to_average` +10.0%, `store_ops_per_check` +10.0% |
| Counter-store shards | none: no single +10% change moves it (a rounded or step value) |

<!-- end of generated section -->

## What the numbers say

Memory is not the problem: counters for 20 million active keys take 4 GB even with a replica. Throughput is: 174K checks per second at peak, each a round trip to the counter store, needs 3 shards at 70% of 100K operations per second. Two design consequences follow. The limiter must add very little latency per request, so a check must be one atomic script call, not a read followed by a write. And if the counter store is down, the gateway must fail open (allow traffic) rather than reject every request, which is a product decision the requirements state explicitly.

Next (M2): compare a central counter store with local token buckets plus periodic sync, measuring accuracy and added latency.
