import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SecretStorageLike, TokenStore, resolveToken, secretKey } from '../src/token-store';

class FakeSecrets implements SecretStorageLike {
	private m = new Map<string, string>();
	async get(key: string): Promise<string | undefined> {
		return this.m.get(key);
	}
	async store(key: string, value: string): Promise<void> {
		this.m.set(key, value);
	}
	async delete(key: string): Promise<void> {
		this.m.delete(key);
	}
	/** test helper */
	raw(key: string): string | undefined {
		return this.m.get(key);
	}
}

test('secretKey namespaces the token per domain', () => {
	assert.equal(secretKey('gitlab.com'), 'gitlabCiMonitor.token.gitlab.com');
});

test('resolveToken prefers SecretStorage over settings over env', () => {
	assert.equal(resolveToken({ secret: 's', setting: 'c', env: 'e' }), 's');
	assert.equal(resolveToken({ secret: null, setting: 'c', env: 'e' }), 'c');
	assert.equal(resolveToken({ secret: null, setting: null, env: 'e' }), 'e');
	assert.equal(resolveToken({ secret: null, setting: null, env: null }), null);
});

test('resolveToken treats empty strings as absent', () => {
	assert.equal(resolveToken({ secret: '', setting: '', env: 'e' }), 'e');
	assert.equal(resolveToken({}), null);
});

test('TokenStore.load warms the cache from SecretStorage', async () => {
	const secrets = new FakeSecrets();
	await secrets.store(secretKey('gitlab.com'), 'tok-1');
	const store = new TokenStore(secrets);
	assert.equal(store.cached('gitlab.com'), null); // nothing loaded yet
	await store.load(['gitlab.com', 'gitlab.example.com']);
	assert.equal(store.cached('gitlab.com'), 'tok-1');
	assert.equal(store.cached('gitlab.example.com'), null); // no secret stored
});

test('TokenStore.set writes to SecretStorage and updates the cache', async () => {
	const secrets = new FakeSecrets();
	const store = new TokenStore(secrets);
	await store.set('gitlab.com', 'tok-2');
	assert.equal(store.cached('gitlab.com'), 'tok-2');
	assert.equal(secrets.raw(secretKey('gitlab.com')), 'tok-2');
});

test('TokenStore.clear removes from SecretStorage and the cache', async () => {
	const secrets = new FakeSecrets();
	const store = new TokenStore(secrets);
	await store.set('gitlab.com', 'tok-3');
	await store.clear('gitlab.com');
	assert.equal(store.cached('gitlab.com'), null);
	assert.equal(secrets.raw(secretKey('gitlab.com')), undefined);
});
