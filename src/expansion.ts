// Pure helpers for repo expansion. Kept free of `vscode` so the mapping and the
// change-detection guard can be unit-tested; tree-view.ts drives the actual
// expansion by rebuilding the nodes and firing a tree refresh (no reveal(), so
// focus never jumps between the Explorer and Source Control panels).

/** Project whose repo folder matches `fsPath` (the active editor's folder), or undefined. */
export function repoProjectForPath<N extends { fsPath?: string; project: string }>(
	repoNodes: N[],
	fsPath: string
): string | undefined {
	const node = repoNodes.find((r) => r.fsPath === fsPath);
	return node ? node.project : undefined;
}

/** Whether applying `want` actually changes the set — used to skip no-op refreshes
 *  and to ignore the echo events a programmatic refresh can produce. */
export function expansionChanges(expanded: Set<string>, project: string, want: boolean): boolean {
	return want !== expanded.has(project);
}
