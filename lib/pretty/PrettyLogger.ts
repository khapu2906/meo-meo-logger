import { colorize } from '@utils/color';
import {
	drawBoxBottom,
	drawBoxCenteredRow,
	drawBoxDivider,
	drawBoxRow,
	drawBoxTop,
} from '@utils/format';

const WIDTH = 64;
const IS_DEV = process.env['NODE_ENV'] !== 'production';

type ModuleStatus = 'registering' | 'registered' | 'bootstrapping' | 'bootstrapped';

export class PrettyLogger {

	// ---------- Box ----------

	static box(title: string, width = WIDTH): void {
		console.log(drawBoxTop(width));
		console.log(drawBoxCenteredRow(` ${title} `, width, 'bright', IS_DEV));
		console.log(drawBoxBottom(width));
	}

	// ---------- Section ----------

	static section(title: string): void {
		const bar = '━'.repeat(Math.max(0, 50 - title.length));
		console.log();
		console.log(
			colorize(`━━━ ${title} `, 'bright', IS_DEV) +
			colorize(bar, 'dim', IS_DEV)
		);
	}

	static line(): void {
		console.log();
	}

	// ---------- Banner ----------

	static banner(config: {
		name: string;
		version?: string;
		environment: string;
		port: number;
	}): void {
		console.log(drawBoxTop(WIDTH));

		if (config.version) {
			console.log(drawBoxCenteredRow(` ${config.name} `, WIDTH, 'bright', IS_DEV));
			console.log(drawBoxCenteredRow(`v${config.version}`, WIDTH, 'dim', IS_DEV));
			console.log(drawBoxCenteredRow(config.environment.toUpperCase(), WIDTH, 'cyan', IS_DEV));
		} else {
			console.log(drawBoxCenteredRow(` ${config.name} ${config.environment.toUpperCase()} `, WIDTH, 'bright', IS_DEV));
		}

		console.log(drawBoxBottom(WIDTH));
	}

	// ---------- Step ----------

	static step(step: number, total: number, message: string): void {
		const stepText = colorize(`[${step}/${total}]`, 'magenta', IS_DEV);
		const arrow = colorize('▶', 'blue', IS_DEV);
		console.log(`${stepText} ${arrow} ${message}`);
	}

	// ---------- Module ----------

	static module(name: string, status: ModuleStatus): void {
		const icons: Record<ModuleStatus, string> = {
			registering: '📦',
			registered: '✓ ',
			bootstrapping: '🔧',
			bootstrapped: '✓ ',
		};

		const statusColors: Record<ModuleStatus, Parameters<typeof colorize>[1]> = {
			registering: 'cyan',
			registered: 'green',
			bootstrapping: 'cyan',
			bootstrapped: 'green',
		};

		const icon = icons[status];
		const statusText = colorize(status.toUpperCase().padEnd(14), statusColors[status], IS_DEV);
		const moduleName = colorize(name, 'bright', IS_DEV);

		console.log(`   ${icon} ${statusText} ${moduleName}`);
	}

	// ---------- Server Ready ----------

	static serverReady(config: {
		port: number;
		baseUrl?: string;
		routes: { label: string; path: string; icon?: string }[];
	}): void {
		const baseUrl = config.baseUrl ?? `http://localhost:${config.port}`;

		console.log();
		console.log(drawBoxTop(WIDTH));
		console.log(drawBoxCenteredRow(` Server running at ${baseUrl} `, WIDTH, 'green', IS_DEV));
		console.log(drawBoxDivider(WIDTH));

		for (const route of config.routes) {
			const icon = route.icon ?? '→';
			const label = route.label.padEnd(12);
			const url = `${baseUrl}${route.path}`;
			console.log(drawBoxRow(` ${icon} ${label} ${url}`, WIDTH));
		}

		console.log(drawBoxBottom(WIDTH));
		console.log();
	}
}