import type { LogLevel, LogMode } from './types';

export const COLORS = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	dim: '\x1b[2m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	gray: '\x1b[90m',
} as const;

export const BOX = {
	topLeft: '╔',
	topRight: '╗',
	bottomLeft: '╚',
	bottomRight: '╝',
	horizontal: '═',
	vertical: '║',
	leftT: '╠',
	rightT: '╣',
} as const;

export const LEVEL_ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error'];

export const VALID_LEVELS = new Set<string>(LEVEL_ORDER);

export const VALID_MODES = new Set<string>(
	['pretty', 'json', 'silent'] satisfies LogMode[]
);

export const LEVEL_ICONS: Record<LogLevel, string> = {
	debug: '🐛',
	info: 'ℹ️ ',
	warn: '⚠️ ',
	error: '❌',
};

export const LEVEL_COLORS: Record<LogLevel, keyof typeof COLORS> = {
	debug: 'magenta',
	info: 'cyan',
	warn: 'yellow',
	error: 'red',
};