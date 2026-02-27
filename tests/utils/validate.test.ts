import { describe, expect, it } from 'vitest';
import {
	isValidLevel,
	isValidMode,
	validateConfig,
} from '@utils/validate';

describe('isValidLevel', () => {
	it.each(['debug', 'info', 'warn', 'error'])(
		'returns true for valid level "%s"',
		(level) => {
			expect(isValidLevel(level)).toBe(true);
		}
	);

	it.each(['verbose', 'trace', 'fatal', '', 'INFO'])(
		'returns false for invalid level "%s"',
		(level) => {
			expect(isValidLevel(level)).toBe(false);
		}
	);
});

describe('isValidMode', () => {
	it.each(['pretty', 'json', 'silent'])(
		'returns true for valid mode "%s"',
		(mode) => {
			expect(isValidMode(mode)).toBe(true);
		}
	);

	it.each(['xml', 'text', '', 'JSON'])(
		'returns false for invalid mode "%s"',
		(mode) => {
			expect(isValidMode(mode)).toBe(false);
		}
	);
});

describe('validateConfig', () => {
	it('does not throw for empty config', () => {
		expect(() => validateConfig({})).not.toThrow();
	});

	it('does not throw for valid full config', () => {
		expect(() =>
			validateConfig({ level: 'debug', mode: 'json', serviceName: 'api' })
		).not.toThrow();
	});

	it('throws for invalid level', () => {
		expect(() =>
			validateConfig({ level: 'verbose' as never })
		).toThrow('Invalid log level: "verbose"');
	});

	it('throws for invalid mode', () => {
		expect(() =>
			validateConfig({ mode: 'xml' as never })
		).toThrow('Invalid log mode: "xml"');
	});

	it('throws for empty serviceName', () => {
		expect(() =>
			validateConfig({ serviceName: '' })
		).toThrow('serviceName cannot be empty');
	});

	it('throws for whitespace-only serviceName', () => {
		expect(() =>
			validateConfig({ serviceName: '   ' })
		).toThrow('serviceName cannot be empty');
	});
});