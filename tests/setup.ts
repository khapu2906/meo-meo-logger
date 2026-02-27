import { beforeEach, vi } from 'vitest';

// Mock console để test không spam terminal
beforeEach(() => {
	vi.spyOn(console, 'log').mockImplementation(() => { });
	vi.spyOn(console, 'warn').mockImplementation(() => { });
	vi.spyOn(console, 'error').mockImplementation(() => { });
});