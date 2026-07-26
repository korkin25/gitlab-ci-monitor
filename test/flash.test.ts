import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldFlash } from '../src/flash';

test('shouldFlash: fires when a node transitions INTO a finished state', () => {
	assert.equal(shouldFlash('running', 'success'), true);
	assert.equal(shouldFlash('running', 'failed'), true);
	assert.equal(shouldFlash('pending', 'canceled'), true);
	assert.equal(shouldFlash('created', 'skipped'), true);
});

test('shouldFlash: does not fire without a real transition', () => {
	assert.equal(shouldFlash('success', 'success'), false); // unchanged
	assert.equal(shouldFlash(undefined, 'failed'), false); // first sight — no flash
});

test('shouldFlash: does not fire on a transition to a non-finished state', () => {
	assert.equal(shouldFlash('pending', 'running'), false);
	assert.equal(shouldFlash('created', 'pending'), false);
});
