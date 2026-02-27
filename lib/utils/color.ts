import { COLORS } from '@shared/constants';

export type ColorKey = keyof typeof COLORS;

export function colorize(
	text: string,
	color: ColorKey,
	enabled: boolean,
): string {
	if (!enabled) return text;
	return `${COLORS[color]}${text}${COLORS.reset}`;
}

export function bold(text: string, enabled: boolean): string {
	return colorize(text, 'bright', enabled);
}

export function dim(text: string, enabled: boolean): string {
	return colorize(text, 'dim', enabled);
}