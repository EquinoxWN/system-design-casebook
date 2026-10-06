# Ride hailing (driver matching)

<!-- generated from cases/ride-hailing.json by `npm run docs`: do not edit by hand -->

> Track drivers' locations and match each ride request to a nearby available driver.

## Requirements

**Functional**

- Drivers report their location every few seconds
- Riders request a ride and get the nearest suitable driver
- Track the trip in real time

**Non-functional**

- Match within 2 seconds
- Location shown to riders is at most a few seconds old
- No driver is offered two rides at once

## Assumptions

| Assumption | Value | Why |
|---|---|---|
| `seconds_per_day` | 86400 s | Definition. |
| `days_per_year` | 365 | Definition. |
| `peak_to_average` | 3 | Daily traffic peaks at roughly 2 to 3 times its average for consumer products; 3 is the conservative end. |
| `headroom` | 0.7 | Plan to run servers at 70% of measured capacity so one failure or a spike does not overload the rest. |
| `replication_factor` | 3 | Three copies survive one lost node during maintenance of another, the common default for databases and object stores. |
| `drivers_online_peak` | 1M | Drivers online at the busiest moment globally. |
| `location_interval_seconds` | 4 s | Each driver app sends a location every 4 s. |
| `location_bytes` | 100 B | Driver id, coordinates, heading, speed and timestamp. |
| `rides_per_day` | 20M/day | A large ride-hailing company. |
| `searches_per_ride` | 3 | Nearby-driver searches per request, including retries and ETA refreshes. |
| `geo_index_replicas` | 3 | In-memory geo index copies per region for availability. |

## Estimates

| Estimate | Value | Formula |
|---|---|---|
| **Location updates per second at peak** | 250K/s | `drivers_online_peak / location_interval_seconds` |
| Location ingest bandwidth | 25 MB/s | `location_updates_per_second * location_bytes` |
| **Live geo index memory, with replicas** | 300 MB | `drivers_online_peak * location_bytes * geo_index_replicas` |
| **Nearby searches per second at peak** | 2.08K/s | `rides_per_day * searches_per_ride / seconds_per_day * peak_to_average` |
| **Location history per day if every update is kept** | 720 GB | `location_updates_per_second / peak_to_average * seconds_per_day * location_bytes` |

## What moves the numbers

Each assumption raised by 10% in turn; the ones that change each headline estimate most, with the
change each causes:

| Estimate | Biggest drivers |
|---|---|
| Location updates per second at peak | `drivers_online_peak` +10.0% |
| Live geo index memory, with replicas | `drivers_online_peak` +10.0%, `geo_index_replicas` +10.0%, `location_bytes` +10.0% |
| Nearby searches per second at peak | `peak_to_average` +10.0%, `rides_per_day` +10.0%, `searches_per_ride` +10.0% |
| Location history per day if every update is kept | `drivers_online_peak` +10.0%, `location_bytes` +10.0% |

<!-- end of generated section -->

## What the numbers say

This system is write-heavy with tiny state: a million online drivers reporting every 4 s produce 250K location updates per second, but the live index of where every driver is takes only 300 MB even with three replicas. That makes an in-memory geo index (geohash or H3 cells) the obvious store, updated in place, with nearby searches (2.1K per second at peak) served from memory. Keeping every update as history would add 720 GB a day, so history is sampled or batched to cold storage rather than written to the live index's database.

Next (M2): prototype a cell-based index and measure nearby-search latency while ingesting 250K updates per second.
