import type { LogEntry, LogLevel, LogTransport, TransportConfig } from './types';

const LEVEL_ORDER: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Internal wrapper around a LogTransport that manages:
 * - per-entry filtering (minLevel, custom filter)
 * - batching (batchSize, flushInterval, maxQueueSize)
 * - rate limiting (entries/second, sliding window)
 * - retry with delay for async transports
 */
export class TransportSlot {
	private readonly transport: LogTransport;

	// Resolved config — use 0 as "disabled" sentinel to avoid undefined checks
	private readonly minLevel: LogLevel | undefined;
	private readonly filter: ((entry: LogEntry) => boolean) | undefined;
	private readonly batchSize: number;
	private readonly flushInterval: number;
	private readonly maxQueueSize: number;
	private readonly rateLimit: number;
	private readonly maxRetries: number;
	private readonly retryDelay: number;

	private queue: LogEntry[] = [];
	private timer: ReturnType<typeof setTimeout> | null = null;

	// Rate limit state (sliding 1-second window)
	private rateLimitCount = 0;
	private rateLimitWindowStart = 0;

	// In-flight flush guard — ensures sequential writes to the transport
	private flushPromise: Promise<void> | null = null;

	constructor(transport: LogTransport, config?: TransportConfig) {
		this.transport = transport;
		this.minLevel = config?.minLevel;
		this.filter = config?.filter;
		this.batchSize = config?.batchSize ?? 1;
		this.flushInterval = config?.flushInterval ?? 0;
		this.maxQueueSize = config?.maxQueueSize ?? 0;
		this.rateLimit = config?.rateLimit ?? 0;
		this.maxRetries = config?.maxRetries ?? 0;
		this.retryDelay = config?.retryDelay ?? 0;
	}

	/** Called once per log entry from the logger dispatch. */
	enqueue(entry: LogEntry): void {
		// 1. Level filter
		if (this.minLevel !== undefined) {
			if (LEVEL_ORDER.indexOf(entry.level) < LEVEL_ORDER.indexOf(this.minLevel)) return;
		}

		// 2. Custom filter predicate
		if (this.filter !== undefined && !this.filter(entry)) return;

		// 3. Rate limit
		if (this.isRateLimited()) return;

		// 4. Enqueue — evict oldest if maxQueueSize exceeded
		this.queue.push(entry);
		if (this.maxQueueSize > 0 && this.queue.length > this.maxQueueSize) {
			this.queue.shift();
		}

		// 5. Flush immediately or defer via timer
		if (this.batchSize <= 1 || this.queue.length >= this.batchSize) {
			void this.flushNow();
		} else {
			this.armTimer();
		}
	}

	/** Flush all pending entries immediately. Returns a promise that resolves when done. */
	flush(): Promise<void> {
		return this.flushNow();
	}

	/** Clear the interval timer. Must be called before replacing this slot. */
	destroy(): void {
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}

	// ---------- Private ----------

	private armTimer(): void {
		if (this.timer !== null || this.flushInterval <= 0) return;
		this.timer = setTimeout(() => {
			this.timer = null;
			void this.flushNow();
		}, this.flushInterval);
	}

	private flushNow(): Promise<void> {
		// Chain onto in-flight flush to prevent concurrent writes
		if (this.flushPromise !== null) {
			return this.flushPromise.then(() => this.flushNow());
		}
		if (this.queue.length === 0) return Promise.resolve();

		// Cancel pending timer — we are flushing now
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		const batch = this.queue;
		this.queue = [];

		this.flushPromise = this.doWrite(batch).finally(() => {
			this.flushPromise = null;
		});
		return this.flushPromise;
	}

	private async doWrite(batch: LogEntry[]): Promise<void> {
		if (batch.length === 0) return;
		const payload: LogEntry | LogEntry[] = batch.length === 1 ? (batch[0] as LogEntry) : batch;
		let attempt = 0;
		let done = false;
		while (!done) {
			try {
				const result = this.transport.write(payload);
				if (result instanceof Promise) await result;
				done = true;
			} catch {
				if (attempt >= this.maxRetries) { done = true; } // silently give up
				else {
					attempt++;
					if (this.retryDelay > 0) await sleep(this.retryDelay);
				}
			}
		}
	}

	private isRateLimited(): boolean {
		if (this.rateLimit <= 0) return false;
		const now = Date.now();
		if (now - this.rateLimitWindowStart >= 1000) {
			this.rateLimitWindowStart = now;
			this.rateLimitCount = 0;
		}
		if (this.rateLimitCount >= this.rateLimit) return true;
		this.rateLimitCount++;
		return false;
	}
}

/** Type guard: distinguish TransportConfig from plain LogTransport. */
export function isTransportConfig(v: LogTransport | TransportConfig): v is TransportConfig {
	return 'transport' in v;
}

/** Wrap a plain LogTransport or a TransportConfig into a TransportSlot. */
export function toSlot(v: LogTransport | TransportConfig): TransportSlot {
	if (isTransportConfig(v)) {
		return new TransportSlot(v.transport, v);
	}
	return new TransportSlot(v);
}
