/**
 * Example 02 — JSON mode + child logger
 *
 * Shows production-style structured logging with child loggers
 * that automatically inject request context into every entry.
 *
 * Run: npx tsx examples/02-json-mode.ts
 */

import { CoreLogger } from '../lib/index';

CoreLogger.configure({
	level: 'info',
	mode: 'json',
	serviceName: 'order-service',
});

// Simulated HTTP request handler
function handleRequest(requestId: string, userId: number) {
	// child() binds context to every log call automatically
	const log = CoreLogger.child({ requestId, userId });

	log.info('Request received', { method: 'POST', path: '/orders' });

	const dbLog = log.scope('Database');
	dbLog.debug('Query executed', { table: 'orders', ms: 12 });

	// Error objects serialize correctly
	try {
		throw new Error('Unique constraint violation');
	} catch (err) {
		log.error('Order creation failed', { err });
	}
}

handleRequest('req-abc-123', 99);
handleRequest('req-def-456', 7);
