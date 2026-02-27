# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-02-27

### Added
- **`TransportConfig`** — optional wrapper around `LogTransport` with per-transport config:
  - `minLevel` — skip entries below this level before they enter the queue
  - `filter` — custom predicate `(entry) => boolean` for fine-grained routing
  - `batchSize` — buffer N entries before flushing (default: `1` = immediate)
  - `flushInterval` — flush after N ms even if `batchSize` not reached (lazy one-shot timer, no global `setInterval`)
  - `maxQueueSize` — drop the oldest entry when the queue exceeds this limit
  - `rateLimit` — max entries per second (sliding 1-second window, zero overhead between calls)
  - `maxRetries` + `retryDelay` — retry failed async transport writes up to N times
- **`CoreLogger.flush()`** and **`BrowserLogger.flush()`** — `Promise<void>`, flushes all pending batches immediately; intended for graceful shutdown (`await CoreLogger.flush()` before `process.exit`)
- **`addTransport(transport, config?)`** — second optional parameter accepts `Omit<TransportConfig, 'transport'>` to configure batching/filtering inline
- `TransportSlot` internal class (`lib/shared/TransportSlot.ts`) — manages queue, timer, rate-limit state, and retry per transport; shared by both `CoreLogger` and `BrowserLogger`
- `LogTransport.write()` now accepts `LogEntry | LogEntry[]` to support batch delivery

### Changed
- `LogConfig.transports` type widened from `LogTransport[]` to `(LogTransport | TransportConfig)[]` — fully backward compatible; plain `LogTransport` objects are auto-wrapped with defaults
- `configure({ transports: [...] })` now calls `destroy()` on existing slots before replacing them, preventing timer leaks on reconfiguration

### Breaking Changes (type-level only)
- `LogTransport.write()` signature changed from `write(entry: LogEntry)` to `write(entry: LogEntry | LogEntry[])`. Existing implementations continue to work at runtime (they receive a single `LogEntry` unless `batchSize > 1`). TypeScript callers may need to update type annotations.

## [1.1.0] - 2026-02-27

### Added
- **Transport system** — `LogTransport` interface and `LogEntry` type; plug any storage backend (file, HTTP, Loki, Datadog, …) into `CoreLogger` and `BrowserLogger` via `configure({ transports })` or `addTransport()`
- `child(context)` method on both `CoreLogger` and `BrowserLogger` — creates a logger with fixed context fields (e.g. `requestId`, `userId`) automatically merged into every log entry
- `ChildLogger` interface exported from shared types
- `serializeMeta` utility — converts `Error` instances inside log metadata to plain serializable objects (`message`, `name`, `stack`), supports deep/nested objects
- `examples/` folder with four runnable examples:
  - `01-basic.ts` — log levels, scope, timer
  - `02-json-mode.ts` — JSON output + child logger with request context
  - `03-transports.ts` — MemoryTransport, FileTransport, HttpTransport implementations
  - `04-pretty-logger.ts` — PrettyLogger banner, steps, module lifecycle, serverReady box

### Fixed
- `Error` objects in JSON mode meta no longer serialize as `{}` — now correctly includes `message`, `name`, `stack`
- `CoreLogger.time()` now uses `performance.now()` instead of `Date.now()` for monotonic, accurate timing (consistent with `BrowserLogger`)
- `exports` field in `package.json` — moved `types` condition before `import`/`require` per TypeScript and bundler spec
- Removed dead `universal` entry point (`lib/universal.ts`, `lib/types/universal.ts`) and all related config

### Changed
- `vitest.config.ts`: removed dead `@types` alias (folder no longer exists) and removed `lib/universal.ts` from coverage exclude list
- `package.json`: added `keywords`, `engines` (`node >= 18`), complete `description`; added `@typescript-eslint` packages as explicit devDependencies
- `.npmignore`: updated to reference `lib/` (not `src/`); added `tsup.config.ts`, `vitest.config.ts`, `.nvmrc`
- `pnpm.overrides`: pinned `rollup >= 4.59.0`, `esbuild >= 0.25.0`, `vite >= 6 < 7` to resolve known security advisories

### Security
- Fixed high severity: Rollup < 4.59.0 arbitrary file write via path traversal (GHSA-mw96-cpmx-2vgc)
- Fixed moderate severity: esbuild <= 0.24.2 dev server CORS bypass (GHSA-67mh-4wv8-2f99)

## [1.0.0] - 2026-02-27

### Added
- Initial release
- `CoreLogger` for Node.js with pretty and JSON output modes
- `BrowserLogger` for browser with CSS-styled console output
- `PrettyLogger` utilities: `banner`, `step`, `module`, `serverReady`, `box`, `section`
- Scoped logging via `logger.scope(name)`
- Timer support via `logger.time(label, scope)` / `timer.end(meta?)`
- Log level filtering: `debug`, `info`, `warn`, `error`
- Output modes: `pretty`, `json`, `silent`
- Environment variable support: `LOG_LEVEL`, `LOG_MODE`, `SERVICE_NAME`
- Zero runtime dependencies
