import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRepoReveal } from '../src/reveal';

const nodes = [{ project: 'group/a' }, { project: 'group/b' }, { project: 'group/c' }];

test('finds the repo node by project', () => {
	const { target } = planRepoReveal(nodes, 'group/b', ['viewA', 'viewB']);
	assert.equal(target, nodes[1]);
});

test('returns undefined target for an unknown project', () => {
	const { target } = planRepoReveal(nodes, 'group/zzz', ['viewA', 'viewB']);
	assert.equal(target, undefined);
});

test('reveals in every view when no view is excluded', () => {
	const views = ['viewA', 'viewB'];
	const { targetViews } = planRepoReveal(nodes, 'group/a', views);
	assert.deepEqual(targetViews, ['viewA', 'viewB']);
});

test('excludes the originating view from the reveal targets', () => {
	const views = ['viewA', 'viewB'];
	const { targetViews } = planRepoReveal(nodes, 'group/a', views, 'viewA');
	assert.deepEqual(targetViews, ['viewB']);
});
