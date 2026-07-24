import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { RepoConfig, buildRequestOptions, apiRequest } from '../src/gitlab-api';

function makeConfig(over: Partial<RepoConfig> = {}): RepoConfig {
	return {
		domain: 'gitlab.com',
		project: 'group/sub/repo',
		currentBranch: 'main',
		apiUrl: 'https://gitlab.com/api/v4',
		token: 'secret-token',
		interval: 5000,
		notifyOnFailed: true,
		...over
	};
}

test('buildRequestOptions URL-encodes the project path and builds the request path', () => {
	const { url, options } = buildRequestOptions(makeConfig(), '/pipelines', 'GET');
	assert.equal(url.pathname, '/api/v4/projects/group%2Fsub%2Frepo/pipelines');
	assert.equal(options.hostname, 'gitlab.com');
	assert.equal(options.port, 443);
	assert.equal(options.method, 'GET');
	assert.equal((options.headers as any)['PRIVATE-TOKEN'], 'secret-token');
});

test('buildRequestOptions preserves query strings in the path', () => {
	const { options } = buildRequestOptions(makeConfig(), '/pipelines/5/jobs?per_page=100&page=1', 'GET');
	assert.equal(options.path, '/api/v4/projects/group%2Fsub%2Frepo/pipelines/5/jobs?per_page=100&page=1');
});

test('apiRequest rejects when no token is configured', async () => {
	await assert.rejects(
		() => apiRequest(makeConfig({ token: null }), '/pipelines'),
		/No token/
	);
});

test('apiRequest parses a 2xx JSON body', async () => {
	const server = http.createServer((req, res) => {
		assert.equal(req.headers['private-token'], 'secret-token');
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(JSON.stringify([{ id: 1, status: 'success' }]));
	});
	await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
	const { port } = server.address() as AddressInfo;
	try {
		const conf = makeConfig({ apiUrl: `http://127.0.0.1:${port}/api/v4` });
		const data = await apiRequest(conf, '/pipelines', 'GET', false, http.request);
		assert.deepEqual(data, [{ id: 1, status: 'success' }]);
	} finally {
		server.close();
	}
});

test('apiRequest returns the raw body when asText is true', async () => {
	const server = http.createServer((_req, res) => {
		res.writeHead(200, { 'content-type': 'text/plain' });
		res.end('raw job log');
	});
	await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
	const { port } = server.address() as AddressInfo;
	try {
		const conf = makeConfig({ apiUrl: `http://127.0.0.1:${port}/api/v4` });
		const data = await apiRequest(conf, '/jobs/9/trace', 'GET', true, http.request);
		assert.equal(data, 'raw job log');
	} finally {
		server.close();
	}
});

test('apiRequest rejects on a non-2xx response', async () => {
	const server = http.createServer((_req, res) => {
		res.writeHead(404);
		res.end('nope');
	});
	await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
	const { port } = server.address() as AddressInfo;
	try {
		const conf = makeConfig({ apiUrl: `http://127.0.0.1:${port}/api/v4` });
		await assert.rejects(
			() => apiRequest(conf, '/pipelines', 'GET', false, http.request),
			/404/
		);
	} finally {
		server.close();
	}
});
