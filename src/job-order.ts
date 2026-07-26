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

// Group jobs by stage, ordering the stages by PIPELINE EXECUTION order.
//
// GitLab's `/pipelines/:id/jobs` returns jobs newest-first (descending id), so a
// first-seen ordering would list the LAST stage first. Instead we order stages by the
// smallest job id in each stage: GitLab creates a pipeline's jobs stage by stage, so
// the earliest stage (`.pre`, then the first real stage) holds the lowest ids and the
// last stage (`.post`) the highest — reproducing the order GitLab's own UI shows. The
// min is taken over ALL jobs (not the deduped latest) so a retried job's new high id
// does not drag its stage later. An explicit `stageOrder` (e.g. from GitLab GraphQL)
// takes precedence when given; stages missing from it fall back to the min-id order.
export function groupJobsByStage(jobs: any[], stageOrder?: string[]): StageGroup[] {
	// Earliest (min) job id per stage, over every job — the execution-order anchor.
	const minIdByStage = new Map<string, number>();
	for (const j of jobs) {
		const stage = (j?.stage || '').trim();
		const id = j?.id || 0;
		const prev = minIdByStage.get(stage);
		if (prev === undefined || id < prev) {
			minIdByStage.set(stage, id);
		}
	}
	// Deduped, non-canceled jobs for display, grouped by stage.
	const byStage = new Map<string, any[]>();
	for (const job of orderJobs(jobs)) {
		const stage = (job?.stage || '').trim();
		if (!byStage.has(stage)) {
			byStage.set(stage, []);
		}
		byStage.get(stage)!.push(job);
	}
	const orderIndex = (stage: string): number => {
		const i = stageOrder ? stageOrder.indexOf(stage) : -1;
		return i === -1 ? Number.MAX_SAFE_INTEGER : i; // unknown → after the explicit ones
	};
	return Array.from(byStage.keys())
		.sort((a, b) => {
			const ia = orderIndex(a);
			const ib = orderIndex(b);
			if (ia !== ib) {
				return ia - ib;
			}
			return (minIdByStage.get(a) ?? 0) - (minIdByStage.get(b) ?? 0);
		})
		.map((stage) => ({
			stage,
			jobs: (byStage.get(stage) || []).slice().sort((x, y) => (x?.id || 0) - (y?.id || 0))
		}));
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
