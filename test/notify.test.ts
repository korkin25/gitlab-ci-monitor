import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestFailedByRef } from '../src/notify';

test('returns the refs whose newest pipeline is failed, with that pipeline id', () => {
	const pipelines = [
		{ id: 10, ref: 'main', status: 'failed' },
		{ id: 12, ref: 'main', status: 'success' }, // newer success on main → not reported
		{ id: 20, ref: 'dev', status: 'success' },
		{ id: 22, ref: 'dev', status: 'failed' }, // newer failure on dev → reported (22)
		{ id: 5, ref: 'feature', status: 'failed' } // only one, failed → reported (5)
	];
	assert.deepEqual(latestFailedByRef(pipelines), [
		{ ref: 'dev', id: 22 },
		{ ref: 'feature', id: 5 }
	]);
});

test('ignores a ref whose latest pipeline is not failed', () => {
	const pipelines = [
		{ id: 1, ref: 'main', status: 'failed' },
		{ id: 2, ref: 'main', status: 'running' }
	];
	assert.deepEqual(latestFailedByRef(pipelines), []);
});

test('reports a single failed pipeline on a ref', () => {
	assert.deepEqual(latestFailedByRef([{ id: 7, ref: 'main', status: 'failed' }]), [{ ref: 'main', id: 7 }]);
});

test('ignores pipelines without a ref and handles an empty list', () => {
	assert.deepEqual(latestFailedByRef([]), []);
	assert.deepEqual(latestFailedByRef([{ id: 1, ref: '', status: 'failed' }]), []);
});
