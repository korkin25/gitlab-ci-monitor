import { workspace } from 'vscode';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { gitUrlParser } from './git-url';
import { RepoConfig } from './gitlab-api';
import { TokenStore, resolveToken } from './token-store';

// The SecretStorage-backed token store, wired up from the extension's activate().
// Secrets are served synchronously from its in-memory cache (see TokenStore).
let tokenStore: TokenStore | null = null;
export const setTokenStore = (store: TokenStore | null): void => {
	tokenStore = store;
};

// The GitLab HTTP layer lives in a vscode-free module so it can be unit-tested;
// re-export it here so existing importers of `./pipelines` keep working.
export {
	buildRequestOptions,
	apiRequest,
	getRunningPipelines,
	getPipelineJobs,
	getJobTrace,
	getJob,
	getJobNeeds,
	retryPipeline,
	cancelPipeline,
	runPipeline,
	retryJob,
	cancelJob,
	playJob,
	commitUrl
} from './gitlab-api';
export type { RepoConfig } from './gitlab-api';

// ---------------------------------------------------------------------------
// git helpers
// ---------------------------------------------------------------------------

const gitClient = (ws?: any) => {
	const fsPath = (ws && ws.uri && ws.uri.fsPath) || '';
	return (...args: string[]) => {
		try {
			return execFileSync('git', ['-C', fsPath, ...args])
				.toString()
				.trim();
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
		if (!branch) {
			return null;
		}
		const remote = git('config', '--get', `branch.${branch}.remote`) || 'origin';
		const url = git('config', '--get', `remote.${remote}.url`);
		if (!url) {
			return null;
		}
		const { domain, project } = gitUrlParser(url);
		if (!domain || !project) {
			return null;
		}
		return { domain, project, currentBranch: branch === 'HEAD' ? 'master' : branch };
	} catch (e) {
		return null;
	}
};

// ---------------------------------------------------------------------------
// configuration
// ---------------------------------------------------------------------------

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
	// Token resolution, most trusted first: VS Code SecretStorage → a plaintext
	// `token` in settings.json (legacy) → the GITLAB_TOKEN environment variable.
	merged.token = resolveToken({
		secret: tokenStore ? tokenStore.cached(domain) : null,
		setting: perDomain.token ?? null,
		env: process.env.GITLAB_TOKEN ?? null
	});
	return merged;
};

// Distinct GitLab domains across the watched workspace folders. Used to warm the
// SecretStorage cache before the first refresh (no token required to compute).
export const getWorkspaceDomains = (): string[] => {
	const folders = workspace.workspaceFolders || [];
	const domains = new Set<string>();
	for (const ws of folders) {
		const fsPath = ws && ws.uri && ws.uri.fsPath;
		if (!fsPath) {
			continue;
		}
		if (!existsSync(join(fsPath, '.git'))) {
			continue;
		}
		if (!existsSync(join(fsPath, '.gitlab-ci.yml'))) {
			continue;
		}
		const repo = getRepoInfo(ws);
		if (repo && repo.domain) {
			domains.add(repo.domain);
		}
	}
	return Array.from(domains);
};

export const getConfig = (): RepoConfig | null => {
	const repo = getRepoInfo();
	if (!repo) {
		return null;
	}
	return { ...getExtensionSettings(repo.domain as string), ...repo } as RepoConfig;
};

// Every workspace folder that is a git repo and contains a .gitlab-ci.yml is watched.
export const getAllConfigs = (): RepoConfig[] => {
	const folders = workspace.workspaceFolders || [];
	const confs: RepoConfig[] = [];
	const seen = new Set<string>();
	for (const ws of folders) {
		const fsPath = ws && ws.uri && ws.uri.fsPath;
		if (!fsPath) {
			continue;
		}
		if (!existsSync(join(fsPath, '.git'))) {
			continue;
		}
		if (!existsSync(join(fsPath, '.gitlab-ci.yml'))) {
			continue;
		}
		const repo = getRepoInfo(ws);
		if (!repo) {
			continue;
		}
		const conf = { ...getExtensionSettings(repo.domain as string), ...repo, fsPath } as RepoConfig;
		if (!conf.token) {
			continue;
		}
		const key = `${conf.domain}|${conf.project}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		confs.push(conf);
	}
	return confs;
};
