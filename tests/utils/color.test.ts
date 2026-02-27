import { describe, expect, it } from 'vitest';
import { bold, colorize, dim } from '@utils/color';
import { COLORS } from '@shared/constants';

describe('colorize', () => {
	it('wraps text with ANSI codes when enabled', () => {
		const result = colorize('hello', 'red', true);
		expect(result).toBe(`${COLORS.red}hello${COLORS.reset}`);
	});

	it('returns plain text when disabled', () => {
		const result = colorize('hello', 'red', false);
		expect(result).toBe('hello');
	});

	it('applies correct color for each key', () => {
		const keys = Object.keys(COLORS) as (keyof typeof COLORS)[];
		for (const key of keys) {
			const result = colorize('x', key, true);
			expect(result).toContain(COLORS[key]);
			expect(result).toContain(COLORS.reset);
		}
	});
});

describe('bold', () => {
	it('applies bright color when enabled', () => {
		expect(bold('text', true)).toBe(`${COLORS.bright}text${COLORS.reset}`);
	});

	it('returns plain when disabled', () => {
		expect(bold('text', false)).toBe('text');
	});
});

describe('dim', () => {
	it('applies dim color when enabled', () => {
		expect(dim('text', true)).toBe(`${COLORS.dim}text${COLORS.reset}`);
	});

	it('returns plain when disabled', () => {
		expect(dim('text', false)).toBe('text');
	});
});