// Pure duration helpers (no `vscode`), so they can be unit-tested. `nowMs` is passed
// in rather than read from the clock, both for testability and so the caller controls
// the render-time "now".

/** Human-friendly duration: `45s`, `1m 23s`, `1h 2m`. Empty for invalid input. */
export function formatDuration(totalSeconds: number): string {
	if (totalSeconds == null || !isFinite(totalSeconds) || totalSeconds < 0) {
		return '';
	}
	const s = Math.floor(totalSeconds);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	if (h) {
		return `${h}h ${m}m`;
	}
	if (m) {
		return `${m}m ${sec}s`;
	}
	return `${sec}s`;
}

const parse = (iso: any): number => (iso ? Date.parse(iso) : NaN);

/**
 * How long a job has run, in seconds. A running job counts elapsed time since it
 * started (live); a finished job uses the API `duration`, falling back to
 * finished−started. `null` when it never started and has no duration.
 */
export function jobDurationSeconds(job: any, nowMs: number): number | null {
	const started = parse(job?.started_at);
	if (job?.status === 'running' && !isNaN(started)) {
		return Math.max(0, (nowMs - started) / 1000);
	}
	if (typeof job?.duration === 'number') {
		return job.duration;
	}
	const finished = parse(job?.finished_at);
	if (!isNaN(started) && !isNaN(finished)) {
		return Math.max(0, (finished - started) / 1000);
	}
	return null;
}

/**
 * How long a pipeline has RUN, in seconds — the actual execution time, not wall time.
 * Uses `started_at`/`finished_at`/`duration` (from the single-pipeline endpoint), the
 * same way `jobDurationSeconds` does. It deliberately does NOT use created_at→updated_at:
 * that spans queue time and any later record update (a manual/delayed job, a retry, a
 * downstream bridge), which can read as hours for a pipeline that ran for minutes.
 * A running pipeline counts started_at→now; `null` until it has started / has data.
 */
export function pipelineDurationSeconds(pipeline: any, nowMs: number): number | null {
	const status = pipeline?.status;
	const running = status === 'running' || status === 'pending' || status === 'created';
	const started = parse(pipeline?.started_at);
	if (running) {
		return isNaN(started) ? null : Math.max(0, (nowMs - started) / 1000);
	}
	if (typeof pipeline?.duration === 'number') {
		return pipeline.duration;
	}
	const finished = parse(pipeline?.finished_at);
	if (!isNaN(started) && !isNaN(finished)) {
		return Math.max(0, (finished - started) / 1000);
	}
	return null;
}
