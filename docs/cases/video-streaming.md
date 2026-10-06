# Video streaming

<!-- generated from cases/video-streaming.json by `npm run docs`: do not edit by hand -->

> Upload, transcode and stream video to hundreds of millions of viewers.

## Requirements

**Functional**

- Upload a video and transcode it into several resolutions
- Stream with adaptive bitrate
- Resume where the viewer stopped

**Non-functional**

- Playback starts in under 2 s
- No re-buffering on a stable connection
- Uploads are never lost

## Assumptions

| Assumption | Value | Why |
|---|---|---|
| `seconds_per_day` | 86400 s | Definition. |
| `days_per_year` | 365 | Definition. |
| `peak_to_average` | 2 | Evening peaks are about twice the daily average for video. |
| `headroom` | 0.7 | Plan to run servers at 70% of measured capacity so one failure or a spike does not overload the rest. |
| `replication_factor` | 3 | Three copies survive one lost node during maintenance of another, the common default for databases and object stores. |
| `daily_active_users` | 800M | A global video platform. |
| `watch_minutes_per_user` | 40 | Average daily watch time per active user. |
| `playback_mbps` | 2.5 | Average delivered bitrate across devices in megabits per second. |
| `upload_hours_per_minute` | 500 h | Hours of video uploaded every minute (the widely quoted YouTube figure). |
| `stored_mbps_all_renditions` | 12 | Source plus every rendition, in megabits per second of video. |
| `cpu_seconds_per_video_second` | 4 s | Encoding all renditions costs about four CPU seconds per second of video. |

## Estimates

| Estimate | Value | Formula |
|---|---|---|
| **Viewers watching at the same time (average)** | 22.2M | `daily_active_users * watch_minutes_per_user / (seconds_per_day / 60)` |
| **Streaming bandwidth at peak** | 111 Tbps | `average_concurrent_viewers * peak_to_average * playback_mbps * 1000000` |
| Seconds of video uploaded per second | 30000 | `upload_hours_per_minute * 3600 / 60` |
| **New video storage per day, with replicas** | 11.7 PB | `video_seconds_uploaded_per_second * seconds_per_day * stored_mbps_all_renditions * 1000000 / 8 * replication_factor` |
| **CPU cores busy transcoding** | 120K | `video_seconds_uploaded_per_second * cpu_seconds_per_video_second` |

## What moves the numbers

Each assumption raised by 10% in turn; the ones that change each headline estimate most, with the
change each causes:

| Estimate | Biggest drivers |
|---|---|
| Viewers watching at the same time (average) | `daily_active_users` +10.0%, `watch_minutes_per_user` +10.0% |
| Streaming bandwidth at peak | `daily_active_users` +10.0%, `peak_to_average` +10.0%, `playback_mbps` +10.0%, `watch_minutes_per_user` +10.0% |
| New video storage per day, with replicas | `replication_factor` +10.0%, `stored_mbps_all_renditions` +10.0%, `upload_hours_per_minute` +10.0% |
| CPU cores busy transcoding | `cpu_seconds_per_video_second` +10.0%, `upload_hours_per_minute` +10.0% |

<!-- end of generated section -->

## What the numbers say

Everything here is enormous, but one number dominates: 22 million concurrent viewers on average, doubled at peak, at 2.5 Mbps each is 111 Tbps of egress. No single origin can serve that, so video must be delivered from CDN caches close to viewers, with the origin serving mostly cache misses. Uploads cost 11.7 PB of new storage per day with replicas and keep 120K CPU cores busy transcoding, which argues for transcoding popular renditions eagerly and rare ones on demand.

Next (M2): prototype chunked upload and adaptive-bitrate packaging, and measure transcoding seconds per video second.
