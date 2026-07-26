import {
	window,
	commands,
	workspace,
	extensions,
	Uri,
	ExtensionContext,
	TreeView,
	TreeItem,
	EventEmitter,
	Pseudoterminal,
	Terminal
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
	invalidatePipelineJobs,
	hasRunningPipelines,
	setRepoExpanded
} from './tree-view';
import { nextPollDelay } from './poll';
import {
	getAllConfigs,
	getJobTrace,
	getJob,
	cancelPipeline,
	runPipeline,
	retryJob,
	cancelJob,
	playJob,
	commitUrl,
	getWorkspaceDomains,
	setTokenStore,
	RepoConfig
} from './pipelines';
import { startLogStream, toTerminalChunk, stripSectionMarkers, LogStream } from './log-stream';
import { TokenStore } from './token-store';

// Job-log terminals, keyed by job id, so a second "view log" reuses the live one.
const logTerminals = new Map<number, Terminal>();

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

	// open a pipeline / job in the browser (pipeline.open is the same, with a
	// pipeline-specific title for the right-click menu)
	const openInBrowser = (arg: any) => {
		const url = typeof arg === 'string' ? arg : arg?.webUrl;
		if (url) {
			commands.executeCommand('vscode.open', Uri.parse(url));
		}
	};
	context.subscriptions.push(
		commands.registerCommand('pipeline.click', openInBrowser),
		commands.registerCommand('pipeline.open', openInBrowser)
	);

	context.subscriptions.push(
		commands.registerCommand('gitlabCiMonitor.refresh', () => {
			updateAllPipelinesStatus(provider);
		})
	);

	// run a brand-new pipeline on a pipeline's ref (a fresh run)
	context.subscriptions.push(
		commands.registerCommand('pipeline.run', async (item: any) => {
			const config = getConfigForPipeline(item?.pipelineId) || getConfigForProject(item?.project);
			const ref = item?.ref || (config && config.currentBranch);
			if (!config || !ref) {
				return;
			}
			try {
				const created = await runPipeline(config, ref);
				window.setStatusBarMessage(`New pipeline #${created?.id ?? ''} started on ${ref}`, 3000);
			} catch (e) {
				window.showErrorMessage(`Run pipeline failed: ${e}`);
			}
			await updateAllPipelinesStatus(provider);
			provider.refresh();
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

	// open the commit that a pipeline ran against
	context.subscriptions.push(
		commands.registerCommand('pipeline.openCommit', (item: any) => {
			const url = commitUrl(item?.webUrl || '', item?.sha || '');
			if (!url) {
				window.showWarningMessage('No commit URL for this pipeline.');
				return;
			}
			commands.executeCommand('vscode.open', Uri.parse(url));
		})
	);

	// single-job actions (retry / cancel / play), shared body — invalidate the pipeline's
	// cached jobs and re-render so the new state shows without waiting for the next poll.
	const jobAction = async (item: any, fn: (c: RepoConfig, id: number) => Promise<any>, verb: string) => {
		const config = getConfigForProject(item?.project);
		if (!config || !item?.jobId) {
			return;
		}
		try {
			await fn(config, Number(item.jobId));
			window.setStatusBarMessage(`Job ${item.jobName || item.jobId} ${verb}`, 3000);
		} catch (e) {
			window.showErrorMessage(`Job ${verb} failed: ${e}`);
		}
		if (item.pipelineId != null) {
			invalidatePipelineJobs(item.pipelineId);
		}
		await updateAllPipelinesStatus(provider);
		provider.refresh();
	};
	context.subscriptions.push(
		commands.registerCommand('pipeline.job.retry', (item: any) => jobAction(item, retryJob, 'retried')),
		commands.registerCommand('pipeline.job.cancel', (item: any) => jobAction(item, cancelJob, 'canceled')),
		commands.registerCommand('pipeline.job.play', (item: any) => jobAction(item, playJob, 'started'))
	);

	// job logs stream live into a terminal — the trace tails in as the job runs, ANSI
	// colors intact, and there is no "save?" prompt. (GitLab exposes no trace WebSocket,
	// so the stream is incremental trace polling — see src/log-stream.ts, GCM-D1.)
	context.subscriptions.push(
		commands.registerCommand('pipeline.job.log', (item: any) => {
			const config = getConfigForProject(item?.project);
			if (!config || !item?.jobId) {
				return;
			}
			openJobLogTerminal(context, config, Number(item.jobId), item.jobName, item.jobStatus);
		})
	);

	// follow the active editor: expand its repo group and refresh the status bar
	context.subscriptions.push(window.onDidChangeActiveTextEditor(() => expandActiveEditorRepo(explorerView)));

	// selecting a repo in the built-in Source Control view expands it in "Pipelines"
	wireBuiltInScmSelection(context, provider, scmView);

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

	// Adaptive polling: GitLab has no pipeline-status WebSocket, so we approximate "live"
	// by self-scheduling — poll fast (≤2s) while anything is running, and back off to the
	// configured interval once everything has finished. A single timer, re-armed after
	// each poll based on whether pipelines are still running.
	const configs = getAllConfigs();
	const idleMs = (configs[0] && configs[0].interval) || 5000;
	const fastMs = 2000;
	let pollTimer: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;
	const scheduleNextPoll = () => {
		if (stopped) {
			return;
		}
		pollTimer = setTimeout(pollOnce, nextPollDelay(hasRunningPipelines(), idleMs, fastMs));
	};
	const pollOnce = async () => {
		try {
			await updateAllPipelinesStatus(provider);
		} catch (e) {
			console.error(e);
		}
		scheduleNextPoll();
	};
	context.subscriptions.push({
		dispose: () => {
			stopped = true;
			if (pollTimer) {
				clearTimeout(pollTimer);
			}
		}
	});

	updateAllPipelinesStatus(provider)
		.then(() => expandActiveEditorRepo(explorerView))
		.catch(() => {
			/* ignore */
		})
		.finally(() => scheduleNextPoll());
}

export function deactivate() {
	/* noop */
}

/**
 * Open (or re-focus) a terminal that streams a job's log. The trace is polled and the
 * newly-appended tail is written to the terminal as it arrives, so a running job's log
 * tails live; ANSI colors are preserved. Closing the terminal stops the stream. A
 * second "view log" for the same job re-focuses the existing terminal instead of
 * opening a duplicate.
 */
function openJobLogTerminal(
	context: ExtensionContext,
	config: RepoConfig,
	jobId: number,
	jobName?: string,
	jobStatus?: string
): void {
	const existing = logTerminals.get(jobId);
	if (existing) {
		existing.show();
		return;
	}

	const writeEmitter = new EventEmitter<string>();
	let stream: LogStream | null = null;

	const pty: Pseudoterminal = {
		onDidWrite: writeEmitter.event,
		open: () => {
			const title = `GitLab CI — job ${jobId}${jobName ? ' · ' + jobName : ''}`;
			writeEmitter.fire(`\x1b[1m${title}\x1b[0m\r\n\r\n`);
			stream = startLogStream({
				initialStatus: jobStatus,
				fetchStatus: () =>
					getJob(config, jobId)
						.then((j: any) => (j && j.status) || '')
						.catch(() => jobStatus || ''),
				fetchTrace: () => getJobTrace(config, jobId),
				onChunk: (chunk, reset) => {
					if (reset) {
						writeEmitter.fire('\x1b[2J\x1b[H'); // clear screen + home
					}
					writeEmitter.fire(toTerminalChunk(stripSectionMarkers(chunk)));
				},
				onDone: (status) => {
					writeEmitter.fire(`\r\n\x1b[2m— job ${status} —\x1b[0m\r\n`);
				}
			});
		},
		close: () => {
			if (stream) {
				stream.stop();
				stream = null;
			}
			logTerminals.delete(jobId);
		}
	};

	const terminal = window.createTerminal({ name: `CI · ${jobName || jobId}`, pty });
	logTerminals.set(jobId, terminal);
	// Disposing on deactivate triggers pty.close(), which stops the stream.
	context.subscriptions.push(terminal);
	terminal.show();
}

/**
 * Expand the matching project in our "Pipelines" panel when the user selects a
 * repository in the built-in Source Control view. Uses the Git extension's
 * RepositoryUIState (`repo.ui.selected` + `repo.ui.onDidChange`). No-op if the
 * Git extension is unavailable or the API shape is not what we expect.
 */
async function wireBuiltInScmSelection(
	context: ExtensionContext,
	provider: TreeViewProvider,
	scmView: TreeView<TreeItem>
): Promise<void> {
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
					revealRepoByPath(provider, scmView, repo.rootUri.fsPath);
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
