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
 * How long a pipeline has run, in seconds. The `/pipelines` list has no `duration`,
 * so we use its timestamps: a running pipeline counts created_at→now (total wall
 * time, incl. queue); a finished one counts created_at→updated_at. `null` without a
 * created_at.
 */
export function pipelineDurationSeconds(pipeline: any, nowMs: number): number | null {
	const created = parse(pipeline?.created_at);
	if (isNaN(created)) {
		return null;
	}
	const status = pipeline?.status;
	const running = status === 'running' || status === 'pending' || status === 'created';
	const end = running ? nowMs : parse(pipeline?.updated_at);
	const endMs = isNaN(end) ? nowMs : end;
	return Math.max(0, (endMs - created) / 1000);
}
