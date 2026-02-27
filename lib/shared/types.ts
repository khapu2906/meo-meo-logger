export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogMode = 'pretty' | 'json' | 'silent';

export interface LogMeta {
	[key: string]: unknown;
}

export interface LogEntry {
	level: LogLevel;
	msg: string;
	time: string;
	service: string;
	scope?: string;
	meta?: LogMeta;
}

export interface LogTransport {
	write(entry: LogEntry | LogEntry[]): void | Promise<void>;
}

export interface TransportConfig {
	transport: LogTransport;

	// Filtering
	minLevel?: LogLevel;
	filter?: (entry: LogEntry) => boolean;

	// Batching
	batchSize?: number;       // flush when queue reaches N (default: 1 = immediate)
	flushInterval?: number;   // flush every N ms even if batchSize not reached
	maxQueueSize?: number;    // drop oldest when queue exceeds this (default: unlimited)

	// Rate limiting
	rateLimit?: number;       // max entries per second

	// Retry (async transports only)
	maxRetries?: number;
	retryDelay?: number;      // ms between retries
}

export interface LogConfig {
	level?: LogLevel;
	mode?: LogMode;
	serviceName?: string;
	transports?: (LogTransport | TransportConfig)[];
}

export interface ScopedLogger {
	debug: (msg: string, meta?: LogMeta) => void;
	info: (msg: string, meta?: LogMeta) => void;
	warn: (msg: string, meta?: LogMeta) => void;
	error: (msg: string, meta?: LogMeta) => void;
}

export interface ChildLogger extends ScopedLogger {
	scope: (name: string) => ScopedLogger;
}

export interface TimerHandle {
	end: (meta?: LogMeta) => void;
}