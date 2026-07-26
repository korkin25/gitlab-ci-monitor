import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextPollDelay } from '../src/poll';

test('nextPollDelay polls fast while something runs, idle otherwise', () => {
	// running → the faster of {idle, fast}
	assert.equal(nextPollDelay(true, 5000, 2000), 2000);
	assert.equal(nextPollDelay(false, 5000, 2000), 5000);
});

test('nextPollDelay never polls slower than the configured interval when running', () => {
	// a user who already configured a fast interval keeps it while running
	assert.equal(nextPollDelay(true, 1000, 2000), 1000);
});
