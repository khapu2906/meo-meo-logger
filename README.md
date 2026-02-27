<div align="center">
  <img src="https://github.com/khapu2906/meo-meo-logger/blob/main/assets/logo.png?raw=true" alt="Meo Meo Logger" width="200" />

  # meo-meo-logger

  Structured logger for Node.js and browser — pretty output, JSON mode, scoping, child loggers, timers, and a pluggable transport system with batching, filtering, and rate limiting.

  Zero runtime dependencies.
</div>

## Installation

```bash
npm install meo-meo-logger
# or
pnpm add meo-meo-logger
```

---

## Quick start

```typescript
import { CoreLogger } from 'meo-meo-logger';

CoreLogger.info('Server started', { port: 3000 });
CoreLogger.warn('High memory usage', { heap: '90%' });
CoreLogger.error('DB connection failed', { err: new Error('ECONNREFUSED') });
```

---

## Table of contents

- [meo-meo-logger](#meo-meo-logger)
  - [Installation](#installation)
  - [Quick start](#quick-start)
  - [Table of contents](#table-of-contents)
  - [Log levels](#log-levels)
  - [Output modes](#output-modes)
  - [Configure](#configure)
  - [Scope](#scope)
  - [Child logger](#child-logger)
  - [Timer](#timer)
  - [Transports](#transports)
    - [Basic transport](#basic-transport)
    - [TransportConfig](#transportconfig)
    - [Batching](#batching)
    - [Filtering](#filtering)
    - [Rate limiting](#rate-limiting)
    - [Retry](#retry)
    - [Graceful shutdown](#graceful-shutdown)
    - [addTransport with config](#addtransport-with-config)
  - [PrettyLogger (Node only)](#prettylogger-node-only)
  - [Browser](#browser)
  - [Environment variables](#environment-variables)
  - [TypeScript types](#typescript-types)
    - [Error serialization](#error-serialization)

---

## Log levels

```typescript
CoreLogger.debug('Detailed trace', { query: sql });
CoreLogger.info('Request received', { method: 'GET', path: '/api' });
CoreLogger.warn('Slow response', { ms: 1200 });
CoreLogger.error('Unhandled exception', { err: new Error('boom') });
```

Levels in order: `debug` < `info` < `warn` < `error`. Entries below the configured `level` are dropped before any processing.

---

## Output modes

**`pretty`** — colored ANSI output, for development:
```
🐛 [2026-01-01T00:00:00.000Z] DEBUG [scope] message
ℹ️  [2026-01-01T00:00:00.000Z] INFO  Request received
```

**`json`** — structured newline-delimited JSON, for production / log aggregators (Datadog, Loki, CloudWatch…):
```json
{"level":"info","time":"2026-01-01T00:00:00.000Z","service":"my-api","msg":"Request received","method":"GET","path":"/api"}
```

**`silent`** — suppresses all console output. Transports still receive every entry — useful for test environments where you want to assert on log entries without terminal noise.

---

## Configure

```typescript
CoreLogger.configure({
  level:       'debug',      // 'debug' | 'info' | 'warn' | 'error'  (default: 'info')
  mode:        'json',       // 'pretty' | 'json' | 'silent'          (default: 'pretty' in dev, 'json' in prod)
  serviceName: 'my-api',    // appears in every JSON entry            (default: 'app')
  transports:  [...],        // see Transports section
});
```

`configure()` is additive for `level`, `mode`, and `serviceName`. For `transports`, the entire array is replaced and old slot timers are cleared.

---

## Scope

Group logs by module or component:

```typescript
const log = CoreLogger.scope('AuthModule');
log.info('User logged in', { userId: 42 });
// → ℹ️  [2026-...] INFO  [AuthModule] User logged in { userId: 42 }
```

---

## Child logger

A child logger injects fixed context fields into every entry automatically:

```typescript
const log = CoreLogger.child({ requestId: 'req-abc', userId: 7 });

log.info('Fetching order');
// → { requestId: 'req-abc', userId: 7, msg: 'Fetching order' }

log.error('Payment failed', { orderId: 'ord-001' });
// → { requestId: 'req-abc', userId: 7, orderId: 'ord-001', msg: 'Payment failed' }
```

Child loggers also support scoping:

```typescript
const log = CoreLogger.child({ requestId: 'req-abc' });
const db = log.scope('database');
db.warn('Slow query', { ms: 850 });
// → [database] { requestId: 'req-abc', ms: 850 } Slow query
```

---

## Timer

Measure duration of any operation:

```typescript
const t = CoreLogger.time('db.query', 'database');
const rows = await db.find(query);
t.end({ rows: rows.length });
// → 🐛 [2026-...] DEBUG [database] db.query completed in 12ms { rows: 42 }
```

Uses `performance.now()` internally for monotonic accuracy.

---

## Transports

Transports let you push log entries to any external destination — files, HTTP endpoints, Loki, Datadog, Elasticsearch, etc. — without affecting console output.

### Basic transport

Implement `LogTransport` and pass it to `configure()`:

```typescript
import type { LogTransport, LogEntry } from 'meo-meo-logger';

class MyTransport implements LogTransport {
  write(entry: LogEntry | LogEntry[]): void {
    const entries = Array.isArray(entry) ? entry : [entry];
    for (const e of entries) {
      // send to your backend
    }
  }
}

CoreLogger.configure({
  transports: [new MyTransport()],
});

// Or add after configure:
CoreLogger.addTransport(new MyTransport());
```

### TransportConfig

Wrap any transport in a `TransportConfig` object to enable per-transport options:

```typescript
CoreLogger.configure({
  transports: [
    {
      transport: new MyTransport(),

      // Filtering
      minLevel: 'warn',                            // only warn + error reach this transport
      filter: (e) => !e.msg.includes('[HEALTH]'),  // custom predicate

      // Batching
      batchSize: 50,           // flush when queue reaches 50 entries
      flushInterval: 5000,     // or flush every 5 seconds (whichever comes first)
      maxQueueSize: 1000,      // drop oldest entry when queue exceeds 1000

      // Rate limiting
      rateLimit: 100,          // max 100 entries per second to this transport

      // Retry (async transports only)
      maxRetries: 3,
      retryDelay: 200,         // ms between retries
    },
  ],
});
```

Plain `LogTransport` objects (no config wrapper) continue to work exactly as before — they receive entries immediately with no buffering.

### Batching

When `batchSize > 1`, entries are buffered in memory and flushed as an array:

```typescript
{
  transport: httpTransport,
  batchSize: 100,         // flush when 100 entries accumulated
  flushInterval: 10000,   // or flush every 10s even if not full
  maxQueueSize: 500,      // hard cap — drop oldest on overflow
}
```

> **Memory note:** Each buffered `LogEntry` is roughly 300–500 bytes. With `batchSize: 1000` and `flushInterval: 30000`, a queue can hold ~500 KB per transport. Set `maxQueueSize` to cap this in high-throughput services.

The flush timer is **lazy and one-shot** — it is only armed when entries are enqueued and is cancelled immediately when a flush occurs. There is no global `setInterval` running.

### Filtering

```typescript
{
  transport: errorTransport,
  minLevel: 'error',                        // only errors
  filter: (e) => e.service === 'payments',  // only from payments service
}
```

Both `minLevel` and `filter` are evaluated **before** entries enter the queue, so filtered entries consume no memory.

### Rate limiting

```typescript
{
  transport: externalApi,
  rateLimit: 50,   // max 50 entries/second
}
```

Uses a sliding 1-second window. Excess entries are dropped silently. Zero overhead between calls — no `setInterval` or background timer.

### Retry

```typescript
{
  transport: httpTransport,
  maxRetries: 3,    // retry up to 3 times after failure
  retryDelay: 200,  // wait 200ms between attempts
}
```

Retries apply per batch. If all retries are exhausted, the batch is dropped silently — transports must never crash the application.

### Graceful shutdown

Call `flush()` before process exit to ensure all buffered entries are delivered:

```typescript
process.on('SIGTERM', async () => {
  await CoreLogger.flush();
  process.exit(0);
});
```

`flush()` returns `Promise<void>` and resolves only after all pending batches have been written (or retries exhausted).

### addTransport with config

```typescript
CoreLogger.addTransport(
  new HttpTransport('https://logs.example.com'),
  { batchSize: 50, flushInterval: 5000, minLevel: 'warn' },
);
```

---

## PrettyLogger (Node only)

Utilities for structured startup output:

```typescript
import { PrettyLogger } from 'meo-meo-logger';

// App banner
PrettyLogger.banner({
  name: 'MyApp',
  version: '1.2.0',
  environment: 'development',
  port: 3000,
});

// Numbered boot step
PrettyLogger.step(1, 4, 'Connecting to database');
PrettyLogger.step(2, 4, 'Loading configuration');

// Module lifecycle
PrettyLogger.module('AuthModule', 'registering');
PrettyLogger.module('AuthModule', 'registered');
PrettyLogger.module('UserModule', 'bootstrapped');

// Section divider
PrettyLogger.section('HTTP Server');

// Server ready box with route table
PrettyLogger.serverReady({
  port: 3000,
  routes: [
    { label: 'REST API', path: '/api',     icon: '⚡' },
    { label: 'Health',   path: '/healthz', icon: '💚' },
    { label: 'Docs',     path: '/api/docs', icon: '📖' },
  ],
});

// Generic titled box
PrettyLogger.box('Startup complete');

// Blank line
PrettyLogger.line();
```

Module statuses: `'registering'` | `'registered'` | `'bootstrapping'` | `'bootstrapped'`

---

## Browser

```typescript
import { BrowserLogger } from 'meo-meo-logger/browser';

BrowserLogger.configure({ level: 'debug', mode: 'pretty' });

BrowserLogger.info('App mounted');
BrowserLogger.warn('Token expiring soon', { expiresIn: 300 });

// Grouped output in DevTools
BrowserLogger.group('API call');
BrowserLogger.debug('GET /api/users');
BrowserLogger.groupEnd();

// Transports work identically to CoreLogger
BrowserLogger.addTransport(myTransport, { batchSize: 20, flushInterval: 3000 });
await BrowserLogger.flush();
```

Uses CSS `%c` styling instead of ANSI codes for colored DevTools output.

---

## Environment variables

Node.js only — read at module load time:

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `info` | Minimum log level (`debug` / `info` / `warn` / `error`) |
| `LOG_MODE` | `pretty` (dev) / `json` (prod) | Output format |
| `SERVICE_NAME` | `app` | Service name included in every JSON entry |

`NODE_ENV=production` automatically switches the default mode to `json`.

---

## TypeScript types

```typescript
import type {
  LogLevel,        // 'debug' | 'info' | 'warn' | 'error'
  LogMode,         // 'pretty' | 'json' | 'silent'
  LogMeta,         // Record<string, unknown>
  LogEntry,        // { level, msg, time, service, scope?, meta? }
  LogTransport,    // interface { write(entry: LogEntry | LogEntry[]): void | Promise<void> }
  TransportConfig, // LogTransport wrapper with batching/filtering/retry options
  LogConfig,       // configure() parameter shape
  ScopedLogger,    // returned by scope()
  ChildLogger,     // returned by child()
  TimerHandle,     // returned by time()
} from 'meo-meo-logger';
```

### Error serialization

`Error` objects inside `meta` are automatically serialized to plain objects in JSON mode — no more `{}`:

```typescript
CoreLogger.error('Request failed', { err: new Error('Timeout') });
// JSON: { "err": { "name": "Error", "message": "Timeout", "stack": "Error: Timeout\n    at ..." } }
```

Deep/nested errors are serialized recursively.
