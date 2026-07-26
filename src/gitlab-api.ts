// GitLab REST API client built on Node's built-in `https` — no runtime
// dependencies, and no VS Code imports, so the whole HTTP layer is unit-testable.
import * as https from 'https';
import type { IncomingMessage, ClientRequest, RequestOptions } from 'http';

export interface RepoConfig {
	domain: string;
	project: string;
	currentBranch: string;
	fsPath?: string;
	apiUrl: string;
	token: string | null;
	interval: number;
	notifyOnFailed: boolean;
}

/** Minimal, injectable stand-in for `https.request` — lets tests drive the
 *  request/response cycle over plain `http` without a TLS handshake. */
export type Transport = (options: RequestOptions, callback: (res: IncomingMessage) => void) => ClientRequest;

/** Build the URL and request options for a GitLab project endpoint. Pure and
 *  side-effect free, so the path/encoding logic can be unit-tested directly. */
export function buildRequestOptions(
	conf: RepoConfig,
	endpoint: string,
	method: 'GET' | 'POST' = 'GET'
): { url: URL; options: RequestOptions } {
	const url = new URL(`${conf.apiUrl}/projects/${encodeURIComponent(conf.project)}${endpoint}`);
	const options: RequestOptions = {
		hostname: url.hostname,
		port: url.port ? Number(url.port) : url.protocol === 'http:' ? 80 : 443,
		path: url.pathname + url.search,
		method,
		headers: { 'PRIVATE-TOKEN': conf.token || '' },
		timeout: 8000
	};
	return { url, options };
}

export function apiRequest(
	conf: RepoConfig,
	endpoint: string,
	method: 'GET' | 'POST' = 'GET',
	asText = false,
	transport: Transport = https.request
): Promise<any> {
	return new Promise((resolve, reject) => {
		if (!conf.token) {
			return reject(new Error(`No token for '${conf.domain}'`));
		}
		let options: RequestOptions;
		try {
			options = buildRequestOptions(conf, endpoint, method).options;
		} catch (e) {
			return reject(e);
		}
		const req = transport(options, (res) => {
			let data = '';
			res.on('data', (chunk) => {
				data += chunk;
			});
			res.on('end', () => {
				const code = res.statusCode || 0;
				if (code < 200 || code >= 300) {
					return reject(new Error(`GitLab API ${code} for ${endpoint}`));
				}
				if (asText) {
					return resolve(data);
				}
				try {
					resolve(data ? JSON.parse(data) : []);
				} catch (e) {
					resolve([]);
				}
			});
		});
		req.on('error', reject);
		req.on('timeout', () => {
			req.destroy(new Error('request timeout'));
		});
		req.end();
	});
}

export function getRunningPipelines(conf: RepoConfig): Promise<any[]> {
	return apiRequest(conf, '/pipelines').then((d) => (Array.isArray(d) ? d : []));
}

export function getPipelineJobs(conf: RepoConfig, pipelineId: number): Promise<any[]> {
	return apiRequest(conf, `/pipelines/${pipelineId}/jobs?per_page=100&page=1`).then((d) =>
		Array.isArray(d) ? d : []
	);
}

export function getJobTrace(conf: RepoConfig, jobId: number): Promise<string> {
	return apiRequest(conf, `/jobs/${jobId}/trace`, 'GET', true) as Promise<string>;
}

/** Fetch a single job (used to read its live status while streaming its log). */
export function getJob(conf: RepoConfig, jobId: number): Promise<any> {
	return apiRequest(conf, `/jobs/${jobId}`);
}

// ---------------------------------------------------------------------------
// GraphQL — used only for the job `needs` DAG, which the REST jobs endpoint does
// not expose. Best-effort: any failure degrades to "no dependency edges".
// ---------------------------------------------------------------------------

// The REST base is `https://<host>/api/v4`; GraphQL lives at `https://<host>/api/graphql`.
export function buildGraphqlUrl(conf: RepoConfig): string {
	return conf.apiUrl.replace(/\/v4\/?$/, '/graphql');
}

const JOB_NEEDS_QUERY =
	'query($fullPath: ID!, $iid: ID!) { project(fullPath: $fullPath) { pipeline(iid: $iid) ' +
	'{ jobs { nodes { name needs { nodes { name } } } } } } }';

