import { describe, expect, it } from 'vitest';
import {
	drawBoxBottom,
	drawBoxCenteredRow,
	drawBoxDivider,
	drawBoxRow,
	drawBoxTop,
	padCenter,
	serializeMeta,
	timestamp,
} from '@utils/format';
import { BOX } from '@shared/constants';

describe('timestamp', () => {
	it('returns valid ISO string', () => {
		const ts = timestamp();
		expect(() => new Date(ts)).not.toThrow();
		expect(new Date(ts).toISOString()).toBe(ts);
	});
});

describe('padCenter', () => {
	it('centers text within given width', () => {
		const result = padCenter('hi', 10);
		expect(result.length).toBe(10);
		expect(result.trim()).toBe('hi');
	});

	it('handles text longer than width gracefully', () => {
		const result = padCenter('toolongtext', 4);
		// tidak crash, panjang minimal = panjang text
		expect(result).toContain('toolongtext');
	});

	it('handles exact fit', () => {
		const result = padCenter('abcd', 4);
		expect(result).toBe('abcd');
	});
});

describe('drawBoxTop', () => {
	it('starts with topLeft corner', () => {
		expect(drawBoxTop(10).startsWith(BOX.topLeft)).toBe(true);
	});

	it('ends with topRight corner', () => {
		expect(drawBoxTop(10).endsWith(BOX.topRight)).toBe(true);
	});

	it('has correct total length', () => {
		expect(drawBoxTop(20).length).toBe(20);
	});
});

describe('drawBoxBottom', () => {
	it('starts with bottomLeft corner', () => {
		expect(drawBoxBottom(10).startsWith(BOX.bottomLeft)).toBe(true);
	});

	it('ends with bottomRight corner', () => {
		expect(drawBoxBottom(10).endsWith(BOX.bottomRight)).toBe(true);
	});
});

describe('drawBoxDivider', () => {
	it('uses leftT and rightT', () => {
		const result = drawBoxDivider(10);
		expect(result.startsWith(BOX.leftT)).toBe(true);
		expect(result.endsWith(BOX.rightT)).toBe(true);
	});
});

describe('drawBoxRow', () => {
	it('wraps content in vertical bars', () => {
		const result = drawBoxRow('hello', 20);
		expect(result.startsWith(BOX.vertical)).toBe(true);
		expect(result.endsWith(BOX.vertical)).toBe(true);
		expect(result).toContain('hello');
	});

	it('pads content to fill width', () => {
		// strip ANSI → count visible chars
		const result = drawBoxRow('hi', 20);
		expect(result.length).toBe(20);
	});

	it('does not crash when content exceeds width', () => {
		expect(() => drawBoxRow('a'.repeat(100), 10)).not.toThrow();
	});
});

describe('serializeMeta', () => {
	it('converts Error instances to plain objects', () => {
		const err = new Error('something went wrong');
		const result = serializeMeta({ err });
		const serialized = result['err'] as Record<string, unknown>;
		expect(serialized['message']).toBe('something went wrong');
		expect(serialized['name']).toBe('Error');
		expect(typeof serialized['stack']).toBe('string');
	});

	it('preserves non-Error values unchanged', () => {
		const result = serializeMeta({ userId: 42, active: true, tags: ['a', 'b'] });
		expect(result['userId']).toBe(42);
		expect(result['active']).toBe(true);
		expect(result['tags']).toEqual(['a', 'b']);
	});

	it('handles mixed meta with both Error and plain values', () => {
		const err = new TypeError('bad type');
		const result = serializeMeta({ err, requestId: 'abc-123' });
		expect((result['err'] as Record<string, unknown>)['name']).toBe('TypeError');
		expect(result['requestId']).toBe('abc-123');
	});

	it('serializes deeply nested Error objects', () => {
		const err = new Error('nested');
		const result = serializeMeta({ context: { err } });
		const context = result['context'] as Record<string, unknown>;
		const serialized = context['err'] as Record<string, unknown>;
		expect(serialized['message']).toBe('nested');
		expect(serialized['name']).toBe('Error');
	});

	it('preserves arrays unchanged', () => {
		const result = serializeMeta({ ids: [1, 2, 3] });
		expect(result['ids']).toEqual([1, 2, 3]);
	});
});

describe('drawBoxCenteredRow', () => {
	it('wraps in vertical bars', () => {
		const result = drawBoxCenteredRow('hello', 20, undefined, false);
		expect(result.startsWith(BOX.vertical)).toBe(true);
		expect(result.endsWith(BOX.vertical)).toBe(true);
	});

	it('contains the text', () => {
		const result = drawBoxCenteredRow('hello', 40, undefined, false);
		expect(result).toContain('hello');
	});

	it('does not crash with color enabled', () => {
		expect(() =>
			drawBoxCenteredRow('test', 40, 'green', true)
		).not.toThrow();
	});
});