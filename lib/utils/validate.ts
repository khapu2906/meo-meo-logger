import { VALID_LEVELS, VALID_MODES } from '@shared/constants';
import type { LogConfig, LogLevel, LogMode } from '@shared/types';

export function isValidLevel(value: string): value is LogLevel {
	return VALID_LEVELS.has(value);
}

export function isValidMode(value: string): value is LogMode {
	return VALID_MODES.has(value);
}

export function parseEnvLevel(fallback: LogLevel): LogLevel {
	const val = process.env['LOG_LEVEL'];
	if (val !== undefined && isValidLevel(val)) return val;
	return fallback;
}

export function parseEnvMode(fallback: LogMode): LogMode {
	const val = process.env['LOG_MODE'];
	if (val !== undefined && isValidMode(val)) return val;
	return fallback;
}

export function validateConfig(config: LogConfig): void {
	if (config.level !== undefined && !isValidLevel(config.level)) {
		throw new Error(
			`Invalid log level: "${String(config.level)}". Must be one of: ${[...VALID_LEVELS].join(', ')}`
		);
	}

	if (config.mode !== undefined && !isValidMode(config.mode)) {
		throw new Error(
			`Invalid log mode: "${String(config.mode)}". Must be one of: ${[...VALID_MODES].join(', ')}`
		);
	}

	if (config.serviceName !== undefined && config.serviceName.trim() === '') {
		throw new Error('serviceName cannot be empty');
	}
}