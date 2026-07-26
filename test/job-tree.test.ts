import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupJobsByStage, resolveNeeds, aggregateStageStatus } from '../src/job-order';

test('aggregateStageStatus surfaces the most important status among a stage', () => {
	assert.equal(aggregateStageStatus([{ status: 'success' }, { status: 'failed' }]), 'failed');
	assert.equal(aggregateStageStatus([{ status: 'success' }, { status: 'running' }]), 'running');
	assert.equal(aggregateStageStatus([{ status: 'success' }, { status: 'success' }]), 'success');
	assert.equal(aggregateStageStatus([]), '');
});

test('groupJobsByStage orders stages by execution order (min job id), grouping jobs', () => {
	const jobs = [
		{ id: 10, name: 'compile', stage: 'build', status: 'success' },
		{ id: 11, name: 'lint', stage: 'build', status: 'success' },
		{ id: 21, name: 'unit', stage: 'test', status: 'success' },
		{ id: 30, name: 'deploy', stage: 'deploy', status: 'manual' }
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

test('groupJobsByStage orders stages by execution order even when the API lists jobs newest-first', () => {
	// GitLab's /pipelines/:id/jobs returns jobs in DESCENDING id order, so the LAST
	// stage appears first in the response. Stage order must still follow execution
	// (min job id per stage), not first-seen. (GCM-24 — real gitlab.com pipeline.)
	const jobs = [
		{ id: 500, name: 'commit_changes', stage: 'commit_job_changes', status: 'success' },
		{ id: 400, name: 'default_helm_package', stage: 'package', status: 'success' },
		{ id: 300, name: 'default_sign', stage: 'sign', status: 'success' },
		{ id: 200, name: 'default_build', stage: 'build', status: 'success' },
		{ id: 150, name: 'SAST-checkov', stage: 'sast', status: 'success' },
		{ id: 140, name: 'SAST-trivy-fs', stage: 'sast', status: 'success' },
		{ id: 100, name: 'get_unique_semversion', stage: '.pre', status: 'success' }
	];
	const groups = groupJobsByStage(jobs);
	assert.deepEqual(
		groups.map((g) => g.stage),
		['.pre', 'sast', 'build', 'sign', 'package', 'commit_job_changes']
	);
});

test('groupJobsByStage anchors stage order on the earliest (min) id, robust to a retried job', () => {
	// A retried early-stage job gets a NEW high id; the stage's ORIGINAL low id must
	// still anchor its position (min over all jobs, not the deduped latest).
	const jobs = [
		{ id: 100, name: 'build', stage: 'build', status: 'failed' }, // original
		{ id: 500, name: 'build', stage: 'build', status: 'success' }, // retry (latest)
		{ id: 200, name: 'test', stage: 'test', status: 'success' }
	];
	const groups = groupJobsByStage(jobs);
	assert.deepEqual(
		groups.map((g) => g.stage),
		['build', 'test']
	);
	assert.equal(groups[0].jobs[0].id, 500); // shows the retried (latest) build
});

test('groupJobsByStage honors an explicit stage order when provided', () => {
	const jobs = [
		{ id: 300, name: 'a', stage: 'build', status: 'success' },
		{ id: 100, name: 'b', stage: 'test', status: 'success' } // lower id, but runs later
	];
	// Explicit order (e.g. from GitLab GraphQL) overrides the min-id heuristic.
	const groups = groupJobsByStage(jobs, ['build', 'test']);
	assert.deepEqual(
		groups.map((g) => g.stage),
		['build', 'test']
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
