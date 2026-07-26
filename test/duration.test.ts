import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, jobDurationSeconds, pipelineDurationSeconds } from '../src/duration';

test('formatDuration renders s / m s / h m, and blanks invalid input', () => {
	assert.equal(formatDuration(45), '45s');
	assert.equal(formatDuration(83), '1m 23s');
	assert.equal(formatDuration(3723), '1h 2m');
	assert.equal(formatDuration(0), '0s');
	assert.equal(formatDuration(null as any), '');
	assert.equal(formatDuration(-5), '');
});

const NOW = Date.parse('2026-07-26T10:00:30.000Z');

test('jobDurationSeconds: running job counts elapsed since started_at', () => {
	const job = { status: 'running', started_at: '2026-07-26T10:00:00.000Z', duration: null };
	assert.equal(jobDurationSeconds(job, NOW), 30);
});

test('jobDurationSeconds: finished job uses the API duration', () => {
	const job = {
		status: 'success',
		started_at: '2026-07-26T09:00:00.000Z',
		finished_at: '2026-07-26T09:00:12.000Z',
		duration: 12.4
	};
	assert.equal(jobDurationSeconds(job, NOW), 12.4);
});

test('jobDurationSeconds: finished without duration falls back to finished-started', () => {
	const job = { status: 'failed', started_at: '2026-07-26T09:00:00.000Z', finished_at: '2026-07-26T09:00:15.000Z' };
	assert.equal(jobDurationSeconds(job, NOW), 15);
});

test('jobDurationSeconds: null when never started and no duration', () => {
	assert.equal(jobDurationSeconds({ status: 'created' }, NOW), null);
});

test('pipelineDurationSeconds: running counts from created_at to now', () => {
	const p = { status: 'running', created_at: '2026-07-26T10:00:00.000Z', updated_at: '2026-07-26T10:00:10.000Z' };
	assert.equal(pipelineDurationSeconds(p, NOW), 30);
});

test('pipelineDurationSeconds: finished uses created_at → updated_at', () => {
	const p = { status: 'success', created_at: '2026-07-26T10:00:00.000Z', updated_at: '2026-07-26T10:00:20.000Z' };
	assert.equal(pipelineDurationSeconds(p, NOW), 20);
});

test('pipelineDurationSeconds: null without a created_at', () => {
	assert.equal(pipelineDurationSeconds({ status: 'running' }, NOW), null);
});
