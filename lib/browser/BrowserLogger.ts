import type {
	ChildLogger,
	LogConfig,
	LogEntry,
	LogLevel,
	LogMeta,
	LogMode,
	LogTransport,
	ScopedLogger,
	TimerHandle,
	TransportConfig,
} from '../shared/types';
import { LEVEL_ORDER } from '../shared/constants';
import { TransportSlot, toSlot } from '../shared/TransportSlot';
import { serializeMeta } from '../utils/format';
import { validateConfig } from '../utils/validate';

// Browser uses CSS instead of ANSI escape codes
const BROWSER_STYLES: Record<LogLevel, string> = {
	debug: 'color: #a855f7; font-weight: 600',
	info: 'color: #06b6d4; font-weight: 600',
	warn: 'color: #f59e0b; font-weight: 600',
	error: 'color: #ef4444; font-weight: 600',
};

const LEVEL_ICONS: Record<LogLevel, string> = {
	debug: '🐛',
	info: 'ℹ️',
	warn: '⚠️',
	error: '❌',
};

// Runtime config — don't use process.env
let _level: LogLevel = 'info';
let _mode: LogMode = 'pretty';
let _service = 'app';
let _slots: TransportSlot[] = [];

export class BrowserLogger {

	// ---------- Internal ----------

	private static shouldLog(level: LogLevel): boolean {
		return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(_level);
	}

	private static dispatch(entry: LogEntry): void {
		for (const slot of _slots) {
			slot.enqueue(entry);
		}
	}

	private static write(
		level: LogLevel,
		message: string,
		meta?: LogMeta,
		scope?: string,
		context?: LogMeta,
	): void {
		if (!this.shouldLog(level)) return;

		const mergedMeta = (meta !== undefined || context !== undefined)
			? { ...(context ?? {}), ...(meta ?? {}) }
			: undefined;

		// ---------- Transports (always, even in silent mode) ----------
		if (_slots.length > 0) {
			this.dispatch({
				level,
				msg: message,
				time: new Date().toISOString(),
				service: _service,
				...(scope !== undefined && { scope }),
				...(mergedMeta !== undefined && { meta: mergedMeta }),
			});
		}

		// ---------- Console output (skipped in silent mode) ----------
		if (_mode === 'silent') return;

		// ---------- JSON ----------
		if (_mode === 'json') {
			const serialized = mergedMeta !== undefined ? serializeMeta(mergedMeta) : undefined;
			const payload = {
				...(serialized ?? {}),
				level,
				time: new Date().toISOString(),
				service: _service,
				...(scope !== undefined && { scope }),
				msg: message,
			};
			// Browser JSON mode: log as object so DevTools renders it interactively
			console.log(payload);
			return;
		}

		// ---------- PRETTY ----------
		const icon = LEVEL_ICONS[level];
		const style = BROWSER_STYLES[level];
		const sc = scope ? ` [${scope}]` : '';
		const label = `%c${icon} [${level.toUpperCase()}]${sc}`;

		if (mergedMeta !== undefined) {
			console.log(label, style, message, mergedMeta);
		} else {
			console.log(label, style, message);
		}
	}

	// ---------- Public ----------

	static debug(message: string, meta?: LogMeta): void {
		this.write('debug', message, meta);
	}

	static info(message: string, meta?: LogMeta): void {
		this.write('info', message, meta);
	}

	static warn(message: string, meta?: LogMeta): void {
		this.write('warn', message, meta);
	}

	static error(message: string, meta?: LogMeta): void {
		this.write('error', message, meta);
	}

	// ---------- Scope ----------

	static scope(scope: string): ScopedLogger {
		return {
			debug: (msg, meta) => BrowserLogger.write('debug', msg, meta, scope),
			info: (msg, meta) => BrowserLogger.write('info', msg, meta, scope),
			warn: (msg, meta) => BrowserLogger.write('warn', msg, meta, scope),
			error: (msg, meta) => BrowserLogger.write('error', msg, meta, scope),
		};
	}

	// ---------- Child ----------

	static child(context: LogMeta): ChildLogger {
		return {
			debug: (msg, meta) => BrowserLogger.write('debug', msg, meta, undefined, context),
			info: (msg, meta) => BrowserLogger.write('info', msg, meta, undefined, context),
			warn: (msg, meta) => BrowserLogger.write('warn', msg, meta, undefined, context),
			error: (msg, meta) => BrowserLogger.write('error', msg, meta, undefined, context),
			scope: (scope: string) => ({
				debug: (msg, meta) => BrowserLogger.write('debug', msg, meta, scope, context),
				info: (msg, meta) => BrowserLogger.write('info', msg, meta, scope, context),
				warn: (msg, meta) => BrowserLogger.write('warn', msg, meta, scope, context),
				error: (msg, meta) => BrowserLogger.write('error', msg, meta, scope, context),
			}),
		};
	}

	// ---------- Timer ----------

	static time(label: string, scope?: string): TimerHandle {
		const start = performance.now();
		return {
			end: (meta?: LogMeta) => {
				const ms = (performance.now() - start).toFixed(2);
				BrowserLogger.write('debug', `${label} completed in ${ms}ms`, meta, scope);
			},
		};
	}

	// ---------- Group (browser-only) ----------

	static group(label: string, collapsed = false): void {
		if (collapsed) {
			console.groupCollapsed(label);
		} else {
			console.group(label);
		}
	}

	static groupEnd(): void {
		console.groupEnd();
	}

	// ---------- Configure ----------

	static configure(config: LogConfig): void {
		validateConfig(config);
		if (config.level !== undefined) _level = config.level;
		if (config.mode !== undefined) _mode = config.mode;
		if (config.serviceName !== undefined) _service = config.serviceName;
		if (config.transports !== undefined) {
			for (const slot of _slots) slot.destroy();
			_slots = config.transports.map(toSlot);
		}
	}

	static addTransport(transport: LogTransport, config?: Omit<TransportConfig, 'transport'>): void {
		_slots.push(new TransportSlot(transport, { transport, ...config }));
	}

	static flush(): Promise<void> {
		return Promise.all(_slots.map(s => s.flush())).then(() => undefined);
	}

	static getLevel(): LogLevel { return _level; }
	static getMode(): LogMode { return _mode; }
}
