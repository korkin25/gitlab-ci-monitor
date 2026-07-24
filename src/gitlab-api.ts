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
export type Transport = (
	options: RequestOptions,
	callback: (res: IncomingMessage) => void
) => ClientRequest;

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
		port: url.port ? Number(url.port) : (url.protocol === 'http:' ? 80 : 443),
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
		if (!conf.token) { return reject(new Error(`No token for '${conf.domain}'`)); }
		let options: RequestOptions;
		try {
			options = buildRequestOptions(conf, endpoint, method).options;
		} catch (e) {
			return reject(e);
		}
		const req = transport(options, (res) => {
			let data = '';
			res.on('data', (chunk) => { data += chunk; });
			res.on('end', () => {
				const code = res.statusCode || 0;
				if (code < 200 || code >= 300) {
					return reject(new Error(`GitLab API ${code} for ${endpoint}`));
				}
				if (asText) { return resolve(data); }
				try { resolve(data ? JSON.parse(data) : []); } catch (e) { resolve([]); }
			});
		});
		req.on('error', reject);
		req.on('timeout', () => { req.destroy(new Error('request timeout')); });
		req.end();
	});
}

export function getRunningPipelines(conf: RepoConfig): Promise<any[]> {
	return apiRequest(conf, '/pipelines').then((d) => (Array.isArray(d) ? d : []));
}

export function getPipelineJobs(conf: RepoConfig, pipelineId: number): Promise<any[]> {
	return apiRequest(conf, `/pipelines/${pipelineId}/jobs?per_page=100&page=1`).then((d) => (Array.isArray(d) ? d : []));
}

export function getJobTrace(conf: RepoConfig, jobId: number): Promise<string> {
	return apiRequest(conf, `/jobs/${jobId}/trace`, 'GET', true) as Promise<string>;
}

export function retryPipeline(conf: RepoConfig, pipelineId: number): Promise<any> {
	return apiRequest(conf, `/pipelines/${pipelineId}/retry`, 'POST');
}

export function cancelPipeline(conf: RepoConfig, pipelineId: number): Promise<any> {
	return apiRequest(conf, `/pipelines/${pipelineId}/cancel`, 'POST');
}
