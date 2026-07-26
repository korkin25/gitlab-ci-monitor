// Pure, dependency-free job-tree helpers, so they can be unit-tested without the
// VS Code runtime. Two shapes drive the tree:
//   * stages  — jobs grouped by the stage they run in (the classic pipeline order);
//   * needs   — the DAG edges between jobs (what each job depends on).

export interface JobDep {
	name: string;
	status: string;
}

export interface StageGroup {
	stage: string;
	jobs: any[];
}

// Reduce a raw job list to the latest job per name, ordered by the stage in
// which each name is first seen, then by job id. Canceled jobs are dropped.
export function orderJobs(jobs: any[]): any[] {
	const byName = new Map<string, any>();
	const stageOrder: string[] = [];
	for (const j of jobs) {
		const stage = (j?.stage || '').trim();
		if (stage && !stageOrder.includes(stage)) {
			stageOrder.push(stage);
		}
		if (j?.status === 'canceled') {
			continue;
		}
		const key = (j?.name || '').trim() || String(j?.id || '');
		const prev = byName.get(key);
		if (!prev || (j?.id || 0) > (prev?.id || 0)) {
			byName.set(key, j);
		}
	}
	return Array.from(byName.values()).sort((a, b) => {
		const sa = stageOrder.indexOf((a?.stage || '').trim());
		const sb = stageOrder.indexOf((b?.stage || '').trim());
		if (sa !== sb) {
			return sa - sb;
		}
		return (a?.id || 0) - (b?.id || 0);
	});
}

// Group the ordered jobs by stage. `orderJobs` already sorts by stage-first-seen
// then id, so every stage's jobs are contiguous — we just cut the runs. The result
// preserves first-seen stage order, and jobs within a stage stay id-ordered.
export function groupJobsByStage(jobs: any[]): StageGroup[] {
	const groups: StageGroup[] = [];
	let current: StageGroup | null = null;
	for (const job of orderJobs(jobs)) {
		const stage = (job?.stage || '').trim();
		if (!current || current.stage !== stage) {
			current = { stage, jobs: [] };
			groups.push(current);
		}
		current.jobs.push(job);
	}
	return groups;
}

// Highest-priority (most "interesting") status first — used to summarise a stage
// from its jobs, so the stage node shows the state that most deserves attention.
const STAGE_STATUS_PRIORITY = [
	'failed',
	'running',
	'pending',
	'created',
	'manual',
	'scheduled',
	'waiting_for_resource',
	'skipped',
	'success',
	'canceled'
];

// The single status that best represents a stage: any failure wins, then anything
// in-flight, down to success. Unknown statuses rank last. '' for an empty stage.
export function aggregateStageStatus(jobs: any[]): string {
	let best = '';
	let bestRank = Infinity;
	for (const j of jobs) {
		const s = (j?.status || '').trim();
		const idx = STAGE_STATUS_PRIORITY.indexOf(s);
		const rank = idx === -1 ? STAGE_STATUS_PRIORITY.length : idx;
		if (rank < bestRank) {
			bestRank = rank;
			best = s;
		}
	}
	return best;
}

// Resolve each job's `needs` (a job-name → needed-names map, e.g. from GraphQL)
// into `{ name, status }` entries, taking the status from the latest job of that
// name in `jobs`. A needed job absent from the list is reported as `unknown`.
// Keyed by job name; a job without needs is omitted.
export function resolveNeeds(jobs: any[], needsByName: Map<string, string[]>): Map<string, JobDep[]> {
	const statusByName = new Map<string, string>();
	for (const j of orderJobs(jobs)) {
		const name = (j?.name || '').trim();
		if (name) {
			statusByName.set(name, j?.status || 'unknown');
		}
	}
	const out = new Map<string, JobDep[]>();
	for (const [name, needed] of needsByName) {
		if (!needed || !needed.length) {
			continue;
		}
		out.set(
			name,
			needed.map((dep) => ({ name: dep, status: statusByName.get(dep) || 'unknown' }))
		);
	}
	return out;
}
