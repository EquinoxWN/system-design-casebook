# Pastebin

<!-- generated from cases/pastebin.json by `npm run docs`: do not edit by hand -->

> Store text snippets and serve them back by an unguessable link.

## Requirements

**Functional**

- Upload a text paste and get a link
- Read a paste by link
- Pastes can expire; expired pastes are deleted

**Non-functional**

- Read p99 under 200 ms
- Pastes are durable once acknowledged
- Links cannot be enumerated

## Assumptions

| Assumption | Value | Why |
|---|---|---|
| `seconds_per_day` | 86400 s | Definition. |
| `days_per_year` | 365 | Definition. |
| `peak_to_average` | 3 | Daily traffic peaks at roughly 2 to 3 times its average for consumer products; 3 is the conservative end. |
| `headroom` | 0.7 | Plan to run servers at 70% of measured capacity so one failure or a spike does not overload the rest. |
| `replication_factor` | 3 | Three copies survive one lost node during maintenance of another, the common default for databases and object stores. |
| `daily_active_users` | 10M | A popular developer tool. |
| `pastes_per_user_per_day` | 0.1 | Most visitors read; one in ten pastes something. |
| `paste_bytes` | 10 KB | Logs and code snippets average around 10 KB. |
| `metadata_bytes` | 200 B | Key, owner, expiry, size and object location. |
| `reads_per_write` | 5 | Pastes are shared with a few people, not broadcast. |
| `retention_years` | 10 | Keep non-expiring pastes for ten years. |
| `server_rps` | 5K/s | Serving 10 KB bodies from object storage through an app server. |

## Estimates

| Estimate | Value | Formula |
|---|---|---|
| New pastes per day | 1M/day | `daily_active_users * pastes_per_user_per_day` |
| Uploads per second (average) | 11.6/s | `writes_per_day / seconds_per_day` |
| **Reads per second at peak** | 174/s | `writes_per_day * reads_per_write / seconds_per_day * peak_to_average` |
| **Paste bodies in object storage, with replicas** | 110 TB | `writes_per_day * days_per_year * retention_years * paste_bytes * replication_factor` |
| **Metadata database, with replicas** | 2.19 TB | `writes_per_day * days_per_year * retention_years * metadata_bytes * replication_factor` |
| **Read bandwidth at peak** | 1.74 MB/s | `peak_read_qps * paste_bytes` |
| **App servers** | 1 server | `ceil(peak_read_qps * (1 + 1 / reads_per_write) / (server_rps * headroom))` |

## What moves the numbers

Each assumption raised by 10% in turn; the ones that change each headline estimate most, with the
change each causes:

| Estimate | Biggest drivers |
|---|---|
| Reads per second at peak | `daily_active_users` +10.0%, `pastes_per_user_per_day` +10.0%, `peak_to_average` +10.0%, `reads_per_write` +10.0% |
| Paste bodies in object storage, with replicas | `daily_active_users` +10.0%, `paste_bytes` +10.0%, `pastes_per_user_per_day` +10.0%, `replication_factor` +10.0%, `retention_years` +10.0% |
| Metadata database, with replicas | `daily_active_users` +10.0%, `metadata_bytes` +10.0%, `pastes_per_user_per_day` +10.0%, `replication_factor` +10.0%, `retention_years` +10.0% |
| Read bandwidth at peak | `daily_active_users` +10.0%, `paste_bytes` +10.0%, `pastes_per_user_per_day` +10.0%, `peak_to_average` +10.0%, `reads_per_write` +10.0% |
| App servers | none: no single +10% change moves it (a rounded or step value) |

<!-- end of generated section -->

## What the numbers say

Traffic is negligible: 174 reads per second at peak runs on a single server, and peak egress is under 2 MB/s. The real system is storage: 110 TB of paste bodies after ten years. That points to object storage for bodies (cheap, durable, served through a CDN) and a small metadata database (2.2 TB with replicas) for keys and expiry. Expiry should delete from both, which makes the cleanup job, not the request path, the part that needs care.

Next (M2): prototype upload and read with an object store and measure how many reads a CDN absorbs.
