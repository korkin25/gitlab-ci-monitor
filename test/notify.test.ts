import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestFailedByRef, pendingFailureNotifications, formatFailureMessage } from '../src/notify';

test('pendingFailureNotifications reports every latest failure at startup (empty state)', () => {
	const latest = [
		{ ref: 'main', id: 10 },
		{ ref: 'dev', id: 22 }
	];
	const notified = new Map<string, number>();
	const pending = pendingFailureNotifications(latest, 'group/repo', notified);
	assert.deepEqual(pending, [
		{ ref: 'main', id: 10, key: 'group/repo|main' },
		{ ref: 'dev', id: 22, key: 'group/repo|dev' }
	]);
});

test('pendingFailureNotifications suppresses a failure already notified (once per project|ref)', () => {
	const notified = new Map<string, number>([['group/repo|main', 10]]);
	const pending = pendingFailureNotifications([{ ref: 'main', id: 10 }], 'group/repo', notified);
	assert.deepEqual(pending, []);
});

test('pendingFailureNotifications reports a NEW failure id on an already-seen ref', () => {
	const notified = new Map<string, number>([['group/repo|main', 10]]);
	const pending = pendingFailureNotifications([{ ref: 'main', id: 11 }], 'group/repo', notified);
	assert.deepEqual(pending, [{ ref: 'main', id: 11, key: 'group/repo|main' }]);
});

test('formatFailureMessage shows the short repo name, ref and pipeline id', () => {
	assert.equal(formatFailureMessage('group/sub/repo', 'main', 42), '❌ Pipeline #42 failed — repo (main)');
	assert.equal(formatFailureMessage('repo', 'dev', 7), '❌ Pipeline #7 failed — repo (dev)');
});

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
