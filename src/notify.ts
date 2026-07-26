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

/**
 * From the branch's latest failures, keep only the ones we have NOT already notified
 * about — comparing against `notified` (a `project|ref` → last-notified-id map). With
 * an empty `notified` (extension startup) every current latest-failure is returned, so
 * a red branch is announced at startup; on later polls only a *new* failure id for a
 * ref survives, so each failure notifies exactly once. Superseded/older failures never
 * appear here because `latestFailedByRef` already dropped them upstream.
 */
export function pendingFailureNotifications(
	latestFailed: { ref: string; id: number }[],
	project: string,
	notified: Map<string, number>
): { ref: string; id: number; key: string }[] {
	const out: { ref: string; id: number; key: string }[] = [];
	for (const { ref, id } of latestFailed) {
		const key = `${project}|${ref}`;
		if (notified.get(key) === id) {
			continue; // already announced this exact failure
		}
		out.push({ ref, id, key });
	}
	return out;
}

/** The user-facing text for a failed-pipeline notification. */
export function formatFailureMessage(project: string, ref: string, id: number): string {
	const short = (project || '').split('/').filter(Boolean).slice(-1)[0] || project;
	return `❌ Pipeline #${id} failed — ${short} (${ref})`;
}
