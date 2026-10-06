# Notification service

<!-- generated from cases/notifications.json by `npm run docs`: do not edit by hand -->

> Send push, email and SMS notifications for other services, reliably and without duplicates.

## Requirements

**Functional**

- Accept notification requests from internal services
- Deliver by push, email or SMS according to user preferences
- Retry failures and never send the same notification twice

**Non-functional**

- Critical notifications delivered within 30 s
- At-least-once internally, exactly-once to the user through idempotency keys
- Per-user rate limits

## Assumptions

| Assumption | Value | Why |
|---|---|---|
| `seconds_per_day` | 86400 s | Definition. |
| `days_per_year` | 365 | Definition. |
| `peak_to_average` | 3 | Daily traffic peaks at roughly 2 to 3 times its average for consumer products; 3 is the conservative end. |
| `headroom` | 0.7 | Plan to run servers at 70% of measured capacity so one failure or a spike does not overload the rest. |
| `replication_factor` | 3 | Three copies survive one lost node during maintenance of another, the common default for databases and object stores. |
| `notifications_per_day` | 1B/day | 200 million users receiving about five a day. |
| `push_share` | 0.7 | Push is the default channel. |
| `email_share` | 0.25 | Digests and receipts. |
| `sms_share` | 0.05 | Security codes and critical alerts only. |
| `sms_cost_usd` | $0.0075 | Typical bulk price per SMS in the US. |
| `email_cost_usd` | $0.0001 | Typical bulk price per email. |
| `log_bytes` | 1 KB | Request, rendered payload reference and delivery status per notification. |
| `log_retention_days` | 30 | Keep delivery logs for support and audits. |
| `worker_rps` | 2K/s | Sending is latency-bound on external providers, so each worker handles few per second. |

## Estimates

| Estimate | Value | Formula |
|---|---|---|
| **Notifications per second at peak** | 34.7K/s | `notifications_per_day / seconds_per_day * peak_to_average` |
| Push sends per second at peak | 24.3K/s | `peak_qps * push_share` |
| SMS per day | 50M/day | `notifications_per_day * sms_share` |
| **SMS cost per day** | $375K/day | `sms_per_day * sms_cost_usd` |
| **Email cost per day** | $25K/day | `notifications_per_day * email_share * email_cost_usd` |
| **Delivery log storage, with replicas** | 90 TB | `notifications_per_day * log_bytes * log_retention_days * replication_factor` |
| **Sender workers** | 25 servers | `ceil(peak_qps / (worker_rps * headroom))` |

## What moves the numbers

Each assumption raised by 10% in turn; the ones that change each headline estimate most, with the
change each causes:

| Estimate | Biggest drivers |
|---|---|
| Notifications per second at peak | `notifications_per_day` +10.0%, `peak_to_average` +10.0% |
| SMS cost per day | `notifications_per_day` +10.0%, `sms_cost_usd` +10.0%, `sms_share` +10.0% |
| Email cost per day | `email_cost_usd` +10.0%, `email_share` +10.0%, `notifications_per_day` +10.0% |
| Delivery log storage, with replicas | `log_bytes` +10.0%, `log_retention_days` +10.0%, `notifications_per_day` +10.0%, `replication_factor` +10.0% |
| Sender workers | `notifications_per_day` +12.0%, `peak_to_average` +12.0% |

<!-- end of generated section -->

## What the numbers say

The throughput is moderate (34.7K notifications per second at peak, 25 workers) but the cost is not: 50 million SMS a day at $0.0075 each is $375K a day, about $137 million a year, against $25K a day for email. The single most valuable design decision is therefore channel policy: SMS only for security codes and critical alerts, push first for everything else, and user-level de-duplication so a retry never sends a second paid message. Delivery logs for 30 days take 90 TB with replicas, so logs belong in a store with cheap retention, not the primary database.

Next (M2): prototype idempotent delivery with retries and measure duplicates under injected provider failures.
