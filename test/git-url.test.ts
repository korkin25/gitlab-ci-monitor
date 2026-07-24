import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gitUrlParser } from '../src/git-url';

test('parses scp-like SSH remotes (git@host:group/repo.git)', () => {
	assert.deepEqual(gitUrlParser('git@gitlab.com:group/repo.git'), {
		domain: 'gitlab.com',
		project: 'group/repo'
	});
});

test('parses https remotes and strips the trailing .git', () => {
	assert.deepEqual(gitUrlParser('https://gitlab.com/group/subgroup/repo.git'), {
		domain: 'gitlab.com',
		project: 'group/subgroup/repo'
	});
});

test('parses https remotes without a .git suffix', () => {
	assert.deepEqual(gitUrlParser('https://gitlab.example.com/group/repo'), {
		domain: 'gitlab.example.com',
		project: 'group/repo'
	});
});

test('parses ssh:// remotes with an explicit port (port dropped from domain)', () => {
	assert.deepEqual(gitUrlParser('ssh://git@gitlab.example.com:2222/group/repo.git'), {
		domain: 'gitlab.example.com',
		project: 'group/repo'
	});
});

test('returns empty fields for an unparseable remote', () => {
	assert.deepEqual(gitUrlParser(''), { domain: '', project: '' });
});
