// Reduce a raw job list to the latest job per name, ordered by the stage in
// which each name is first seen, then by job id. Canceled jobs are dropped.
// Pure and dependency-free so it can be unit-tested without the VS Code runtime.

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
