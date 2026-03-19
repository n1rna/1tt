import { DocLayout } from "@/components/layout/doc-layout";
import type { Metadata } from "next";

const MARKDOWN = `
## Overview

The Redis Studio is a full-featured Redis browser and management tool that runs entirely in the browser. Create hosted databases powered by Upstash, run commands, inspect keys, monitor performance, and debug framework-specific data structures — all without installing a client or opening a terminal.

The studio uses a tabbed interface with a sidebar for navigation. Open multiple tabs simultaneously: query tabs, metrics, live monitoring, key explorer, stream inspector, and framework-specific views for BullMQ, Sidekiq, and Celery.

## Creating a Redis Database

Go to **Databases** in your account and click **Create Redis**. Choose a name and a region:

| Region | Location |
|--------|----------|
| us-east-1 | N. Virginia |
| us-west-1 | N. California |
| us-west-2 | Oregon |
| eu-central-1 | Frankfurt |
| eu-west-1 | Ireland |
| ap-northeast-1 | Tokyo |
| ap-southeast-1 | Singapore |

The database is provisioned in seconds and appears in your database list with a **Redis** badge.

## Studio Layout

The studio has two main areas:

- **Sidebar** (left) — database info, navigation items, and views
- **Main area** (right) — tab bar and active tab content

### Sidebar Navigation

| Item | Description |
|------|-------------|
| Metrics | Database stats from INFO command |
| Live Monitor | Polling dashboard with trends |
| New Query | Opens a new command tab |

### Sidebar Views

**Data views:**

| View | Description |
|------|-------------|
| Key Explorer | Tree view of all keys grouped by prefix |
| Stream Groups | Consumer group inspector for stream keys |

**Framework views:**

| View | Description |
|------|-------------|
| BullMQ | Queue dashboard for BullMQ job queues |
| Sidekiq | Queue and job inspector for Sidekiq |
| Celery | Task queue and result browser for Celery |

## Query Tab

Each query tab is an independent Redis command workspace with its own history.

### Running Commands

Type any Redis command in the input at the top and press **Enter** (or click the play button):

\`\`\`
> SCAN 0 MATCH user:* COUNT 20
["12", ["user:1", "user:2", "user:42"]]

> HGETALL user:1
{"name": "Alice", "email": "alice@example.com"}

> SET greeting "hello world"
OK
\`\`\`

### SCAN Result Detection

When a command returns a SCAN result (\`[cursor, [keys...]]\`), the keys are displayed as a clickable list. Click any key to expand it inline and see its type, TTL, and value using the appropriate viewer (string, hash, list, set, sorted set, or stream).

### Command History

- **Arrow Up / Down** — cycle through previous commands in the input
- **History panel** — collapsible panel at the bottom showing all past commands
- Click a history row to expand and see its result
- **Re-run button** (circular arrow icon, visible on hover) — re-executes the command immediately
- The history panel is resizable — drag the handle to adjust its height

### AI Assistant

The query tab includes an AI assistant (Pro and Max plans) that generates Redis commands from natural language. Click **AI Assistant** below the input to expand it, then describe what you want:

- *"Find all keys matching the pattern session:*"*
- *"Set a hash with user profile data"*
- *"Show me the 10 most recent entries in the orders stream"*

The AI generates the command and places it in the input for review before execution.

## Metrics Tab

Shows a dashboard of database statistics from the Redis \`INFO\` command:

**Summary cards:** Total keys, used memory, connected clients, uptime, ops/sec, hit rate.

**Detailed sections:** Collapsible groups for each INFO category (Server, Clients, Memory, Stats, Keyspace, etc.) with all key-value pairs.

Click **Refresh** to reload stats.

## Live Monitor Tab

Polls the database at a configurable interval (5s, 10s, or 30s) and tracks trends:

- **Current stat cards** with delta indicators showing changes since the last poll
- **Snapshot table** showing historical values for keys, memory, ops/sec, and clients
- Up to 60 snapshots (5 minutes at 5s interval)
- Start/Stop toggle to control polling

## Key Namespace Explorer

Scans the entire keyspace (up to 10,000 keys) and groups keys into a tree by splitting on \`:\` delimiters.

- **Tree view** — expand/collapse namespaces, see key counts per node
- **Filter** — search to narrow the tree client-side
- **Key detail** — click any leaf key to inspect its type, TTL, and value in a side panel
- **Top namespaces** — shows the 5 largest namespaces by key count

Useful for understanding how your keyspace is organized and finding keys by structure.

## Stream Consumer Groups

Discovers all stream-type keys and provides a detailed inspector:

- **Stream selector** — switch between discovered streams
- **Stream info** — length, first/last entry ID, group count
- **Consumer groups table** — name, consumer count, pending count, last delivered ID
- **Consumer details** — expand a group to see individual consumers with pending count and idle time
- **Pending Entry List (PEL)** — shows unacknowledged messages with entry ID, consumer, idle time, and delivery count
- **ACK button** — acknowledge pending entries directly from the UI
- **Recent entries** — the 20 most recent stream entries with their field-value pairs

## BullMQ View

Inspects BullMQ job queues stored in Redis. Auto-discovers queues by scanning for \`bull:*:meta\` keys.

### Queue Dashboard

Summary cards for each job state:

| State | Color | Source |
|-------|-------|--------|
| Waiting | Blue | \`LLEN bull:{queue}:wait\` |
| Active | Orange | \`LLEN bull:{queue}:active\` |
| Completed | Green | \`ZCARD bull:{queue}:completed\` |
| Failed | Red | \`ZCARD bull:{queue}:failed\` |
| Delayed | Yellow | \`ZCARD bull:{queue}:delayed\` |
| Paused | Gray | \`LLEN bull:{queue}:paused\` |

### Job Inspection

Click any job ID to see its full details: name, data (JSON), options, timestamps, progress, return value, and error information (failed reason + stack trace for failed jobs).

### Retry Failed Jobs

Each failed job has a **Retry** button that moves it back to the waiting queue:

1. Removes the job from the \`failed\` sorted set
2. Clears error fields (\`failedReason\`, \`stacktrace\`, \`finishedOn\`)
3. Resets \`attemptsMade\` to 0
4. Pushes the job to the \`wait\` list

A **Retry All** button is also available to retry all failed jobs at once.

## Sidekiq View

Inspects Sidekiq job queues. Discovers queues from the \`queues\` set key.

- **Stats cards** — processed, failed, scheduled, retries, dead, enqueued
- **Queue browser** — each queue with its length, expandable to see individual job payloads (class, args, jid)
- **Scheduled / Retry / Dead tabs** — sorted set entries with timestamps, error details for retry and dead jobs

## Celery View

Inspects Celery task queues and results. Discovers queues from \`_kombu.binding.*\` keys and results from \`celery-task-meta-*\` keys.

- **Stats cards** — queues, pending tasks, task results, unacked count
- **Queue browser** — expandable per-queue view showing task messages (task name, ID, args, kwargs)
- **Task results** — status badges (SUCCESS, FAILURE, PENDING, STARTED, RETRY), result data, Python tracebacks for failed tasks

## Connection Details

Click the link icon next to the database name in the sidebar to view:

- **Redis URL** — \`redis://default:{password}@{host}:6379\` for direct connections (with show/hide toggle)
- **REST Endpoint** — the HTTPS URL for the Upstash REST API
- **REST Token** — authentication token for REST API access
- **Host, Port, Password, Region** — individual fields with copy buttons

## Limits

Redis databases are available on **Pro** and **Max** plans:

| Plan | Max Redis databases |
|------|---------------------|
| Free | 0 |
| Pro | 1 |
| Max | 3 |
`;

export const metadata: Metadata = {
  title: "Redis Studio Documentation — 1tt.dev",
  description:
    "Learn how to create hosted Redis databases, browse keys, run commands, monitor performance, and inspect BullMQ, Sidekiq, and Celery queues using the Redis Studio on 1tt.dev.",
};

export default function RedisDocsPage() {
  return (
    <DocLayout
      title="Redis Studio"
      description="Create hosted Redis databases, browse keys, run commands, monitor performance, and inspect framework-specific data structures — all from your browser."
      markdown={MARKDOWN}
    />
  );
}
