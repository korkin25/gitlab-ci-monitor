// Live job-log streaming core, free of `vscode` so it can be unit-tested.
//
// GitLab exposes NO WebSocket for a CI job trace (its own web UI incrementally
// polls the trace endpoint), so "streaming" here is incremental polling: each poll
// fetches the full trace, we emit only the newly-appended tail, and we stop once the
// job reaches a terminal state. This is the streaming equivalent of a WebSocket tail
// over the API GitLab actually provides (decision GCM-D1).

export const TERMINAL_STATUSES = new Set(['success', 'failed', 'canceled', 'skipped', 'manual']);

/** A job status that will not change again — polling can stop. */
export function isJobFinished(status: string): boolean {
	return TERMINAL_STATUSES.has((status || '').trim());
}

/**
 * Given the previously-seen raw trace and the freshly-fetched one, decide what to
 * emit. Normal case: the trace grew, so emit the appended suffix. If the new trace
 * is not an extension of the old (GitLab rotated/rewrote it), signal `reset` so the
 * consumer can clear and re-render from scratch.
 */
export function computeDelta(prev: string, next: string): { delta: string; reset: boolean } {
	if (next === prev) {
		return { delta: '', reset: false };
	}
	if (next.startsWith(prev)) {
		return { delta: next.slice(prev.length), reset: false };
	}
	return { delta: next, reset: true };
}

/**
 * Convert a raw trace chunk (LF newlines) to a terminal-writable chunk (CRLF). ANSI
 * escape codes pass through untouched so the terminal renders GitLab's log colors.
 */
export function toTerminalChunk(s: string): string {
	return s.replace(/\r?\n/g, '\r\n');
}

/** Drop GitLab's `section_start:`/`section_end:` fold markers, which are noise in a
 *  plain terminal (the web UI uses them to collapse log sections). */
export function stripSectionMarkers(s: string): string {
	return s.replace(/section_(?:start|end):\d+:[^\r\n]*\r?/g, '');
}

export interface LogStreamDeps {
	/** Fetch the current job status (to know when to stop). */
	fetchStatus: () => Promise<string>;
	/** Fetch the full raw job trace. */
	fetchTrace: () => Promise<string>;
	/** Called with each new chunk. `reset` = clear before writing (trace was rewritten). */
	onChunk: (chunk: string, reset: boolean) => void;
	/** Called once when the job reaches a terminal state, with that status. */
	onDone: (status: string) => void;
	/** Fallback status if `fetchStatus` fails (e.g. the status carried by the tree node). */
	initialStatus?: string;
	/** Poll interval in ms (default 1500). */
	intervalMs?: number;
	/** Injectable timer, for tests. */
	setTimer?: (fn: () => void, ms: number) => unknown;
	clearTimer?: (handle: unknown) => void;
}

export interface LogStream {
	stop: () => void;
}

/**
 * Start polling a job's trace, emitting appended chunks until it finishes. Returns a
 * handle whose `stop()` cancels any pending poll (call it when the view is closed).
 */
export function startLogStream(deps: LogStreamDeps): LogStream {
	const intervalMs = deps.intervalMs ?? 1500;
	const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
	const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as NodeJS.Timeout));
	let prev = '';
	let stopped = false;
	let timer: unknown = null;

	const emit = (raw: string): void => {
		const { delta, reset } = computeDelta(prev, raw);
		prev = raw;
		if (reset) {
			deps.onChunk(raw, true);
		} else if (delta) {
			deps.onChunk(delta, false);
		}
	};

	const tick = async (): Promise<void> => {
		if (stopped) {
			return;
		}
		let status = deps.initialStatus || '';
		try {
			status = await deps.fetchStatus();
		} catch (e) {
			/* keep the last known / initial status */
		}
		let raw: string;
		try {
			raw = await deps.fetchTrace();
		} catch (e) {
			raw = prev; // a failed fetch just yields no new chunk this poll
		}
		if (stopped) {
			return;
		}
		emit(raw);
		if (isJobFinished(status)) {
			stopped = true;
			deps.onDone(status);
			return;
		}
		timer = setTimer(tick, intervalMs);
	};

	tick();

	return {
		stop: () => {
			stopped = true;
			if (timer != null) {
				clearTimer(timer);
			}
		}
	};
}
