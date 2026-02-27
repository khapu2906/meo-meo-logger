import { BOX } from '@shared/constants';
import type { LogMeta } from '@shared/types';
import type { ColorKey } from './color';
import { colorize } from './color';

export function timestamp(): string {
	return new Date().toISOString();
}

function serializeValue(value: unknown): unknown {
	if (value instanceof Error) {
		return {
			message: value.message,
			name: value.name,
			stack: value.stack,
		};
	}
	if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		const result: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			result[k] = serializeValue(v);
		}
		return result;
	}
	return value;
}

export function serializeMeta(meta: LogMeta): LogMeta {
	const result: LogMeta = {};
	for (const [key, value] of Object.entries(meta)) {
		result[key] = serializeValue(value);
	}
	return result;
}

export function padCenter(text: string, width: number): string {
	const total = Math.max(0, width - text.length);
	const left = Math.floor(total / 2);
	const right = total - left;
	return ' '.repeat(left) + text + ' '.repeat(right);
}

export function drawBoxTop(width: number): string {
	return BOX.topLeft + BOX.horizontal.repeat(width - 2) + BOX.topRight;
}

export function drawBoxBottom(width: number): string {
	return BOX.bottomLeft + BOX.horizontal.repeat(width - 2) + BOX.bottomRight;
}

export function drawBoxDivider(width: number): string {
	return BOX.leftT + BOX.horizontal.repeat(width - 2) + BOX.rightT;
}

export function drawBoxRow(content: string, width: number): string {
	const padding = Math.max(0, width - 2 - content.length);
	return BOX.vertical + content + ' '.repeat(padding) + BOX.vertical;
}

export function drawBoxCenteredRow(
	text: string,
	width: number,
	colorKey?: ColorKey,
	colorEnabled = true,
): string {
	const inner = width - 2;
	// pad trước khi colorize để tính đúng visible length
	const padded = padCenter(text, inner);
	const colored = colorKey
		? colorize(padded, colorKey, colorEnabled)
		: padded;

	return BOX.vertical + colored + BOX.vertical;
}