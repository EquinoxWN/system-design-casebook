# Chat and messaging

<!-- generated from cases/chat.json by `npm run docs`: do not edit by hand -->

> One-to-one and small group messaging with delivery to online devices in real time.

## Requirements

**Functional**

- Send a message to a person or group
- Deliver instantly to online devices, later to offline ones
- Show delivered and read receipts

**Non-functional**

- Delivery p99 under 300 ms between online users
- Messages are never lost once acknowledged
- Ordered per conversation

## Assumptions

| Assumption | Value | Why |
|---|---|---|
| `seconds_per_day` | 86400 s | Definition. |
| `days_per_year` | 365 | Definition. |
| `peak_to_average` | 3 | Daily traffic peaks at roughly 2 to 3 times its average for consumer products; 3 is the conservative end. |
| `headroom` | 0.7 | Plan to run servers at 70% of measured capacity so one failure or a spike does not overload the rest. |
| `replication_factor` | 3 | Three copies survive one lost node during maintenance of another, the common default for databases and object stores. |
| `daily_active_users` | 500M | A global messaging app. |
| `messages_per_user_per_day` | 40 | Active chat users send dozens of messages a day. |
| `message_bytes` | 200 B | About 100 bytes of text plus ids, timestamps and encryption overhead. |
| `online_fraction` | 0.2 | Share of daily users connected at the same moment at peak. |
| `connections_per_server` | 100K connections | Long-lived WebSocket connections per gateway with an event loop. |
| `retention_years` | 1 | Server keeps undelivered and recent history for one year. |

## Estimates

| Estimate | Value | Formula |
|---|---|---|
| Messages per day | 20B/day | `daily_active_users * messages_per_user_per_day` |
| **Messages per second at peak** | 694K/s | `messages_per_day / seconds_per_day * peak_to_average` |
| **Concurrent connections at peak** | 100M connections | `daily_active_users * online_fraction` |
| **Connection gateway servers** | 1,429 servers | `ceil(concurrent_connections / (connections_per_server * headroom))` |
| Message storage per day | 4 TB | `messages_per_day * message_bytes` |
| **Message storage for the retention period, with replicas** | 4.38 PB | `storage_per_day * days_per_year * retention_years * replication_factor` |
| Message bandwidth at peak (in and out) | 278 MB/s | `peak_message_qps * message_bytes * 2` |

## What moves the numbers

Each assumption raised by 10% in turn; the ones that change each headline estimate most, with the
change each causes:

| Estimate | Biggest drivers |
|---|---|
| Concurrent connections at peak | `daily_active_users` +10.0%, `online_fraction` +10.0% |
| Connection gateway servers | `daily_active_users` +10.0%, `online_fraction` +10.0% |
| Messages per second at peak | `daily_active_users` +10.0%, `messages_per_user_per_day` +10.0%, `peak_to_average` +10.0% |
| Message storage for the retention period, with replicas | `daily_active_users` +10.0%, `message_bytes` +10.0%, `messages_per_user_per_day` +10.0%, `replication_factor` +10.0%, `retention_years` +10.0% |

<!-- end of generated section -->

## What the numbers say

Messages are not what sizes this system; connections are. 100 million devices online at peak need 1,429 gateway servers just to hold WebSocket connections, while the 694K messages per second at peak are only 278 MB/s of traffic. Storage is large (4.4 PB for a year with replicas), so the design keeps undelivered messages and short history hot and moves the rest to cheaper storage. Routing a message means finding which gateway holds the recipient's connection, so a presence or session directory is on the critical path of every delivery.

Next (M2): prototype a gateway and measure connections per server and delivery latency, checking the 100K connections per server assumption.
