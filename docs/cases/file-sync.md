# File sync and storage

<!-- generated from cases/file-sync.json by `npm run docs`: do not edit by hand -->

> Keep users' files in sync across devices and store them durably.

## Requirements

**Functional**

- Upload, download and sync files across devices
- Only changed blocks are uploaded
- Version history and restore

**Non-functional**

- Durability of eleven nines
- A change reaches other online devices within seconds
- Deduplicate identical blocks across users

## Assumptions

| Assumption | Value | Why |
|---|---|---|
| `seconds_per_day` | 86400 s | Definition. |
| `days_per_year` | 365 | Definition. |
| `peak_to_average` | 3 | Daily traffic peaks at roughly 2 to 3 times its average for consumer products; 3 is the conservative end. |
| `headroom` | 0.7 | Plan to run servers at 70% of measured capacity so one failure or a spike does not overload the rest. |
| `replication_factor` | 3 | Three copies survive one lost node during maintenance of another, the common default for databases and object stores. |
| `users` | 500M | Registered users. |
| `daily_active_users` | 100M | A fifth of users sync on a given day. |
| `stored_bytes_per_user` | 2 GB | Average 2 GB per user, most free-tier accounts holding little. |
| `dedupe_savings` | 0.3 | Identical blocks across users (installers, shared documents). |
| `erasure_overhead` | 1.5 | Erasure coding instead of three full copies. |
| `changes_per_user_per_day` | 20 | Files changed per active user per day. |
| `changed_bytes_per_change` | 200 KB | Only changed blocks are sent. |
| `metadata_ops_per_change` | 10 | Block lookups, version writes and notifications per change. |

## Estimates

| Estimate | Value | Formula |
|---|---|---|
| Logical data stored | 1 EB | `users * stored_bytes_per_user` |
| **Physical storage after dedupe and erasure coding** | 1.05 EB | `logical_storage * (1 - dedupe_savings) * erasure_overhead` |
| **Uploaded changes per day** | 400 TB | `daily_active_users * changes_per_user_per_day * changed_bytes_per_change` |
| **Metadata operations per second at peak** | 694K/s | `daily_active_users * changes_per_user_per_day * metadata_ops_per_change / seconds_per_day * peak_to_average` |

## What moves the numbers

Each assumption raised by 10% in turn; the ones that change each headline estimate most, with the
change each causes:

| Estimate | Biggest drivers |
|---|---|
| Physical storage after dedupe and erasure coding | `erasure_overhead` +10.0%, `stored_bytes_per_user` +10.0%, `users` +10.0% |
| Uploaded changes per day | `changed_bytes_per_change` +10.0%, `changes_per_user_per_day` +10.0%, `daily_active_users` +10.0% |
| Metadata operations per second at peak | `changes_per_user_per_day` +10.0%, `daily_active_users` +10.0%, `metadata_ops_per_change` +10.0%, `peak_to_average` +10.0% |

<!-- end of generated section -->

## What the numbers say

Storage dominates: an exabyte of logical data, still 1.05 EB physically after deduplication and erasure coding. Erasure coding (1.5x overhead instead of 3 full copies) saves about half the disks, which at this size is the largest cost decision in the design. Changes are comparatively small (400 TB uploaded a day, thanks to block-level sync), but each change triggers metadata work, 694K operations per second at peak, so the metadata service, not the block store, is the scaling bottleneck.

Next (M2): prototype block-level sync with content hashing and measure upload savings and metadata operations per change.
