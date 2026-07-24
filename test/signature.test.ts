import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pipelinesSignature } from '../src/signature';

test('signature is stable for the same pipeline data', () => {
	const a = pipelinesSignature([{ id: 2, status: 'success', ref: 'main' }]);
	const b = pipelinesSignature([{ id: 2, status: 'success', ref: 'main' }]);
	assert.equal(a, b);
});

test('signature changes when a status changes', () => {
	const before = pipelinesSignature([{ id: 2, status: 'running', ref: 'main' }]);
	const after = pipelinesSignature([{ id: 2, status: 'success', ref: 'main' }]);
	assert.notEqual(before, after);
});

test('signature changes when a pipeline is added or removed', () => {
	const one = pipelinesSignature([{ id: 1, status: 'success', ref: 'main' }]);
	const two = pipelinesSignature([
		{ id: 2, status: 'running', ref: 'dev' },
		{ id: 1, status: 'success', ref: 'main' }
	]);
	assert.notEqual(one, two);
});

test('empty list has an empty signature', () => {
	assert.equal(pipelinesSignature([]), '');
});
