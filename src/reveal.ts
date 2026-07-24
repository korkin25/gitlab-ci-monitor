// Pure helper for cross-view repo reveal. Keeping the decision (which node, in
// which views) out of the VS Code layer makes it unit-testable; tree-view.ts is
// then a thin adapter over TreeView.reveal().

export function planRepoReveal<N extends { project: string }, V>(
	repoNodes: N[],
	project: string,
	views: V[],
	exclude?: V
): { target: N | undefined; targetViews: V[] } {
	const target = repoNodes.find((n) => n.project === project);
	const targetViews = views.filter((v) => v !== exclude);
	return { target, targetViews };
}
