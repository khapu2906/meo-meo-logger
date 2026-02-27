import { defineConfig } from 'tsup';

export default defineConfig([
	{
		entry: { index: 'lib/index.ts' },
		format: ['cjs', 'esm'],
		dts: true,
		clean: true,
		target: 'node18',
		platform: 'node',
		esbuildOptions(options) {
			options.alias = {
				'@shared': './lib/shared',
				'@utils': './lib/utils',
				'@core': './lib/core',
				'@pretty': './lib/pretty',
			};
		},
	},
	{
		entry: { browser: 'lib/browser.ts' },
		format: ['cjs', 'esm'],
		dts: true,
		target: 'es2020',
		platform: 'browser',
		esbuildOptions(options) {
			options.alias = {
				'@shared': './lib/shared',
				'@utils': './lib/utils',
				'@browser': './lib/browser',
			};
		},
	},
]);
