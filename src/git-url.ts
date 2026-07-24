// Parse a git remote URL into its GitLab host and project path.
// Pure and dependency-free so it can be unit-tested without the VS Code runtime.

export interface GitRemote {
	/** Host of the git remote, e.g. `gitlab.com`. */
	domain: string;
	/** Project path without a leading slash or trailing `.git`, e.g. `group/repo`. */
	project: string;
}

export function gitUrlParser(url: string): GitRemote {
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
