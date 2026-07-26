import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	isJobFinished,
	toTerminalChunk,
	stripSectionMarkers,
	dropPartialFirstLine,
	lastLines,
	parseContentRangeTotal,
	startLogStream,
	TailResult
} from '../src/log-stream';

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

test('toTerminalChunk converts LF to CRLF and preserves ANSI color codes', () => {
	assert.equal(toTerminalChunk('a\nb\n'), 'a\r\nb\r\n');
	assert.equal(toTerminalChunk('x\r\ny'), 'x\r\ny'); // already CRLF, unchanged
	assert.equal(toTerminalChunk('\x1b[31mred\x1b[0m'), '\x1b[31mred\x1b[0m');
});

test('stripSectionMarkers removes GitLab section fold markers', () => {
	const raw = 'section_start:1600000000:build\rBuilding...\nsection_end:1600000005:build\rDone\n';
	assert.equal(stripSectionMarkers(raw), 'Building...\nDone\n');
});

test('dropPartialFirstLine drops everything up to and including the first newline', () => {
	assert.equal(dropPartialFirstLine('rtial line\nfull1\nfull2\n'), 'full1\nfull2\n');
	assert.equal(dropPartialFirstLine('no newline here'), 'no newline here');
});

test('lastLines keeps only the last n lines', () => {
	assert.equal(lastLines('a\nb\nc\nd', 2), 'c\nd');
	assert.equal(lastLines('a\nb', 5), 'a\nb'); // fewer than n → unchanged
	assert.equal(lastLines('a\nb\nc', 0), '');
});

test('parseContentRangeTotal extracts the total size, or null when unknown', () => {
	assert.equal(parseContentRangeTotal('bytes 100-199/5000'), 5000);
	assert.equal(parseContentRangeTotal('bytes 0-0/1'), 1);
	assert.equal(parseContentRangeTotal('bytes */*'), null);
	assert.equal(parseContentRangeTotal(''), null);
});

test('startLogStream shows the initial tail (reset) once for a finished job, then stops', async () => {
	const chunks: { c: string; reset: boolean }[] = [];
	let done: string | null = null;
	let scheduled = 0;
	const fromBytes: (number | null)[] = [];
	startLogStream({
		fetchStatus: async () => 'success',
		fetchTail: async (from) => {
			fromBytes.push(from);
			return { chunk: 'tail line 1\ntail line 2\n', end: 2048, reset: true };
		},
		onChunk: (c, reset) => chunks.push({ c, reset }),
		onDone: (s) => (done = s),
		setTimer: () => {
			scheduled++;
			return 0;
		},
		clearTimer: () => {}
	});
	await drain();
	assert.deepEqual(fromBytes, [null]); // initial fetch asks for the tail
	assert.deepEqual(chunks, [{ c: 'tail line 1\ntail line 2\n', reset: true }]);
	assert.equal(done, 'success');
	assert.equal(scheduled, 0); // terminal on the first poll → never re-scheduled
});

test('startLogStream appends only new bytes from the last offset while running', async () => {
	const chunks: { c: string; reset: boolean }[] = [];
	let done: string | null = null;
	const timers: (() => void)[] = [];
	const fromBytes: (number | null)[] = [];
	let step = 0;
	const statuses = ['running', 'success'];
	const results: TailResult[] = [
		{ chunk: 'part1\n', end: 100, reset: true }, // initial tail
		{ chunk: 'part2\n', end: 106, reset: false } // appended bytes from offset 100
	];
	startLogStream({
		fetchStatus: async () => statuses[step],
		fetchTail: async (from) => {
			fromBytes.push(from);
			return results[step];
		},
		onChunk: (c, reset) => chunks.push({ c, reset }),
		onDone: (s) => (done = s),
		setTimer: (fn) => timers.push(fn),
		clearTimer: () => {}
	});
	await drain(); // first poll: running, initial tail
	assert.deepEqual(chunks, [{ c: 'part1\n', reset: true }]);
	assert.equal(done, null);
	assert.equal(timers.length, 1);

	step = 1;
	timers.pop()!(); // fire the scheduled next poll
	await drain(); // second poll: fetchTail(100) → only "part2\n"
	assert.deepEqual(fromBytes, [null, 100]); // second fetch resumes from the offset
	assert.deepEqual(chunks[1], { c: 'part2\n', reset: false });
	assert.equal(done, 'success');
});

test('stop() halts polling — a stale timer firing is a no-op', async () => {
	const timers: (() => void)[] = [];
	let finished = false;
	const stream = startLogStream({
		fetchStatus: async () => 'running',
		fetchTail: async () => ({ chunk: 'x\n', end: 2, reset: true }),
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
