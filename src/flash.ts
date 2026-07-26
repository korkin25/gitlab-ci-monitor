// Pure logic for the brief "status just changed" flash — free of `vscode` so it can
// be unit-tested. A node flashes a brighter icon for a fraction of a second the moment
// it transitions INTO a finished state (success/failed/canceled/skipped), then reverts.

export const FLASH_TERMINAL = new Set(['success', 'failed', 'canceled', 'skipped']);

/** True when `next` is a fresh transition into a finished state (so it should flash). */
export function shouldFlash(prev: string | undefined, next: string): boolean {
	return !!prev && prev !== next && FLASH_TERMINAL.has(next);
}