/** POST a GraphQL query and resolve the parsed JSON body (including any `errors`). */
export function graphqlRequest(
	conf: RepoConfig,
	query: string,
	variables: Record<string, unknown>,
	transport: Transport = https.request
): Promise<any> {
	return new Promise((resolve, reject) => {
		if (!conf.token) {
			return reject(new Error(`No token for '${conf.domain}'`));
		}
		let url: URL;
		try {
			url = new URL(buildGraphqlUrl(conf));
		} catch (e) {
			return reject(e);
		}
		const body = JSON.stringify({ query, variables });
		const options: RequestOptions = {
			hostname: url.hostname,
			port: url.port ? Number(url.port) : url.protocol === 'http:' ? 80 : 443,
			path: url.pathname + url.search,
			method: 'POST',
			headers: {
				'PRIVATE-TOKEN': conf.token,
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(body)
			},
			timeout: 8000
		};
		const req = transport(options, (res) => {
			let data = '';
			res.on('data', (chunk) => {
				data += chunk;
			});
			res.on('end', () => {
				const code = res.statusCode || 0;
				if (code < 200 || code >= 300) {
					return reject(new Error(`GitLab GraphQL ${code}`));
				}
				try {
					resolve(data ? JSON.parse(data) : {});
				} catch (e) {
					reject(e);
				}
			});
		});
		req.on('error', reject);
		req.on('timeout', () => {
			req.destroy(new Error('request timeout'));
		});
		req.write(body);
		req.end();
	});
}

/** Extract a `job-name → [needed job names]` map from a JOB_NEEDS_QUERY payload. */
export function parseJobNeeds(payload: any): Map<string, string[]> {
	const nodes = payload?.data?.project?.pipeline?.jobs?.nodes;
	const out = new Map<string, string[]>();
	if (!Array.isArray(nodes)) {
		return out;
	}
	for (const j of nodes) {
		const name = (j?.name || '').trim();
		const needs = (j?.needs?.nodes || []).map((n: any) => (n?.name || '').trim()).filter(Boolean);
		if (name && needs.length) {
			out.set(name, needs);
		}
	}
	return out;
}

/** The job `needs` DAG for a pipeline (by its iid). Any failure → an empty map. */
export function getJobNeeds(
	conf: RepoConfig,
	pipelineIid: number | string,
	transport: Transport = https.request
): Promise<Map<string, string[]>> {
	return graphqlRequest(conf, JOB_NEEDS_QUERY, { fullPath: conf.project, iid: String(pipelineIid) }, transport)
		.then(parseJobNeeds)
		.catch(() => new Map<string, string[]>());
}

export function retryPipeline(conf: RepoConfig, pipelineId: number): Promise<any> {
	return apiRequest(conf, `/pipelines/${pipelineId}/retry`, 'POST');
}

export function cancelPipeline(conf: RepoConfig, pipelineId: number): Promise<any> {
	return apiRequest(conf, `/pipelines/${pipelineId}/cancel`, 'POST');
}

// --- single-job actions (retry a finished job, cancel a running one, play a manual one) ---
export function retryJob(conf: RepoConfig, jobId: number, transport: Transport = https.request): Promise<any> {
	return apiRequest(conf, `/jobs/${jobId}/retry`, 'POST', false, transport);
}

export function cancelJob(conf: RepoConfig, jobId: number, transport: Transport = https.request): Promise<any> {
	return apiRequest(conf, `/jobs/${jobId}/cancel`, 'POST', false, transport);
}

export function playJob(conf: RepoConfig, jobId: number, transport: Transport = https.request): Promise<any> {
	return apiRequest(conf, `/jobs/${jobId}/play`, 'POST', false, transport);
}

/** The GitLab commit page for a pipeline, derived from its `web_url` and `sha`.
 *  e.g. `…/-/pipelines/123` + `abc` → `…/-/commit/abc`. Empty if either is missing. */
export function commitUrl(pipelineWebUrl: string, sha: string): string {
	if (!pipelineWebUrl || !sha) {
		return '';
	}
	const base = pipelineWebUrl.replace(/\/-\/pipelines\/.*$/, '');
	return `${base}/-/commit/${sha}`;
}
