import { workspace } from 'vscode';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { gitUrlParser } from './git-url';
import { RepoConfig } from './gitlab-api';

// The GitLab HTTP layer lives in a vscode-free module so it can be unit-tested;
// re-export it here so existing importers of `./pipelines` keep working.
export {
	buildRequestOptions,
	apiRequest,
	getRunningPipelines,
	getPipelineJobs,
	getJobTrace,
	retryPipeline,
	cancelPipeline
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
	// Optional convenience: fall back to the GITLAB_TOKEN environment variable
	// so a token does not have to be written into settings.json.
	if (!merged.token && process.env.GITLAB_TOKEN) {
		merged.token = process.env.GITLAB_TOKEN;
	}
	return merged;
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
