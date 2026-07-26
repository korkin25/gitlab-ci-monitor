import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupJobsByStage, resolveNeeds, aggregateStageStatus } from '../src/job-order';

test('aggregateStageStatus surfaces the most important status among a stage', () => {
	assert.equal(aggregateStageStatus([{ status: 'success' }, { status: 'failed' }]), 'failed');
	assert.equal(aggregateStageStatus([{ status: 'success' }, { status: 'running' }]), 'running');
	assert.equal(aggregateStageStatus([{ status: 'success' }, { status: 'success' }]), 'success');
	assert.equal(aggregateStageStatus([]), '');
});

test('groupJobsByStage groups jobs under their stage, in first-seen stage order', () => {
	const jobs = [
		{ id: 10, name: 'compile', stage: 'build', status: 'success' },
		{ id: 11, name: 'lint', stage: 'build', status: 'success' },
		{ id: 21, name: 'unit', stage: 'test', status: 'success' },
		{ id: 5, name: 'deploy', stage: 'deploy', status: 'manual' }
	];
	const groups = groupJobsByStage(jobs);
	assert.deepEqual(
		groups.map((g) => g.stage),
		['build', 'test', 'deploy']
	);
	assert.deepEqual(
		groups[0].jobs.map((j) => j.name),
		['compile', 'lint']
	);
	assert.deepEqual(
		groups[1].jobs.map((j) => j.name),
		['unit']
	);
});

test('groupJobsByStage dedupes to the latest job per name and drops canceled', () => {
	const jobs = [
		{ id: 20, name: 'unit', stage: 'test', status: 'failed' },
		{ id: 21, name: 'unit', stage: 'test', status: 'success' }, // newer wins
		{ id: 30, name: 'deploy', stage: 'deploy', status: 'canceled' } // dropped
	];
	const groups = groupJobsByStage(jobs);
	assert.deepEqual(
		groups.map((g) => g.stage),
		['test']
	);
	assert.equal(groups[0].jobs.length, 1);
	assert.equal(groups[0].jobs[0].id, 21);
});

test('groupJobsByStage orders jobs within a stage by id', () => {
	const jobs = [
		{ id: 12, name: 'b', stage: 'build', status: 'success' },
		{ id: 10, name: 'a', stage: 'build', status: 'success' }
	];
	const groups = groupJobsByStage(jobs);
	assert.deepEqual(
		groups[0].jobs.map((j) => j.id),
		[10, 12]
	);
});

test('resolveNeeds maps a job name to the {name,status} of each job it needs', () => {
	const jobs = [
		{ id: 10, name: 'compile', stage: 'build', status: 'success' },
		{ id: 11, name: 'lint', stage: 'build', status: 'failed' },
		{ id: 21, name: 'unit', stage: 'test', status: 'success' }
	];
	const needsByName = new Map<string, string[]>([['unit', ['compile', 'lint']]]);
	const deps = resolveNeeds(jobs, needsByName);
	assert.deepEqual(deps.get('unit'), [
		{ name: 'compile', status: 'success' },
		{ name: 'lint', status: 'failed' }
	]);
});

test('resolveNeeds reports unknown status for a needed job not in the list', () => {
	const jobs = [{ id: 21, name: 'unit', stage: 'test', status: 'success' }];
	const needsByName = new Map<string, string[]>([['unit', ['ghost']]]);
	const deps = resolveNeeds(jobs, needsByName);
	assert.deepEqual(deps.get('unit'), [{ name: 'ghost', status: 'unknown' }]);
});

test('resolveNeeds returns an empty map when there are no needs', () => {
	const jobs = [{ id: 21, name: 'unit', stage: 'test', status: 'success' }];
	const deps = resolveNeeds(jobs, new Map());
	assert.equal(deps.size, 0);
});
