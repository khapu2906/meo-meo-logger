/**
 * Example 03 — Custom transports + TransportConfig
 *
 * Shows how to implement LogTransport and configure it with TransportConfig:
 * - In-memory buffer (for testing / batching)
 * - File (Node.js fs, append NDJSON lines)
 * - HTTP endpoint with batching, filtering, rate limiting, and retry
 * - CoreLogger.flush() for graceful shutdown
 *
 * Run: npx tsx examples/03-transports.ts
 */

import { appendFileSync } from 'fs';
import { CoreLogger } from '../lib/index';
import type { LogEntry, LogTransport } from '../lib/index';

// ---------- 1. In-memory transport ----------

class MemoryTransport implements LogTransport {
	readonly entries: LogEntry[] = [];

	write(entry: LogEntry | LogEntry[]): void {
		if (Array.isArray(entry)) {
			this.entries.push(...entry);
		} else {
			this.entries.push(entry);
		}
	}
}

// ---------- 2. File transport (append NDJSON lines) ----------

class FileTransport implements LogTransport {
	constructor(private readonly path: string) {}

	write(entry: LogEntry | LogEntry[]): void {
		const entries = Array.isArray(entry) ? entry : [entry];
		for (const e of entries) {
			appendFileSync(this.path, JSON.stringify(e) + '\n');
		}
	}
}

// ---------- 3. HTTP transport (batched POST to a log aggregator) ----------

class HttpTransport implements LogTransport {
	constructor(private readonly url: string) {}

	write(entry: LogEntry | LogEntry[]): Promise<void> {
		const body = JSON.stringify(Array.isArray(entry) ? entry : [entry]);
		return fetch(this.url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
		})
			.then(() => { /* ok */ })
			.catch(() => { /* network errors must not crash the app */ });
	}
}

// ---------- 4. Wire up — plain transports (backward compat, immediate) ----------

const memory = new MemoryTransport();
const file = new FileTransport('/tmp/app.log');

CoreLogger.configure({
	level: 'debug',
	mode: 'pretty',
	serviceName: 'transport-demo',
	transports: [
		// Plain LogTransport — no config, immediate dispatch (batchSize=1)
		memory,
		file,
	],
});

CoreLogger.info('App started');
CoreLogger.warn('Cache miss', { key: 'user:42' });
CoreLogger.error('Payment failed', { orderId: 'ord-001', err: new Error('Timeout') });

console.log('\n--- Entries captured in MemoryTransport (immediate) ---');
for (const entry of memory.entries) {
	console.log(`[${entry.level}] ${entry.msg}`);
}

// ---------- 5. TransportConfig — batching + filtering + rate limiting ----------

const batchedMemory = new MemoryTransport();

CoreLogger.configure({
	level: 'debug',
	mode: 'pretty',
	serviceName: 'transport-demo',
	transports: [
		{
			transport: batchedMemory,

			// Only send warn and above to this transport
			minLevel: 'warn',

			// Custom filter: drop health-check noise
			filter: (e) => !e.msg.includes('[HEALTH]'),

			// Buffer up to 5 entries before flushing
			batchSize: 5,

			// Or flush every 2 seconds even if batchSize not reached
			flushInterval: 2000,

			// Cap the queue at 50 entries (drop oldest on overflow)
			maxQueueSize: 50,

			// Max 20 log entries per second to this transport
			rateLimit: 20,
		},
		{
			// HTTP transport with retry
			transport: new HttpTransport('https://logs.example.com/ingest'),
			minLevel: 'error',
			batchSize: 10,
			flushInterval: 5000,
			maxRetries: 3,
			retryDelay: 200,
		},
	],
});

CoreLogger.info('[HEALTH] GET /healthz 200');  // filtered out by custom filter
CoreLogger.debug('cache lookup');              // filtered out by minLevel: 'warn'
CoreLogger.warn('slow query', { ms: 850 });
CoreLogger.error('DB connection failed', { host: 'db-01' });

// ---------- 6. addTransport() with config ----------

CoreLogger.addTransport(
	new MemoryTransport(),
	{ batchSize: 3, flushInterval: 1000 },
);

// ---------- 7. Graceful shutdown — flush all pending batches ----------

// In production: hook into process exit / server close
// process.on('SIGTERM', async () => {
//   await CoreLogger.flush();
//   process.exit(0);
// });

void CoreLogger.flush().then(() => {
	console.log('\n--- Entries captured in batchedMemory (minLevel: warn) ---');
	for (const entry of batchedMemory.entries) {
		console.log(`[${entry.level}] ${entry.msg}`);
	}
});
