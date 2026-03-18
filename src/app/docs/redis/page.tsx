import { DocLayout } from "@/components/layout/doc-layout";
import type { Metadata } from "next";

const MARKDOWN = `
## Overview

The Redis Studio lets you create hosted Redis databases, browse keys, inspect values by type, set TTLs, and run arbitrary commands — all from the browser. Databases are powered by Upstash and accessible via a REST API, so there are no persistent connections or drivers to install.

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

## Opening the Studio

Click any Redis database in the list to open the studio. The layout has three parts:

- **Sidebar** — key browser with pattern search, type badges, and TTL indicators
- **Inspector** — view and manage the selected key's value, type, and TTL
- **Console** — run raw Redis commands with history and arrow-key navigation

## Browsing Keys

The sidebar loads keys using \`SCAN\` with a configurable match pattern. The default pattern is \`*\` (all keys). Change it to filter, e.g. \`user:*\` or \`session:*\`.

Each key shows:

- **Type badge** — color-coded for string, hash, list, set, zset, and stream
- **TTL badge** — shown when the key has an expiry set
- **Key name** — monospace, truncated for long names

Click **Load more** at the bottom to continue scanning if the database has more keys than one page.

## Inspecting a Key

Click a key in the sidebar to open it in the inspector. The view adapts to the key's type:

### String

Displays the raw value. If the value is valid JSON, it is auto-formatted with indentation.

### Hash

A two-column table of field-value pairs from \`HGETALL\`.

### List

An indexed list of values from \`LRANGE 0 199\` (first 200 items).

### Set

A list of members from \`SMEMBERS\`.

### Sorted Set

A table of member-score pairs from \`ZRANGEBYSCORE -inf +inf WITHSCORES\`.

### Stream

Entries with their IDs and field-value maps from \`XRANGE - + COUNT 100\`.

Toggle **Raw** mode to see the underlying value as a JSON string regardless of type.

## Managing TTL

Click the TTL value in the inspector to edit it:

- Enter a number of **seconds** and click **Save** to set an expiry with \`EXPIRE\`
- Clear the field and save to remove the expiry with \`PERSIST\`
- Press **Escape** to cancel

## Deleting Keys

Click the trash icon next to the key name in the inspector. The key is deleted immediately with \`DEL\` and removed from the sidebar.

## Command Console

The bottom panel is a Redis command console. Type any command and press **Enter** to execute it:

\`\`\`
> SET greeting "hello world"
OK

> GET greeting
hello world

> KEYS user:*
["user:1", "user:2", "user:42"]

> INFO keyspace
# Keyspace
db0:keys=127,expires=3,avg_ttl=86400
\`\`\`

Features:

- **Arrow Up / Down** — cycle through command history
- **Click a history entry** — re-populate the input with that command
- Results are displayed with JSON formatting when applicable

## Connection Details

Click the link icon next to the database name in the sidebar header to view:

- **Endpoint** — the Upstash REST URL for this database
- **REST Token** — the authentication token for direct REST API access
- **Region** — where the database is hosted

You can use the endpoint and token to connect from your own applications via the Upstash REST API or the \`@upstash/redis\` SDK.

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
    "Learn how to create hosted Redis databases, browse keys, inspect values, manage TTLs, and run commands using the Redis Studio on 1tt.dev.",
};

export default function RedisDocsPage() {
  return (
    <DocLayout
      title="Redis Studio"
      description="Create hosted Redis databases, browse keys, inspect values by type, and run commands — all from your browser."
      markdown={MARKDOWN}
    />
  );
}
