import { workspace } from 'vscode';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import * as https from 'https';

// ---------------------------------------------------------------------------
// git helpers
// ---------------------------------------------------------------------------

function gitUrlParser(url: string): { domain: string; project: string } {
	// normalise scp-like `git@host:group/repo.git` into a URL we can parse
	const giturl = /:\/\//.test(url) ? url : `ssh://${url.replace(/:~?/g, '/')}`;
	try {
		const u = new URL(giturl);
		return {
			domain: u.hostname,
			project: u.pathname.replace(/\.git$/, '').replace(/^\/+/, '').trim()
		};
	} catch (e) {
		return { domain: '', project: '' };
	}
}

const gitClient = (ws?: any) => {
	const fsPath = (ws && ws.uri && ws.uri.fsPath) || '';
	return (...args: string[]) => {
		try {
			return execFileSync('git', ['-C', fsPath, ...args]).toString().trim();
		} catch (e) {
			// `git config --get` exits non-zero when a key is missing; that is expected
			return '';
		}
	};
};

const getRepoInfo = (ws?: any) => {
	const folder = ws || (workspace.workspaceFolders || [])[0];
	try {
		const git = gitClient(folder);
		const branch = git('rev-parse', '--abbrev-ref', 'HEAD').trim();
		if (!branch) { return null; }
		const remote = git('config', '--get', `branch.${branch}.remote`) || 'origin';
		const url = git('config', '--get', `remote.${remote}.url`);
		if (!url) { return null; }
		const { domain, project } = gitUrlParser(url);
		if (!domain || !project) { return null; }
		return { domain, project, currentBranch: branch === 'HEAD' ? 'master' : branch };
	} catch (e) {
		return null;
	}
};

// ---------------------------------------------------------------------------
// configuration
// ---------------------------------------------------------------------------

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

export const getExtensionSettings = (domain: string): any => {
	const defaults = {
		token: null,
		interval: 5000,
		notifyOnFailed: true,
		apiUrl: `https://${domain}/api/v4`
	};
	const settings = workspace.getConfiguration('GitLabPipelines');
	const perDomain = (settings.get(domain) as any) || {};
	const merged = { ...defaults, ...perDomain };
	// Optional convenience: fall back to the GITLAB_TOKEN environment variable
	// so a token does not have to be written into settings.json.
	if (!merged.token && process.env.GITLAB_TOKEN) {
		merged.token = process.env.GITLAB_TOKEN;
	}
	return merged;
};

export const getConfig = (): RepoConfig | null => {
	const repo = getRepoInfo();
	if (!repo) { return null; }
	return { ...getExtensionSettings(repo.domain as string), ...repo } as RepoConfig;
};

// Every workspace folder that is a git repo and contains a .gitlab-ci.yml is watched.
export const getAllConfigs = (): RepoConfig[] => {
	const folders = workspace.workspaceFolders || [];
	const confs: RepoConfig[] = [];
	const seen = new Set<string>();
	for (const ws of folders) {
		const fsPath = ws && ws.uri && ws.uri.fsPath;
		if (!fsPath) { continue; }
		if (!existsSync(join(fsPath, '.git'))) { continue; }
		if (!existsSync(join(fsPath, '.gitlab-ci.yml'))) { continue; }
		const repo = getRepoInfo(ws);
		if (!repo) { continue; }
		const conf = { ...getExtensionSettings(repo.domain as string), ...repo, fsPath } as RepoConfig;
		if (!conf.token) { continue; }
		const key = `${conf.domain}|${conf.project}`;
		if (seen.has(key)) { continue; }
		seen.add(key);
		confs.push(conf);
	}
	return confs;
};

// ---------------------------------------------------------------------------
// GitLab REST API (built-in https, no runtime dependencies)
// ---------------------------------------------------------------------------

function apiRequest(conf: RepoConfig, endpoint: string, method: 'GET' | 'POST' = 'GET', asText = false): Promise<any> {
	return new Promise((resolve, reject) => {
		if (!conf.token) { return reject(new Error(`No token for '${conf.domain}'`)); }
		let u: URL;
		try {
			u = new URL(`${conf.apiUrl}/projects/${encodeURIComponent(conf.project)}${endpoint}`);
		} catch (e) {
			return reject(e);
		}
		const options: https.RequestOptions = {
			hostname: u.hostname,
			port: u.port || 443,
			path: u.pathname + u.search,
			method,
			headers: { 'PRIVATE-TOKEN': conf.token },
			timeout: 8000
		};
		const req = https.request(options, (res) => {
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
