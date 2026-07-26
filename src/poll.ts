// Adaptive poll interval (pure, testable). GitLab has no pipeline-status WebSocket
// (its own UI polls), so we approximate "live" by polling faster while anything is
// running and backing off to the configured interval once everything has finished.

/** Delay until the next poll: the faster of {idle, fast} while running, else idle. */
export function nextPollDelay(anyRunning: boolean, idleMs: number, fastMs: number): number {
	return anyRunning ? Math.min(idleMs, fastMs) : idleMs;
}
