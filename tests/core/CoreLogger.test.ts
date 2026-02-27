import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreLogger } from '@core/CoreLogger';
import type { LogEntry } from '@shared/types';

// Reset static state trước mỗi test
beforeEach(() => {
	CoreLogger.configure({ level: 'debug', mode: 'pretty', serviceName: 'test', transports: [] });
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

// ---------- Helper ----------
function getLastLog(): unknown[] {
	return vi.mocked(console.log).mock.calls.at(-1) ?? [];
}

function getLastLogString(): string {
	return String(getLastLog()[0]);
}

function getLastJsonPayload(): Record<string, unknown> {
	return JSON.parse(getLastLogString());
}

// ---------- Log levels ----------
describe('log levels', () => {
	it('logs debug when level is debug', () => {
		CoreLogger.debug('msg');
		expect(console.log).toHaveBeenCalledOnce();
	});

	it('suppresses debug when level is info', () => {
		CoreLogger.configure({ level: 'info' });
		CoreLogger.debug('hidden');
		expect(console.log).not.toHaveBeenCalled();
	});

	it('suppresses info and debug when level is warn', () => {
		CoreLogger.configure({ level: 'warn' });
		CoreLogger.debug('x');
		CoreLogger.info('x');
		CoreLogger.warn('visible');
		CoreLogger.error('visible');
		expect(console.log).toHaveBeenCalledTimes(2);
	});

	it('only logs error when level is error', () => {
		CoreLogger.configure({ level: 'error' });
		CoreLogger.debug('x');
		CoreLogger.info('x');
		CoreLogger.warn('x');
		CoreLogger.error('visible');
		expect(console.log).toHaveBeenCalledOnce();
	});
});

// ---------- Silent ----------
describe('silent mode', () => {
	it('suppresses all output', () => {
		CoreLogger.configure({ mode: 'silent' });
		CoreLogger.debug('x');
		CoreLogger.info('x');
		CoreLogger.warn('x');
		CoreLogger.error('x');
		expect(console.log).not.toHaveBeenCalled();
	});
});

// ---------- Pretty mode ----------
describe('pretty mode', () => {
	it('includes message in output', () => {
		CoreLogger.info('hello world');
		expect(getLastLogString()).toContain('hello world');
	});

	it('includes level label in output', () => {
		CoreLogger.warn('something');
		expect(getLastLogString()).toContain('WARN');
	});

	it('includes meta as second argument', () => {
		CoreLogger.info('msg', { userId: 99 });
		const args = vi.mocked(console.log).mock.calls[0];
		expect(args?.[1]).toEqual({ userId: 99 });
	});

	it('does not pass meta argument when undefined', () => {
		CoreLogger.info('no meta');
		const args = vi.mocked(console.log).mock.calls[0];
		expect(args).toHaveLength(1);
	});
});

// ---------- JSON mode ----------
describe('json mode', () => {
	beforeEach(() => {
		CoreLogger.configure({ mode: 'json' });
	});

	it('outputs valid JSON string', () => {
		CoreLogger.info('test');
		expect(() => getLastJsonPayload()).not.toThrow();
	});

	it('payload contains required fields', () => {
		CoreLogger.info('hello', { requestId: 'abc' });
		const p = getLastJsonPayload();
		expect(p.level).toBe('info');
		expect(p.msg).toBe('hello');
		expect(p.service).toBe('test');
		expect(typeof p.time).toBe('string');
	});

	it('meta is merged into payload', () => {
		CoreLogger.info('msg', { userId: 42 });
		expect(getLastJsonPayload().userId).toBe(42);
	});

	it('reserved fields are not overwritten by meta', () => {
		CoreLogger.info('msg', { level: 'debug', msg: 'hacked', service: 'evil' });
		const p = getLastJsonPayload();
		expect(p.level).toBe('info');
		expect(p.msg).toBe('msg');
		expect(p.service).toBe('test');
	});

	it('scope key absent when not provided', () => {
		CoreLogger.info('no scope');
		expect('scope' in getLastJsonPayload()).toBe(false);
	});

	it('scope key present when scope provided', () => {
		CoreLogger.scope('auth').info('login');
		expect(getLastJsonPayload().scope).toBe('auth');
	});
});

// ---------- Scope ----------
describe('scope', () => {
	it('includes scope in pretty output', () => {
		CoreLogger.scope('database').info('connected');
		expect(getLastLogString()).toContain('[database]');
	});

	it('all level methods work on scoped logger', () => {
		const log = CoreLogger.scope('test');
		log.debug('d');
		log.info('i');
		log.warn('w');
		log.error('e');
		expect(console.log).toHaveBeenCalledTimes(4);
	});
});

// ---------- Timer ----------
describe('time', () => {
	it('logs elapsed time on end()', async () => {
		const t = CoreLogger.time('db.query');
		await new Promise(r => setTimeout(r, 20));
		t.end();
		expect(getLastLogString()).toMatch(/db\.query completed in \d+ms/);
	});

	it('includes scope when provided', () => {
		CoreLogger.time('op', 'MyService').end();
		const p = getLastLogString();
		expect(p).toContain('MyService');
	});

	it('includes meta when provided', () => {
		CoreLogger.configure({ mode: 'json' });
		CoreLogger.time('op').end({ rows: 5 });
		expect(getLastJsonPayload().rows).toBe(5);
	});

	it('elapsed time is non-negative', async () => {
		const t = CoreLogger.time('x');
		await new Promise(r => setTimeout(r, 10));
		t.end();
		const match = getLastLogString().match(/in (\d+)ms/);
		expect(Number(match?.[1])).toBeGreaterThanOrEqual(0);
	});
});

// ---------- Error serialization ----------
describe('error serialization in json mode', () => {
	beforeEach(() => {
		CoreLogger.configure({ mode: 'json' });
	});

	it('serializes Error objects in meta to plain object', () => {
		const err = new Error('db timeout');
		CoreLogger.error('query failed', { err });
		const p = getLastJsonPayload();
		const serialized = p['err'] as Record<string, unknown>;
		expect(serialized['message']).toBe('db timeout');
		expect(serialized['name']).toBe('Error');
		expect(typeof serialized['stack']).toBe('string');
	});

	it('does not produce empty {} for Error', () => {
		CoreLogger.error('failed', { err: new Error('oops') });
		const p = getLastJsonPayload();
		expect(p['err']).not.toEqual({});
	});
});

// ---------- Child ----------
describe('child', () => {
	it('injects context into every log call in json mode', () => {
		CoreLogger.configure({ mode: 'json' });
		const log = CoreLogger.child({ requestId: 'req-001', userId: 99 });
		log.info('processing');
		const p = getLastJsonPayload();
		expect(p['requestId']).toBe('req-001');
		expect(p['userId']).toBe(99);
		expect(p['msg']).toBe('processing');
	});

	it('injects context into pretty mode output', () => {
		const log = CoreLogger.child({ requestId: 'req-001' });
		log.warn('slow request');
		const args = vi.mocked(console.log).mock.calls[0];
		expect(args?.[1]).toMatchObject({ requestId: 'req-001' });
	});

	it('per-call meta overrides child context for same keys', () => {
		CoreLogger.configure({ mode: 'json' });
		const log = CoreLogger.child({ requestId: 'original' });
		log.info('override', { requestId: 'overridden' });
		expect(getLastJsonPayload()['requestId']).toBe('overridden');
	});

	it('child().scope() includes both context and scope', () => {
		CoreLogger.configure({ mode: 'json' });
		const log = CoreLogger.child({ requestId: 'req-002' });
		log.scope('AuthModule').info('token validated');
		const p = getLastJsonPayload();
		expect(p['requestId']).toBe('req-002');
		expect(p['scope']).toBe('AuthModule');
	});

	it('all level methods work on child logger', () => {
		const log = CoreLogger.child({ traceId: 'x' });
		log.debug('d');
		log.info('i');
		log.warn('w');
		log.error('e');
		expect(console.log).toHaveBeenCalledTimes(4);
	});
});

// ---------- Configure ----------
describe('configure', () => {
	it('throws for invalid level', () => {
		expect(() =>
			CoreLogger.configure({ level: 'trace' as never })
		).toThrow('Invalid log level');
	});

	it('throws for invalid mode', () => {
		expect(() =>
			CoreLogger.configure({ mode: 'xml' as never })
		).toThrow('Invalid log mode');
	});

	it('throws for empty serviceName', () => {
		expect(() =>
			CoreLogger.configure({ serviceName: '  ' })
		).toThrow('serviceName cannot be empty');
	});

	it('getLevel reflects updated level', () => {
		CoreLogger.configure({ level: 'error' });
		expect(CoreLogger.getLevel()).toBe('error');
	});

	it('getMode reflects updated mode', () => {
		CoreLogger.configure({ mode: 'silent' });
		expect(CoreLogger.getMode()).toBe('silent');
	});
});

// ---------- Transports ----------
describe('transports', () => {
	it('calls transport.write for each log entry', () => {
		const entries: unknown[] = [];
		CoreLogger.configure({
			transports: [{ write: (e) => { entries.push(e); } }],
		});
		CoreLogger.info('hello transport');
		expect(entries).toHaveLength(1);
	});

	it('transport entry contains required fields', () => {
		let captured: unknown;
		CoreLogger.configure({
			transports: [{ write: (e) => { captured = e; } }],
		});
		CoreLogger.info('test entry', { userId: 7 });
		const entry = captured as Record<string, unknown>;
		expect(entry['level']).toBe('info');
		expect(entry['msg']).toBe('test entry');
		expect(typeof entry['time']).toBe('string');
		expect(entry['service']).toBe('test');
	});

	it('transport entry includes meta', () => {
		let captured: unknown;
		CoreLogger.configure({
			transports: [{ write: (e) => { captured = e; } }],
		});
		CoreLogger.warn('with meta', { requestId: 'abc' });
		const entry = captured as Record<string, unknown>;
		const meta = entry['meta'] as Record<string, unknown>;
		expect(meta['requestId']).toBe('abc');
	});

	it('transport entry includes scope when provided', () => {
		let captured: unknown;
		CoreLogger.configure({
			transports: [{ write: (e) => { captured = e; } }],
		});
		CoreLogger.scope('Auth').error('forbidden');
		expect((captured as Record<string, unknown>)['scope']).toBe('Auth');
	});

	it('addTransport appends without replacing existing ones', () => {
		const calls: string[] = [];
		CoreLogger.configure({ transports: [{ write: () => { calls.push('first'); } }] });
		CoreLogger.addTransport({ write: () => { calls.push('second'); } });
		CoreLogger.info('ping');
		expect(calls).toEqual(['first', 'second']);
	});

	it('transport error does not crash the logger', () => {
		CoreLogger.configure({
			transports: [{ write: () => { throw new Error('transport failed'); } }],
		});
		expect(() => CoreLogger.info('safe')).not.toThrow();
	});

	it('respects log level filter before dispatching to transports', () => {
		const entries: unknown[] = [];
		CoreLogger.configure({
			level: 'warn',
			transports: [{ write: (e) => { entries.push(e); } }],
		});
		CoreLogger.debug('ignored');
		CoreLogger.info('also ignored');
		CoreLogger.warn('captured');
		expect(entries).toHaveLength(1);
	});
});

// Helper: normalise single entry or batch to flat array
function toEntries(e: LogEntry | LogEntry[]): LogEntry[] {
	return Array.isArray(e) ? e : [e];
}

// ---------- TransportConfig ----------
describe('TransportConfig — filtering', () => {
	it('minLevel drops entries below threshold', async () => {
		const received: LogEntry[] = [];
		CoreLogger.configure({
			transports: [{
				transport: { write: (e) => { received.push(...toEntries(e)); } },
				minLevel: 'warn',
			}],
		});
		CoreLogger.info('ignored');
		CoreLogger.warn('captured');
		await CoreLogger.flush();
		expect(received).toHaveLength(1);
		expect(received[0]?.level).toBe('warn');
	});

	it('filter predicate drops non-matching entries', async () => {
		const received: LogEntry[] = [];
		CoreLogger.configure({
			transports: [{
				transport: { write: (e) => { received.push(...toEntries(e)); } },
				filter: (e) => e.msg.startsWith('KEEP'),
			}],
		});
		CoreLogger.info('DISCARD this');
		CoreLogger.info('KEEP this');
		await CoreLogger.flush();
		expect(received).toHaveLength(1);
		expect(received[0]?.msg).toBe('KEEP this');
	});

	it('minLevel and filter both apply (AND logic)', async () => {
		const received: LogEntry[] = [];
		CoreLogger.configure({
			transports: [{
				transport: { write: (e) => { received.push(...toEntries(e)); } },
				minLevel: 'warn',
				filter: (e) => e.msg !== 'noise',
			}],
		});
		CoreLogger.info('too low');
		CoreLogger.warn('noise');
		CoreLogger.error('captured');
		await CoreLogger.flush();
		expect(received).toHaveLength(1);
		expect(received[0]?.level).toBe('error');
	});
});

describe('TransportConfig — batching', () => {
	it('buffers entries until batchSize is reached', async () => {
		const batches: unknown[] = [];
		CoreLogger.configure({
			transports: [{
				transport: { write: (e) => { batches.push(e); } },
				batchSize: 3,
			}],
		});
		CoreLogger.info('a');
		CoreLogger.info('b');
		expect(batches).toHaveLength(0);
		CoreLogger.info('c'); // triggers flush
		await CoreLogger.flush();
		expect(batches).toHaveLength(1);
		expect(Array.isArray(batches[0])).toBe(true);
		expect((batches[0] as LogEntry[]).length).toBe(3);
	});

	it('flushInterval fires even if batchSize not reached', async () => {
		vi.useFakeTimers();
		const received: LogEntry[] = [];
		CoreLogger.configure({
			transports: [{
				transport: { write: (e) => { received.push(...toEntries(e)); } },
				batchSize: 100,
				flushInterval: 500,
			}],
		});
		CoreLogger.info('early');
		expect(received).toHaveLength(0);
		vi.advanceTimersByTime(500);
		await CoreLogger.flush();
		expect(received).toHaveLength(1);
	});

	it('maxQueueSize evicts oldest entries', async () => {
		const received: LogEntry[] = [];
		CoreLogger.configure({
			transports: [{
				transport: { write: (e) => { received.push(...toEntries(e)); } },
				batchSize: 10,
				maxQueueSize: 2,
			}],
		});
		CoreLogger.info('first');
		CoreLogger.info('second');
		CoreLogger.info('third'); // evicts 'first'
		await CoreLogger.flush();
		expect(received).toHaveLength(2);
		expect(received[0]?.msg).toBe('second');
		expect(received[1]?.msg).toBe('third');
	});

	it('single entry transport receives LogEntry not array when batchSize=1', async () => {
		let payload: LogEntry | LogEntry[] | undefined;
		CoreLogger.configure({
			transports: [{ write: (e) => { payload = e; } }],
		});
		CoreLogger.info('single');
		await CoreLogger.flush();
		expect(Array.isArray(payload)).toBe(false);
	});
});

describe('TransportConfig — rateLimit', () => {
	it('drops entries exceeding rateLimit per second', async () => {
		vi.useFakeTimers();
		const received: LogEntry[] = [];
		CoreLogger.configure({
			transports: [{
				transport: { write: (e) => { received.push(...toEntries(e)); } },
				rateLimit: 2,
			}],
		});
		CoreLogger.info('1');
		CoreLogger.info('2');
		CoreLogger.info('3'); // dropped
		await CoreLogger.flush();
		expect(received).toHaveLength(2);
	});

	it('rateLimit resets after 1 second', async () => {
		vi.useFakeTimers();
		const received: LogEntry[] = [];
		CoreLogger.configure({
			transports: [{
				transport: { write: (e) => { received.push(...toEntries(e)); } },
				rateLimit: 1,
			}],
		});
		CoreLogger.info('allowed');
		CoreLogger.info('dropped');
		vi.advanceTimersByTime(1001);
		CoreLogger.info('allowed again');
		await CoreLogger.flush();
		expect(received).toHaveLength(2);
		expect(received[0]?.msg).toBe('allowed');
		expect(received[1]?.msg).toBe('allowed again');
	});
});

describe('TransportConfig — retry', () => {
	it('retries failed async transport up to maxRetries times', async () => {
		let callCount = 0;
		CoreLogger.configure({
			transports: [{
				transport: {
					write: () => {
						callCount++;
						if (callCount < 3) return Promise.reject(new Error('fail'));
						return Promise.resolve();
					},
				},
				maxRetries: 3,
				retryDelay: 0,
			}],
		});
		CoreLogger.info('test');
		await CoreLogger.flush();
		expect(callCount).toBe(3);
	});

	it('does not crash when all retries exhausted', async () => {
		CoreLogger.configure({
			transports: [{
				transport: { write: () => Promise.reject(new Error('always fail')) },
				maxRetries: 2,
				retryDelay: 0,
			}],
		});
		CoreLogger.info('will fail');
		await expect(CoreLogger.flush()).resolves.not.toThrow();
	});
});

describe('CoreLogger.flush()', () => {
	it('returns Promise<void>', () => {
		expect(CoreLogger.flush()).toBeInstanceOf(Promise);
	});

	it('forces immediate write of pending batched entries', async () => {
		const received: LogEntry[] = [];
		CoreLogger.configure({
			transports: [{
				transport: { write: (e) => { received.push(...toEntries(e)); } },
				batchSize: 100,
			}],
		});
		CoreLogger.info('pending');
		expect(received).toHaveLength(0);
		await CoreLogger.flush();
		expect(received).toHaveLength(1);
	});
});

describe('TransportConfig — backward compat', () => {
	it('plain LogTransport still works without TransportConfig wrapper', async () => {
		const received: LogEntry[] = [];
		CoreLogger.configure({
			transports: [{ write: (e) => { received.push(...toEntries(e)); } }],
		});
		CoreLogger.info('plain transport');
		await CoreLogger.flush();
		expect(received).toHaveLength(1);
	});

	it('addTransport() without config works as before', async () => {
		const calls: number[] = [];
		CoreLogger.addTransport({ write: () => { calls.push(1); } });
		CoreLogger.info('added');
		await CoreLogger.flush();
		expect(calls).toHaveLength(1);
	});

	it('addTransport() with config applies batching', async () => {
		const batches: unknown[] = [];
		CoreLogger.addTransport(
			{ write: (e) => { batches.push(e); } },
			{ batchSize: 2 },
		);
		CoreLogger.info('a');
		expect(batches).toHaveLength(0);
		CoreLogger.info('b');
		await CoreLogger.flush();
		expect(batches).toHaveLength(1);
	});

	it('configure() destroys old slot timers when transports replaced', async () => {
		const received: LogEntry[] = [];
		CoreLogger.configure({
			transports: [{
				transport: { write: () => { /* old transport */ } },
				batchSize: 100,
				flushInterval: 60000,
			}],
		});
		CoreLogger.info('queued in old transport');
		// Replace — old timer must be cleared
		CoreLogger.configure({
			transports: [{ write: (e) => { received.push(...toEntries(e)); } }],
		});
		CoreLogger.info('goes to new transport');
		await CoreLogger.flush();
		expect(received).toHaveLength(1);
		expect(received[0]?.msg).toBe('goes to new transport');
	});
});