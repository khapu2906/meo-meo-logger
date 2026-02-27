import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserLogger } from '../../lib/browser/BrowserLogger';

describe('BrowserLogger', () => {
	beforeEach(() => {
		BrowserLogger.configure({ level: 'debug', mode: 'pretty', serviceName: 'test' });
		vi.spyOn(console, 'log').mockImplementation(() => { });
	});

	afterEach(() => vi.restoreAllMocks());

	it('logs with CSS style in pretty mode', () => {
		BrowserLogger.info('hello');
		const args = vi.mocked(console.log).mock.calls[0];
		// first arg là format string với %c
		expect(args?.[0]).toContain('%c');
		// second arg là CSS string
		expect(args?.[1]).toContain('color:');
	});

	it('silent mode logs nothing', () => {
		BrowserLogger.configure({ mode: 'silent' });
		BrowserLogger.info('x');
		expect(console.log).not.toHaveBeenCalled();
	});

	it('json mode logs an object not a string', () => {
		BrowserLogger.configure({ mode: 'json' });
		BrowserLogger.info('test', { userId: 1 });
		const arg = vi.mocked(console.log).mock.calls[0]?.[0];
		expect(typeof arg).toBe('object');
		expect((arg as Record<string, unknown>).msg).toBe('test');
	});

	it('scope appears in output', () => {
		const log = BrowserLogger.scope('payment');
		log.warn('retry');
		const arg = vi.mocked(console.log).mock.calls[0]?.[0] as string;
		expect(arg).toContain('[payment]');
	});

	it('timer logs elapsed time', async () => {
		const t = BrowserLogger.time('fetch');
		await new Promise(r => setTimeout(r, 10));
		t.end();
		const arg = vi.mocked(console.log).mock.calls[0]?.[2] as string;
		expect(arg).toMatch(/fetch completed in [\d.]+ms/);
	});

	it('serializes Error in json mode', () => {
		BrowserLogger.configure({ mode: 'json' });
		const err = new Error('network failure');
		BrowserLogger.error('fetch failed', { err });
		const arg = vi.mocked(console.log).mock.calls[0]?.[0] as Record<string, unknown>;
		const serialized = arg['err'] as Record<string, unknown>;
		expect(serialized['message']).toBe('network failure');
		expect(serialized['name']).toBe('Error');
	});

	it('child injects context into json output', () => {
		BrowserLogger.configure({ mode: 'json' });
		const log = BrowserLogger.child({ requestId: 'req-browser-001' });
		log.info('mounted');
		const arg = vi.mocked(console.log).mock.calls[0]?.[0] as Record<string, unknown>;
		expect(arg['requestId']).toBe('req-browser-001');
		expect(arg['msg']).toBe('mounted');
	});

	it('child().scope() includes context and scope', () => {
		BrowserLogger.configure({ mode: 'json' });
		const log = BrowserLogger.child({ sessionId: 'sess-abc' });
		log.scope('Router').warn('redirect');
		const arg = vi.mocked(console.log).mock.calls[0]?.[0] as Record<string, unknown>;
		expect(arg['sessionId']).toBe('sess-abc');
		expect(arg['scope']).toBe('Router');
	});

	it('group and groupEnd call console', () => {
		vi.spyOn(console, 'group').mockImplementation(() => { });
		vi.spyOn(console, 'groupEnd').mockImplementation(() => { });
		BrowserLogger.group('Section');
		BrowserLogger.groupEnd();
		expect(console.group).toHaveBeenCalledWith('Section');
		expect(console.groupEnd).toHaveBeenCalled();
	});
});