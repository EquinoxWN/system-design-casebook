# News feed

<!-- generated from cases/news-feed.json by `npm run docs`: do not edit by hand -->

> Show each user a feed of recent posts from the accounts they follow.

## Requirements

**Functional**

- Publish a post
- Read the home feed newest first, paginated
- Follow and unfollow accounts

**Non-functional**

- Feed read p99 under 200 ms
- A new post appears in followers' feeds within a few seconds
- Accounts with millions of followers must not stall delivery for everyone else

## Assumptions

| Assumption | Value | Why |
|---|---|---|
| `seconds_per_day` | 86400 s | Definition. |
| `days_per_year` | 365 | Definition. |
| `peak_to_average` | 3 | Daily traffic peaks at roughly 2 to 3 times its average for consumer products; 3 is the conservative end. |
| `headroom` | 0.7 | Plan to run servers at 70% of measured capacity so one failure or a spike does not overload the rest. |
| `replication_factor` | 3 | Three copies survive one lost node during maintenance of another, the common default for databases and object stores. |
| `daily_active_users` | 200M | A large social network. |
| `posts_per_user_per_day` | 1 | Some post several times, most never; one per user on average. |
| `average_followers` | 200 | Typical median-to-mean follower count on mature networks. |
| `feed_reads_per_user_per_day` | 10 | Users open the app about ten times a day. |
| `post_bytes` | 300 B | Text, ids and timestamps; media is stored separately. |
| `feed_entry_bytes` | 16 B | Post id and author id per cached feed entry. |
| `feed_length` | 500 | Keep the newest 500 entries per user in the feed cache. |
| `celebrity_followers` | 100M | The largest accounts. |
| `fanout_writes_per_second` | 1M/s | Throughput of the fan-out workers writing into feed caches. |

## Estimates

| Estimate | Value | Formula |
|---|---|---|
| Posts per day | 200M/day | `daily_active_users * posts_per_user_per_day` |
| Feed inserts per day if every post is pushed | 40B/day | `posts_per_day * average_followers` |
| **Feed inserts per second at peak** | 1.39M/s | `fanout_per_day / seconds_per_day * peak_to_average` |
| **Feed reads per second at peak** | 69.4K/s | `daily_active_users * feed_reads_per_user_per_day / seconds_per_day * peak_to_average` |
| **Feed cache, with replicas** | 4.8 TB | `daily_active_users * feed_length * feed_entry_bytes * replication_factor` |
| Post storage per year, with replicas | 65.7 TB | `posts_per_day * days_per_year * post_bytes * replication_factor` |
| **Time to push one celebrity post to every follower** | 100 s | `celebrity_followers / fanout_writes_per_second` |

## What moves the numbers

Each assumption raised by 10% in turn; the ones that change each headline estimate most, with the
change each causes:

| Estimate | Biggest drivers |
|---|---|
| Feed inserts per second at peak | `average_followers` +10.0%, `daily_active_users` +10.0%, `peak_to_average` +10.0%, `posts_per_user_per_day` +10.0% |
| Feed reads per second at peak | `daily_active_users` +10.0%, `feed_reads_per_user_per_day` +10.0%, `peak_to_average` +10.0% |
| Feed cache, with replicas | `daily_active_users` +10.0%, `feed_entry_bytes` +10.0%, `feed_length` +10.0%, `replication_factor` +10.0% |
| Time to push one celebrity post to every follower | `celebrity_followers` +10.0% |

<!-- end of generated section -->

## What the numbers say

Pushing every post into every follower's feed costs 40 billion feed inserts a day, 1.39 million per second at peak, against only 69K feed reads per second: writes outnumber reads 20 to 1. Worse, a single celebrity post to 100 million followers keeps the fan-out workers busy for 100 seconds, delaying everyone else's posts. That is the numerical case for the hybrid design: push posts from ordinary accounts into feed caches (4.8 TB with replicas fits in memory clusters), and pull posts from high-follower accounts at read time, merging them into the feed.

Next (M2): prototype push, pull and hybrid fan-out and measure feed read latency and delivery delay for a celebrity post.
