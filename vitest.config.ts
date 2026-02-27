// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
	resolve: {
		alias: {
			'@shared': resolve(__dirname, 'lib/shared'),
			'@utils': resolve(__dirname, 'lib/utils'),
			'@core': resolve(__dirname, 'lib/core'),
			'@browser': resolve(__dirname, 'lib/browser'),
			'@pretty': resolve(__dirname, 'lib/pretty'),
		},
		extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
	},
	test: {
		globals: true,
		environment: 'node',
		setupFiles: ['./tests/setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			include: ['lib/**'],
			exclude: ['lib/index.ts', 'lib/browser.ts'],
			thresholds: {
				lines: 80,
				functions: 80,
			},
		},
	},
});