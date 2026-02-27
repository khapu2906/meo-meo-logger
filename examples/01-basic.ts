/**
 * Example 01 — Basic usage
 *
 * Demonstrates the four log levels, scoped loggers, and timers.
 * Run: npx tsx examples/01-basic.ts
 */

import { CoreLogger } from '../lib/index';

// ---------- Basic levels ----------

CoreLogger.configure({ level: 'debug', mode: 'pretty', serviceName: 'my-app' });

CoreLogger.debug('Booting up', { pid: process.pid });
CoreLogger.info('Server started', { port: 3000 });
CoreLogger.warn('Memory usage high', { heap: '88%' });
CoreLogger.error('DB connection lost', { host: 'db.local', attempt: 3 });

// ---------- Scoped logger ----------

const authLog = CoreLogger.scope('AuthModule');

authLog.info('User logged in', { userId: 42 });
authLog.warn('Invalid token attempt', { ip: '192.168.1.10' });

// ---------- Timer ----------

const t = CoreLogger.time('db.findUser', 'Database');
void (async () => {
	// simulate async work
	await new Promise(r => setTimeout(r, 30));
	t.end({ rows: 1 });
})();
