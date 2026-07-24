import {
	window,
	commands,
	workspace,
	extensions,
	Uri,
	ExtensionContext,
	TreeView,
	TreeItem,
	EventEmitter
} from 'vscode';
import {
	TreeViewProvider,
	updateAllPipelinesStatus,
	initStatusBar,
	expandActiveEditorRepo,
	revealRepoInView,
	revealRepoByPath,
	getConfigForPipeline,
	getConfigForProject,
	setRepoExpanded
} from './tree-view';
import { stripAnsi } from './ansi';
import {
	getAllConfigs,
	getJobTrace,
	retryPipeline,
	cancelPipeline,
	getWorkspaceDomains,
	setTokenStore
} from './pipelines';
import { TokenStore } from './token-store';

const LOG_SCHEME = 'gitlab-ci-log';

export async function activate(context: ExtensionContext) {
	const provider = new TreeViewProvider();

	// The same provider feeds two views: one in Explorer, one in Source Control.
	const explorerView = window.createTreeView('gitlabCiMonitor.explorer', {
		treeDataProvider: provider,
		showCollapseAll: true
	});
	const scmView = window.createTreeView('gitlabCiMonitor.scm', { treeDataProvider: provider, showCollapseAll: true });
	const views: TreeView<TreeItem>[] = [explorerView, scmView];
	context.subscriptions.push(explorerView, scmView);

	for (const v of views) {
		// Remember expand/collapse so it persists across the periodic refresh.
		context.subscriptions.push(
			v.onDidExpandElement((e: any) => {
				if (e.element && e.element.isRepoNode) {
					setRepoExpanded(e.element.project, true);
				}
			})
		);
		context.subscriptions.push(
			v.onDidCollapseElement((e: any) => {
				if (e.element && e.element.isRepoNode) {
					setRepoExpanded(e.element.project, false);
				}
			})
		);
		// Clicking a repo selects it — expand it in the SAME panel via reveal().
		// Revealing only in the panel the click came from (already frontmost)
		// means the sidebar never jumps. Guarded so it only expands (a second
		// click on the selected repo still collapses it natively).
		context.subscriptions.push(
			v.onDidChangeSelection((e: any) => {
				const node = e.selection && e.selection[0];
				if (node && node.isRepoNode) {
					revealRepoInView(v, node.project);
				}
			})
		);
	}

	context.subscriptions.push(initStatusBar());

	// open a pipeline / job in the browser
	context.subscriptions.push(
		commands.registerCommand('pipeline.click', (arg: any) => {
			const url = typeof arg === 'string' ? arg : arg?.webUrl;
			if (!url) {
				return;
			}
			commands.executeCommand('vscode.open', Uri.parse(url));
		})
	);

	context.subscriptions.push(
		commands.registerCommand('gitlabCiMonitor.refresh', () => {
			updateAllPipelinesStatus(provider);
		})
	);

	context.subscriptions.push(
		commands.registerCommand('pipeline.retry', async (item: any) => {
			const config = getConfigForPipeline(item?.pipelineId);
			if (!config || !item?.pipelineId) {
				return;
			}
			try {
				await retryPipeline(config, item.pipelineId);
				window.setStatusBarMessage(`Pipeline #${item.pipelineId} retried`, 3000);
			} catch (e) {
				window.showErrorMessage(`Retry failed: ${e}`);
			}
			updateAllPipelinesStatus(provider);
		})
	);

	context.subscriptions.push(
		commands.registerCommand('pipeline.cancel', async (item: any) => {
			const config = getConfigForPipeline(item?.pipelineId);
			if (!config || !item?.pipelineId) {
				return;
			}
			try {
				await cancelPipeline(config, item.pipelineId);
				window.setStatusBarMessage(`Pipeline #${item.pipelineId} canceled`, 3000);
			} catch (e) {
				window.showErrorMessage(`Cancel failed: ${e}`);
			}
			updateAllPipelinesStatus(provider);
		})
	);

	// job logs open as read-only virtual documents — no "save?" prompt when you close the tab
	const logContents = new Map<string, string>();
	const onDidChangeLog = new EventEmitter<Uri>();
	context.subscriptions.push(
		workspace.registerTextDocumentContentProvider(LOG_SCHEME, {
			onDidChange: onDidChangeLog.event,
			provideTextDocumentContent: (uri: Uri) => logContents.get(uri.toString()) || ''
		})
	);
	context.subscriptions.push(
		commands.registerCommand('pipeline.job.log', async (item: any) => {
			const config = getConfigForProject(item?.project);
			if (!config || !item?.jobId) {
				return;
			}
			try {
				const trace = await getJobTrace(config, item.jobId);
				const header = `# GitLab CI — job ${item.jobId}${item.jobName ? ' · ' + item.jobName : ''}\n\n`;
				const text = header + (stripAnsi(String(trace || '')) || '(empty log)');
				const uri = Uri.parse(`${LOG_SCHEME}:job-${item.jobId}.log`);
				logContents.set(uri.toString(), text);
				onDidChangeLog.fire(uri);
				const doc = await workspace.openTextDocument(uri);
				await window.showTextDocument(doc, { preview: false });
			} catch (e) {
				window.showErrorMessage(`Failed to load job log: ${e}`);
			}
		})
	);

	// follow the active editor: expand its repo group and refresh the status bar
	context.subscriptions.push(window.onDidChangeActiveTextEditor(() => expandActiveEditorRepo(explorerView)));

	// selecting a repo in the built-in Source Control view expands it in "Pipelines"
	wireBuiltInScmSelection(context, scmView);

	// --- secure token storage (VS Code SecretStorage) -----------------------
	const tokenStore = new TokenStore(context.secrets);
	setTokenStore(tokenStore);
	context.subscriptions.push({ dispose: () => setTokenStore(null) });

	const reloadSecrets = () => tokenStore.load(getWorkspaceDomains());

	// One-time migration: copy any plaintext token from settings.json into
	// SecretStorage so it stops living in plaintext. The setting is left in
	// place (never edited on the user's behalf); they are told they can remove it.
	const migrateSettingsTokens = async () => {
		for (const domain of getWorkspaceDomains()) {
			if (tokenStore.cached(domain)) {
				continue;
			}
			const perDomain = workspace.getConfiguration('GitLabPipelines').get(domain) as any;
			const settingToken = perDomain && perDomain.token;
			if (settingToken) {
				await tokenStore.set(domain, settingToken);
				window.showInformationMessage(
					`GitLab CI Monitor moved the token for ${domain} into VS Code Secret Storage. ` +
						`You can now remove "GitLabPipelines.${domain}.token" from settings.json.`
				);
			}
		}
	};

	// React to secrets changed here or in another window.
	context.subscriptions.push(
		context.secrets.onDidChange(async () => {
			await reloadSecrets();
			updateAllPipelinesStatus(provider);
		})
	);

	const pickDomain = async (placeHolder: string): Promise<string | undefined> => {
		const domains = getWorkspaceDomains();
		if (domains.length === 1) {
			return domains[0];
		}
		if (domains.length > 1) {
			return window.showQuickPick(domains, { placeHolder });
		}
		return window.showInputBox({ prompt: 'GitLab host (e.g. gitlab.com)', ignoreFocusOut: true });
	};

	context.subscriptions.push(
		commands.registerCommand('gitlabCiMonitor.setToken', async () => {
			const domain = await pickDomain('Select the GitLab host to set a token for');
			if (!domain) {
				return;
			}
			const token = await window.showInputBox({
				prompt: `GitLab personal access token for ${domain}`,
				password: true,
				ignoreFocusOut: true
			});
			if (!token) {
				return;
			}
			await tokenStore.set(domain, token.trim());
			window.setStatusBarMessage(`GitLab token saved for ${domain}`, 3000);
			updateAllPipelinesStatus(provider);
		})
	);

	context.subscriptions.push(
		commands.registerCommand('gitlabCiMonitor.clearToken', async () => {
			const domain = await pickDomain('Select the GitLab host to clear the token for');
			if (!domain) {
				return;
			}
			await tokenStore.clear(domain);
			window.setStatusBarMessage(`GitLab token cleared for ${domain}`, 3000);
			updateAllPipelinesStatus(provider);
		})
	);

	// Warm the cache (and migrate legacy settings tokens) before the first refresh.
	await reloadSecrets();
	await migrateSettingsTokens();

	const configs = getAllConfigs();
	const interval = (configs[0] && configs[0].interval) || 5000;
	const tid = setInterval(() => {
		try {
			updateAllPipelinesStatus(provider);
		} catch (e) {
			console.error(e);
		}
	}, interval);
	context.subscriptions.push({ dispose: () => clearInterval(tid) });

	updateAllPipelinesStatus(provider)
		.then(() => expandActiveEditorRepo(explorerView))
		.catch(() => {
			/* ignore */
		});
}

