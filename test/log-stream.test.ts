import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isJobFinished, computeDelta, toTerminalChunk, stripSectionMarkers, startLogStream } from '../src/log-stream';

// Let all queued microtasks (the async tick's awaits) settle before asserting.
const drain = () => new Promise((r) => setImmediate(r));

test('isJobFinished is true only for terminal statuses', () => {
	for (const s of ['success', 'failed', 'canceled', 'skipped', 'manual']) {
		assert.equal(isJobFinished(s), true, s);
	}
	for (const s of ['running', 'pending', 'created', '', 'unknown']) {
		assert.equal(isJobFinished(s), false, s);
	}
});

test('computeDelta emits the appended suffix as the trace grows', () => {
	assert.deepEqual(computeDelta('', 'line1\n'), { delta: 'line1\n', reset: false });
	assert.deepEqual(computeDelta('line1\n', 'line1\nline2\n'), { delta: 'line2\n', reset: false });
	assert.deepEqual(computeDelta('same', 'same'), { delta: '', reset: false });
});

test('computeDelta signals a reset when the trace was rewritten (not an append)', () => {
	assert.deepEqual(computeDelta('old content', 'brand new'), { delta: 'brand new', reset: true });
});

test('toTerminalChunk converts LF to CRLF and preserves ANSI color codes', () => {
	assert.equal(toTerminalChunk('a\nb\n'), 'a\r\nb\r\n');
	assert.equal(toTerminalChunk('x\r\ny'), 'x\r\ny'); // already CRLF, unchanged
	assert.equal(toTerminalChunk('\x1b[31mred\x1b[0m'), '\x1b[31mred\x1b[0m');
});

test('stripSectionMarkers removes GitLab section fold markers', () => {
	const raw = 'section_start:1600000000:build\rBuilding...\nsection_end:1600000005:build\rDone\n';
	assert.equal(stripSectionMarkers(raw), 'Building...\nDone\n');
});

test('startLogStream streams a finished job in a single poll, then stops', async () => {
	const chunks: { c: string; reset: boolean }[] = [];
	let done: string | null = null;
	let scheduled = 0;
	startLogStream({
		fetchStatus: async () => 'success',
		fetchTrace: async () => 'line1\nline2\n',
		onChunk: (c, reset) => chunks.push({ c, reset }),
		onDone: (s) => (done = s),
		setTimer: () => {
			scheduled++;
			return 0;
		},
		clearTimer: () => {}
	});
	await drain();
	assert.deepEqual(chunks, [{ c: 'line1\nline2\n', reset: false }]);
	assert.equal(done, 'success');
	assert.equal(scheduled, 0); // terminal on the first poll → never re-scheduled
});

test('startLogStream polls until the job finishes, emitting only the new tail', async () => {
	const chunks: { c: string; reset: boolean }[] = [];
	let done: string | null = null;
	const timers: (() => void)[] = [];
	let step = 0;
	const statuses = ['running', 'success'];
	const traces = ['part1\n', 'part1\npart2\n'];
	startLogStream({
		fetchStatus: async () => statuses[step],
		fetchTrace: async () => traces[step],
		onChunk: (c, reset) => chunks.push({ c, reset }),
		onDone: (s) => (done = s),
		setTimer: (fn) => timers.push(fn),
		clearTimer: () => {}
	});
	await drain(); // first poll: running, part1
	assert.deepEqual(chunks, [{ c: 'part1\n', reset: false }]);
	assert.equal(done, null);
	assert.equal(timers.length, 1);

	step = 1;
	timers.pop()!(); // fire the scheduled next poll
	await drain(); // second poll: success, part1+part2 → only "part2\n"
	assert.deepEqual(chunks[1], { c: 'part2\n', reset: false });
	assert.equal(done, 'success');
});

test('stop() halts polling — a stale timer firing is a no-op', async () => {
	const timers: (() => void)[] = [];
	let finished = false;
	const stream = startLogStream({
		fetchStatus: async () => 'running',
		fetchTrace: async () => 'x\n',
		onChunk: () => {},
		onDone: () => (finished = true),
		setTimer: (fn) => timers.push(fn),
		clearTimer: () => {}
	});
	await drain();
	stream.stop();
	timers.forEach((fn) => fn()); // simulate a late timer callback
	await drain();
	assert.equal(finished, false); // never reached onDone
});
