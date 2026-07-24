import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repoProjectForPath, expansionChanges } from '../src/expansion';

const nodes = [
	{ fsPath: '/w/a', project: 'group/a' },
	{ fsPath: '/w/b', project: 'group/b' }
];

test('repoProjectForPath maps a workspace folder path to its project', () => {
	assert.equal(repoProjectForPath(nodes, '/w/b'), 'group/b');
});

test('repoProjectForPath returns undefined for a path outside any watched repo', () => {
	assert.equal(repoProjectForPath(nodes, '/w/other'), undefined);
});

test('expansionChanges is true only when the desired state differs from the set', () => {
	const set = new Set<string>(['group/a']);
	// already expanded -> expanding again is a no-op
	assert.equal(expansionChanges(set, 'group/a', true), false);
	// expanded -> collapsing changes it
	assert.equal(expansionChanges(set, 'group/a', false), true);
	// not present -> expanding changes it
	assert.equal(expansionChanges(set, 'group/b', true), true);
	// not present -> collapsing is a no-op
	assert.equal(expansionChanges(set, 'group/b', false), false);
});