export function deactivate() {
	/* noop */
}

/**
 * Expand the matching project in our "Pipelines" panel when the user selects a
 * repository in the built-in Source Control view. Uses the Git extension's
 * RepositoryUIState (`repo.ui.selected` + `repo.ui.onDidChange`). No-op if the
 * Git extension is unavailable or the API shape is not what we expect.
 */
async function wireBuiltInScmSelection(context: ExtensionContext, scmView: TreeView<TreeItem>): Promise<void> {
	const gitExt = extensions.getExtension('vscode.git');
	if (!gitExt) {
		return;
	}
	let git: any;
	try {
		const exps = gitExt.isActive ? gitExt.exports : await gitExt.activate();
		git = exps.getAPI(1);
	} catch (e) {
		return;
	}
	const attach = (repo: any) => {
		if (!repo || !repo.ui || !repo.rootUri || typeof repo.ui.onDidChange !== 'function') {
			return;
		}
		context.subscriptions.push(
			repo.ui.onDidChange(() => {
				if (repo.ui.selected) {
					revealRepoByPath(scmView, repo.rootUri.fsPath);
				}
			})
		);
	};
	for (const repo of git.repositories || []) {
		attach(repo);
	}
	if (typeof git.onDidOpenRepository === 'function') {
		context.subscriptions.push(git.onDidOpenRepository((repo: any) => attach(repo)));
	}
}
