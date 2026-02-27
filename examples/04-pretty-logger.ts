/**
 * Example 04 — PrettyLogger (startup UI)
 *
 * Shows how to use PrettyLogger for structured startup output:
 * - banner()     → app name / version / environment header box
 * - section()    → named section divider
 * - step()       → numbered progress step
 * - module()     → module lifecycle status (registering → registered → bootstrapping → bootstrapped)
 * - serverReady() → server URL box with route listing
 * - box()        → generic titled box
 * - line()       → blank line separator
 *
 * Run: npx tsx examples/04-pretty-logger.ts
 */

import { PrettyLogger } from '../lib/pretty/PrettyLogger';
import { CoreLogger } from '../lib/index';

// ---------- 1. App startup banner ----------

PrettyLogger.banner({
	name: 'MyApp',
	version: '1.1.0',
	environment: 'development',
	port: 3000,
});

// ---------- 2. Boot steps ----------

PrettyLogger.section('Bootstrapping');

PrettyLogger.step(1, 4, 'Loading configuration');
PrettyLogger.step(2, 4, 'Connecting to database');
PrettyLogger.step(3, 4, 'Registering modules');
PrettyLogger.step(4, 4, 'Starting HTTP server');

// ---------- 3. Module lifecycle ----------

PrettyLogger.section('Modules');

PrettyLogger.module('AuthModule', 'registering');
PrettyLogger.module('AuthModule', 'registered');
PrettyLogger.module('UserModule', 'bootstrapping');
PrettyLogger.module('UserModule', 'bootstrapped');

// ---------- 4. Combined with CoreLogger ----------

PrettyLogger.section('Application Logs');

CoreLogger.configure({ level: 'debug', mode: 'pretty', serviceName: 'my-app' });

const db = CoreLogger.scope('database');
db.info('Connected to PostgreSQL', { host: 'localhost', port: 5432 });

const auth = CoreLogger.scope('auth');
auth.info('JWT secret loaded');
auth.warn('Token expiry set to 1h — consider shorter for production');

const t = CoreLogger.time('startup');
// simulate async boot time
void (async () => {
	await new Promise(r => setTimeout(r, 5));
	t.end();
})();

// ---------- 5. Server ready box ----------

PrettyLogger.serverReady({
	port: 3000,
	routes: [
		{ label: 'REST API',   path: '/api',        icon: '⚡' },
		{ label: 'Health',     path: '/healthz',     icon: '💚' },
		{ label: 'Docs',       path: '/api/docs',    icon: '📖' },
		{ label: 'Metrics',    path: '/metrics',     icon: '📊' },
	],
});

// ---------- 6. Generic box ----------

PrettyLogger.box('Startup complete — press Ctrl+C to stop');
