import { LEVEL_COLORS, LEVEL_ICONS, LEVEL_ORDER } from '@shared/constants';
import type { ChildLogger, LogConfig, LogEntry, LogLevel, LogMeta, LogMode, LogTransport, ScopedLogger, TimerHandle, TransportConfig } from '@shared/types';
import { TransportSlot, toSlot } from '@shared/TransportSlot';
import { colorize } from '@utils/color';
import { serializeMeta, timestamp } from '@utils/format';
import { parseEnvLevel, parseEnvMode, validateConfig } from '@utils/validate';

export class CoreLogger {

	private static level: LogLevel = parseEnvLevel('info');

	private static mode: LogMode = parseEnvMode(
		process.env['NODE_ENV'] === 'production' ? 'json' : 'pretty'
	);

	private static serviceName: string = process.env['SERVICE_NAME'] ?? 'app';

	private static slots: TransportSlot[] = [];

	// ---------- Internal ----------

	private static shouldLog(level: LogLevel): boolean {
		return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(this.level);
	}

	private static dispatch(entry: LogEntry): void {
		for (const slot of this.slots) {
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

		const time = timestamp();
		const isPretty = this.mode === 'pretty';
		const mergedMeta = (meta !== undefined || context !== undefined)
			? { ...(context ?? {}), ...(meta ?? {}) }
			: undefined;

		// ---------- Transports (always, even in silent mode) ----------
		if (this.slots.length > 0) {
			this.dispatch({
				level,
				msg: message,
				time,
				service: this.serviceName,
				...(scope !== undefined && { scope }),
				...(mergedMeta !== undefined && { meta: mergedMeta }),
			});
		}

		// ---------- Console output (skipped in silent mode) ----------
		if (this.mode === 'silent') return;

		// ---------- JSON ----------
		if (this.mode === 'json') {
			const serialized = mergedMeta !== undefined ? serializeMeta(mergedMeta) : undefined;
			const payload = {
				...(serialized ?? {}),
				level,
				time,
				service: this.serviceName,
				...(scope !== undefined && { scope }),
				msg: message,
			};
			console.log(JSON.stringify(payload));
			return;
		}

		// ---------- PRETTY ----------
		const ts = colorize(`[${time}]`, 'gray', isPretty);
		const lvl = colorize(level.toUpperCase().padEnd(5), LEVEL_COLORS[level], isPretty);
		const sc = scope ? colorize(`[${scope}]`, 'blue', isPretty) : '';
		const icon = LEVEL_ICONS[level];

		const parts = [icon, ts, lvl, sc, message].filter(Boolean);
		const base = parts.join(' ');

		if (mergedMeta !== undefined) {
			console.log(base, mergedMeta);
		} else {
			console.log(base);
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
			debug: (msg, meta) => CoreLogger.write('debug', msg, meta, scope),
			info: (msg, meta) => CoreLogger.write('info', msg, meta, scope),
			warn: (msg, meta) => CoreLogger.write('warn', msg, meta, scope),
			error: (msg, meta) => CoreLogger.write('error', msg, meta, scope),
		};
	}

	// ---------- Child ----------

	static child(context: LogMeta): ChildLogger {
		return {
			debug: (msg, meta) => CoreLogger.write('debug', msg, meta, undefined, context),
			info: (msg, meta) => CoreLogger.write('info', msg, meta, undefined, context),
			warn: (msg, meta) => CoreLogger.write('warn', msg, meta, undefined, context),
			error: (msg, meta) => CoreLogger.write('error', msg, meta, undefined, context),
			scope: (scope: string) => ({
				debug: (msg, meta) => CoreLogger.write('debug', msg, meta, scope, context),
				info: (msg, meta) => CoreLogger.write('info', msg, meta, scope, context),
				warn: (msg, meta) => CoreLogger.write('warn', msg, meta, scope, context),
				error: (msg, meta) => CoreLogger.write('error', msg, meta, scope, context),
			}),
		};
	}

	// ---------- Timer ----------

	static time(label: string, scope?: string): TimerHandle {
		const start = performance.now();
		return {
			end: (meta?: LogMeta) => {
				const ms = Math.round(performance.now() - start);
				CoreLogger.write('debug', `${label} completed in ${ms}ms`, meta, scope);
			},
		};
	}

	// ---------- Configure ----------

	static configure(config: LogConfig): void {
		validateConfig(config);
		if (config.level !== undefined) this.level = config.level;
		if (config.mode !== undefined) this.mode = config.mode;
		if (config.serviceName !== undefined) this.serviceName = config.serviceName;
		if (config.transports !== undefined) {
			for (const slot of this.slots) slot.destroy();
			this.slots = config.transports.map(toSlot);
		}
	}

	static addTransport(transport: LogTransport, config?: Omit<TransportConfig, 'transport'>): void {
		this.slots.push(new TransportSlot(transport, { transport, ...config }));
	}

	static flush(): Promise<void> {
		return Promise.all(this.slots.map(s => s.flush())).then(() => undefined);
	}

	// ---------- Getters ----------

	static getLevel(): LogLevel { return this.level; }
	static getMode(): LogMode { return this.mode; }
}
