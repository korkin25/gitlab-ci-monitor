// Strip everything a terminal would interpret, so a CI job trace reads cleanly
// in a plain editor. Pure and dependency-free for straightforward unit testing.

export function stripAnsi(s: string): string {
	return s
		.replace(/\x1B\[[0-9;?]*[ -/]*[@-~]/g, '') // CSI: colours, erase-line, cursor moves
		.replace(/\x1B\][\s\S]*?(?:\x07|\x1B\\)/g, '') // OSC sequences
		.replace(/\x1B[@-Z\\-_]/g, '') // other lone escapes
		.replace(/section_(?:start|end):\d+:[^\r\n]*/g, '') // GitLab collapsible-section markers
		.replace(/\r\n?/g, '\n'); // normalise line endings
}
