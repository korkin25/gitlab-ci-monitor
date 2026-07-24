import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderJobs } from '../src/job-order';

test('keeps only the latest job per name (highest id wins)', () => {
	const jobs = [
		{ id: 20, name: 'unit', stage: 'test', status: 'failed' },
		{ id: 21, name: 'unit', stage: 'test', status: 'success' }
	];
	const out = orderJobs(jobs);
	assert.equal(out.length, 1);
	assert.equal(out[0].id, 21);
});

test('skips canceled jobs entirely', () => {
	const jobs = [
		{ id: 30, name: 'deploy', stage: 'deploy', status: 'canceled' },
		{ id: 31, name: 'build', stage: 'build', status: 'success' }
	];
	const out = orderJobs(jobs);
	assert.deepEqual(
		out.map((j) => j.name),
		['build']
	);
});

test('orders by first-seen stage, then by job id — stage order beats id', () => {
	const jobs = [
		{ id: 10, name: 'compile', stage: 'build', status: 'success' },
		{ id: 11, name: 'lint', stage: 'build', status: 'success' },
		{ id: 21, name: 'unit', stage: 'test', status: 'success' },
		{ id: 5, name: 'deploy', stage: 'deploy', status: 'manual' }
	];
	const out = orderJobs(jobs);
	assert.deepEqual(
		out.map((j) => j.name),
		['compile', 'lint', 'unit', 'deploy']
	);
});
