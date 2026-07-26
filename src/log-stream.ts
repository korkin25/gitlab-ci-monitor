// Live job-log streaming core, free of `vscode` so it can be unit-tested.
//
// GitLab exposes NO WebSocket for a CI job trace, so "streaming" is incremental
// polling. And the "live" view is a TAIL — a devops wants to see what is happening
// NOW, not the whole (possibly huge) log (that is what GitLab's web UI is for). So we
// fetch only the last chunk of the trace via an HTTP suffix Range, then append only the
// newly-written bytes on each poll (tracked by byte offset). Stops on a terminal state.

export const TERMINAL_STATUSES = new Set(['success', 'failed', 'canceled', 'skipped', 'manual']);

/** A job status that will not change again — polling can stop. */
export function isJobFinished(status: string): boolean {
	return TERMINAL_STATUSES.has((status || '').trim());
}

/**
 * Convert a raw trace chunk (LF newlines) to a terminal-writable chunk (CRLF). ANSI
 * escape codes pass through untouched so the terminal renders GitLab's log colors.
 */
export function toTerminalChunk(s: string): string {
	return s.replace(/\r?\n/g, '\r\n');
}

/** Drop GitLab's `section_start:`/`section_end:` fold markers, noise in a plain terminal. */
export function stripSectionMarkers(s: string): string {
	return s.replace(/section_(?:start|end):\d+:[^\r\n]*\r?/g, '');
}

/** A suffix-range fetch usually starts mid-line — drop that first partial line. */
export function dropPartialFirstLine(s: string): string {
	const i = s.indexOf('\n');
	return i >= 0 ? s.slice(i + 1) : s;
}

/** Keep only the last `n` lines of `s` (the tail we actually show). */
export function lastLines(s: string, n: number): string {
	if (n <= 0) {
		return '';
	}
	const lines = s.split('\n');
	return lines.length <= n ? s : lines.slice(lines.length - n).join('\n');
}

/** Total size from a `Content-Range: bytes a-b/TOTAL` header, or null if unknown (`*`). */
export function parseContentRangeTotal(header: string): number | null {
	const m = /\/(\d+)\s*$/.exec(header || '');
	return m ? Number(m[1]) : null;
}

/** Result of a tail fetch: the new text, the byte offset consumed so far, and whether
 *  the trace was rewritten (so the consumer should clear before writing). */
export interface TailResult {
	chunk: string;
	end: number;
	reset: boolean;
}

export interface LogStreamDeps {
	/** Fetch the current job status (to know when to stop). */
	fetchStatus: () => Promise<string>;
	/** Fetch the tail: `null` → the last chunk (initial), else bytes from `fromByte`. */
	fetchTail: (fromByte: number | null) => Promise<TailResult>;
	/** Called with each new chunk. `reset` = clear before writing (initial / rewritten). */
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
 * Start tailing a job's trace, appending new output until it finishes. Returns a handle
 * whose `stop()` cancels any pending poll (call it when the view is closed).
 */
export function startLogStream(deps: LogStreamDeps): LogStream {
	const intervalMs = deps.intervalMs ?? 1500;
	const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
	const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as NodeJS.Timeout));
	let pos: number | null = null; // bytes consumed so far; null until the first tail fetch
	let stopped = false;
	let timer: unknown = null;

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
		try {
			const res = await deps.fetchTail(pos);
			pos = res.end;
			if (res.reset) {
				deps.onChunk(res.chunk, true);
			} else if (res.chunk) {
				deps.onChunk(res.chunk, false);
			}
		} catch (e) {
			/* a failed fetch just yields no new output this poll */
		}
		if (stopped) {
			return;
		}
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
