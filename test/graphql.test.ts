import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { RepoConfig, buildGraphqlUrl, graphqlRequest, parseJobNeeds, getJobNeeds } from '../src/gitlab-api';

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

test('buildGraphqlUrl derives the /api/graphql endpoint from the REST apiUrl', () => {
	assert.equal(buildGraphqlUrl(makeConfig()), 'https://gitlab.com/api/graphql');
	assert.equal(
		buildGraphqlUrl(makeConfig({ apiUrl: 'https://gitlab.example.com/api/v4' })),
		'https://gitlab.example.com/api/graphql'
	);
});

test('parseJobNeeds turns a GraphQL pipeline payload into a name → needs map', () => {
	const data = {
		data: {
			project: {
				pipeline: {
					jobs: {
						nodes: [
							{ name: 'compile', needs: { nodes: [] } },
							{ name: 'unit', needs: { nodes: [{ name: 'compile' }] } },
							{ name: 'deploy', needs: { nodes: [{ name: 'unit' }, { name: 'compile' }] } }
						]
					}
				}
			}
		}
	};
	const m = parseJobNeeds(data);
	assert.equal(m.has('compile'), false); // no needs → omitted
	assert.deepEqual(m.get('unit'), ['compile']);
	assert.deepEqual(m.get('deploy'), ['unit', 'compile']);
});

test('parseJobNeeds tolerates a missing / malformed payload', () => {
	assert.equal(parseJobNeeds(undefined).size, 0);
	assert.equal(parseJobNeeds({ data: { project: null } }).size, 0);
	assert.equal(parseJobNeeds({ errors: [{ message: 'nope' }] }).size, 0);
});

test('graphqlRequest POSTs the query+variables and returns the parsed body', async () => {
	const server = http.createServer((req, res) => {
		assert.equal(req.method, 'POST');
		assert.equal(req.headers['private-token'], 'secret-token');
		assert.equal(req.headers['content-type'], 'application/json');
		let body = '';
		req.on('data', (c) => (body += c));
		req.on('end', () => {
			const parsed = JSON.parse(body);
			assert.equal(parsed.query.includes('pipeline'), true);
			assert.deepEqual(parsed.variables, { fullPath: 'group/sub/repo', iid: '7' });
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ data: { ok: true } }));
		});
	});
	await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
	const { port } = server.address() as AddressInfo;
	try {
		const conf = makeConfig({ apiUrl: `http://127.0.0.1:${port}/api/v4` });
		const data = await graphqlRequest(
			conf,
			'query { pipeline }',
			{ fullPath: conf.project, iid: '7' },
			http.request
		);
		assert.deepEqual(data, { data: { ok: true } });
	} finally {
		server.close();
	}
});

test('getJobNeeds resolves to a map, and swallows errors as an empty map', async () => {
	const okServer = http.createServer((_req, res) => {
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(
			JSON.stringify({
				data: {
					project: {
						pipeline: { jobs: { nodes: [{ name: 'unit', needs: { nodes: [{ name: 'compile' }] } }] } }
					}
				}
			})
		);
	});
	await new Promise<void>((r) => okServer.listen(0, '127.0.0.1', r));
	const okPort = (okServer.address() as AddressInfo).port;

	const errServer = http.createServer((_req, res) => {
		res.writeHead(500);
		res.end('boom');
	});
	await new Promise<void>((r) => errServer.listen(0, '127.0.0.1', r));
	const errPort = (errServer.address() as AddressInfo).port;

	try {
		const ok = await getJobNeeds(makeConfig({ apiUrl: `http://127.0.0.1:${okPort}/api/v4` }), 7, http.request);
		assert.deepEqual(ok.get('unit'), ['compile']);

		const failed = await getJobNeeds(makeConfig({ apiUrl: `http://127.0.0.1:${errPort}/api/v4` }), 7, http.request);
		assert.equal(failed.size, 0);
	} finally {
		okServer.close();
		errServer.close();
	}
});
