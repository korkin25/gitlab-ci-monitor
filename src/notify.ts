// Pure notification logic, free of `vscode` so it can be unit-tested.

export interface PipelineLite {
	id: number;
	ref: string;
	status: string;
}

/**
 * For each ref, keep only its newest pipeline (highest id) and return those whose
 * newest pipeline is `failed`, as `{ ref, id }`. A ref where a more recent
 * pipeline succeeded (or is running) is not reported — we only care about a
 * failure that is the latest state of the branch. Pipelines without a ref are
 * ignored. Result order follows first-seen ref order.
 */
export function latestFailedByRef(pipelines: PipelineLite[]): { ref: string; id: number }[] {
	const latest = new Map<string, PipelineLite>();
	for (const p of pipelines) {
		const ref = (p && p.ref) || '';
		if (!ref) {
			continue;
		}
		const prev = latest.get(ref);
		if (!prev || (p.id || 0) > (prev.id || 0)) {
			latest.set(ref, p);
		}
	}
	const out: { ref: string; id: number }[] = [];
	for (const [ref, p] of latest) {
		if (p.status === 'failed') {
			out.push({ ref, id: p.id });
		}
	}
	return out;
}
