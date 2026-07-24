"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = require("node:assert/strict");
const http = require("node:http");
const gitlab_api_1 = require("../src/gitlab-api");
function makeConfig(over = {}) {
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
(0, node_test_1.test)('buildRequestOptions URL-encodes the project path and builds the request path', () => {
    const { url, options } = (0, gitlab_api_1.buildRequestOptions)(makeConfig(), '/pipelines', 'GET');
    strict_1.default.equal(url.pathname, '/api/v4/projects/group%2Fsub%2Frepo/pipelines');
    strict_1.default.equal(options.hostname, 'gitlab.com');
    strict_1.default.equal(options.port, 443);
    strict_1.default.equal(options.method, 'GET');
    strict_1.default.equal(options.headers['PRIVATE-TOKEN'], 'secret-token');
});
(0, node_test_1.test)('buildRequestOptions preserves query strings in the path', () => {
    const { options } = (0, gitlab_api_1.buildRequestOptions)(makeConfig(), '/pipelines/5/jobs?per_page=100&page=1', 'GET');
    strict_1.default.equal(options.path, '/api/v4/projects/group%2Fsub%2Frepo/pipelines/5/jobs?per_page=100&page=1');
});
(0, node_test_1.test)('apiRequest rejects when no token is configured', async () => {
    await strict_1.default.rejects(() => (0, gitlab_api_1.apiRequest)(makeConfig({ token: null }), '/pipelines'), /No token/);
});
(0, node_test_1.test)('apiRequest parses a 2xx JSON body', async () => {
    const server = http.createServer((req, res) => {
        strict_1.default.equal(req.headers['private-token'], 'secret-token');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify([{ id: 1, status: 'success' }]));
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address();
    try {
        const conf = makeConfig({ apiUrl: `http://127.0.0.1:${port}/api/v4` });
        const data = await (0, gitlab_api_1.apiRequest)(conf, '/pipelines', 'GET', false, http.request);
        strict_1.default.deepEqual(data, [{ id: 1, status: 'success' }]);
    }
    finally {
        server.close();
    }
});
(0, node_test_1.test)('apiRequest returns the raw body when asText is true', async () => {
    const server = http.createServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('raw job log');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address();
    try {
        const conf = makeConfig({ apiUrl: `http://127.0.0.1:${port}/api/v4` });
        const data = await (0, gitlab_api_1.apiRequest)(conf, '/jobs/9/trace', 'GET', true, http.request);
        strict_1.default.equal(data, 'raw job log');
    }
    finally {
        server.close();
    }
});
(0, node_test_1.test)('apiRequest rejects on a non-2xx response', async () => {
    const server = http.createServer((_req, res) => {
        res.writeHead(404);
        res.end('nope');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address();
    try {
        const conf = makeConfig({ apiUrl: `http://127.0.0.1:${port}/api/v4` });
        await strict_1.default.rejects(() => (0, gitlab_api_1.apiRequest)(conf, '/pipelines', 'GET', false, http.request), /404/);
    }
    finally {
        server.close();
    }
});
//# sourceMappingURL=gitlab-api.test.js.map