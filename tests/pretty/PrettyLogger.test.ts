import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrettyLogger } from '@pretty/PrettyLogger';

afterEach(() => vi.restoreAllMocks());

function getAllOutput(): string {
	return vi.mocked(console.log).mock.calls.flat().join('\n');
}

// ---------- box ----------
describe('box', () => {
	it('renders without throwing', () => {
		expect(() => PrettyLogger.box('Hello')).not.toThrow();
	});

	it('contains the title', () => {
		PrettyLogger.box('MyApp');
		expect(getAllOutput()).toContain('MyApp');
	});

	it('does not crash when title exceeds width', () => {
		expect(() => PrettyLogger.box('A'.repeat(200), 20)).not.toThrow();
	});

	it('calls console.log 3 times (top, content, bottom)', () => {
		PrettyLogger.box('Test');
		expect(console.log).toHaveBeenCalledTimes(3);
	});
});

// ---------- section ----------
describe('section', () => {
	it('renders without throwing', () => {
		expect(() => PrettyLogger.section('Setup')).not.toThrow();
	});

	it('contains the section title', () => {
		PrettyLogger.section('Database');
		expect(getAllOutput()).toContain('Database');
	});

	it('does not crash with long title', () => {
		expect(() => PrettyLogger.section('A'.repeat(100))).not.toThrow();
	});
});

// ---------- banner ----------
describe('banner', () => {
	it('renders without throwing', () => {
		expect(() =>
			PrettyLogger.banner({
				name: 'MyApp',
				version: '1.0.0',
				environment: 'development',
				port: 3000,
			})
		).not.toThrow();
	});

	it('contains app name', () => {
		PrettyLogger.banner({ name: 'Rocket', environment: 'dev', port: 8080 });
		expect(getAllOutput()).toContain('Rocket');
	});

	it('contains version when provided', () => {
		PrettyLogger.banner({ name: 'App', version: '2.5.0', environment: 'dev', port: 3000 });
		expect(getAllOutput()).toContain('2.5.0');
	});

	it('skips version row when not provided', () => {
		// with version: 4 rows (top, name, env, bottom)
		// without version: 3 rows
		PrettyLogger.banner({ name: 'App', environment: 'dev', port: 3000 });
		expect(console.log).toHaveBeenCalledTimes(3);
	});

	it('contains environment', () => {
		PrettyLogger.banner({ name: 'App', environment: 'staging', port: 3000 });
		expect(getAllOutput()).toContain('STAGING');
	});
});

// ---------- step ----------
describe('step', () => {
	it('renders without throwing', () => {
		expect(() => PrettyLogger.step(1, 5, 'Connecting')).not.toThrow();
	});

	it('contains step counter', () => {
		PrettyLogger.step(2, 4, 'Loading config');
		expect(getAllOutput()).toContain('2/4');
	});

	it('contains the message', () => {
		PrettyLogger.step(1, 1, 'Done!');
		expect(getAllOutput()).toContain('Done!');
	});
});

// ---------- module ----------
describe('module', () => {
	it.each(['registering', 'registered', 'bootstrapping', 'bootstrapped'] as const)(
		'renders status "%s" without throwing',
		(status) => {
			expect(() => PrettyLogger.module('AuthModule', status)).not.toThrow();
		}
	);

	it('contains module name', () => {
		PrettyLogger.module('DatabaseModule', 'bootstrapped');
		expect(getAllOutput()).toContain('DatabaseModule');
	});

	it('contains status label', () => {
		PrettyLogger.module('X', 'registering');
		expect(getAllOutput()).toContain('REGISTERING');
	});
});

// ---------- serverReady ----------
describe('serverReady', () => {
	it('renders without throwing', () => {
		expect(() =>
			PrettyLogger.serverReady({ port: 3000, routes: [] })
		).not.toThrow();
	});

	it('contains all route paths', () => {
		PrettyLogger.serverReady({
			port: 3000,
			routes: [
				{ label: 'API', path: '/api' },
				{ label: 'Health', path: '/health' },
				{ label: 'Docs', path: '/docs' },
			],
		});
		const out = getAllOutput();
		expect(out).toContain('/api');
		expect(out).toContain('/health');
		expect(out).toContain('/docs');
	});

	it('contains the port', () => {
		PrettyLogger.serverReady({ port: 8080, routes: [] });
		expect(getAllOutput()).toContain('8080');
	});

	it('uses custom icon when provided', () => {
		PrettyLogger.serverReady({
			port: 3000,
			routes: [{ label: 'API', path: '/api', icon: '🚀' }],
		});
		expect(getAllOutput()).toContain('🚀');
	});

	it('falls back to → when icon not provided', () => {
		PrettyLogger.serverReady({
			port: 3000,
			routes: [{ label: 'API', path: '/api' }],
		});
		expect(getAllOutput()).toContain('→');
	});
});