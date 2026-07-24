import { window, commands, workspace, Uri, ExtensionContext, TreeView, TreeItem, EventEmitter } from 'vscode';
import {
	TreeViewProvider, updateAllPipelinesStatus, initStatusBar, revealCurrentRepo,
	getConfigForPipeline, getConfigForProject, setRepoExpanded
} from './tree-view';
import { stripAnsi } from './ansi';
import { getAllConfigs, getJobTrace, retryPipeline, cancelPipeline } from './pipelines';

const LOG_SCHEME = 'gitlab-ci-log';

export function activate(context: ExtensionContext) {
	const provider = new TreeViewProvider();

	// The same provider feeds two views: one in Explorer, one in Source Control.
	const explorerView = window.createTreeView('gitlabCiMonitor.explorer', { treeDataProvider: provider, showCollapseAll: true });
	const scmView = window.createTreeView('gitlabCiMonitor.scm', { treeDataProvider: provider, showCollapseAll: true });
	const views: TreeView<TreeItem>[] = [explorerView, scmView];
	context.subscriptions.push(explorerView, scmView);

	// remember which repo groups the user expands, so they persist across refreshes
	for (const v of views) {
		context.subscriptions.push(v.onDidExpandElement((e: any) => {
			if (e.element && e.element.isRepoNode) { setRepoExpanded(e.element.project, true); }
		}));
		context.subscriptions.push(v.onDidCollapseElement((e: any) => {
			if (e.element && e.element.isRepoNode) { setRepoExpanded(e.element.project, false); }
		}));
	}

	context.subscriptions.push(initStatusBar());

	// open a pipeline / job in the browser
	context.subscriptions.push(commands.registerCommand('pipeline.click', (arg: any) => {
		const url = typeof arg === 'string' ? arg : arg?.webUrl;
		if (!url) { return; }
		commands.executeCommand('vscode.open', Uri.parse(url));
	}));

	context.subscriptions.push(commands.registerCommand('gitlabCiMonitor.refresh', () => {
		updateAllPipelinesStatus(provider);
	}));

	context.subscriptions.push(commands.registerCommand('pipeline.retry', async (item: any) => {
		const config = getConfigForPipeline(item?.pipelineId);
		if (!config || !item?.pipelineId) { return; }
		try {
			await retryPipeline(config, item.pipelineId);
			window.setStatusBarMessage(`Pipeline #${item.pipelineId} retried`, 3000);
		} catch (e) {
			window.showErrorMessage(`Retry failed: ${e}`);
		}
		updateAllPipelinesStatus(provider);
	}));

	context.subscriptions.push(commands.registerCommand('pipeline.cancel', async (item: any) => {
		const config = getConfigForPipeline(item?.pipelineId);
		if (!config || !item?.pipelineId) { return; }
		try {
			await cancelPipeline(config, item.pipelineId);
			window.setStatusBarMessage(`Pipeline #${item.pipelineId} canceled`, 3000);
		} catch (e) {
			window.showErrorMessage(`Cancel failed: ${e}`);
		}
		updateAllPipelinesStatus(provider);
	}));

	// job logs open as read-only virtual documents — no "save?" prompt when you close the tab
	const logContents = new Map<string, string>();
	const onDidChangeLog = new EventEmitter<Uri>();
	context.subscriptions.push(workspace.registerTextDocumentContentProvider(LOG_SCHEME, {
		onDidChange: onDidChangeLog.event,
		provideTextDocumentContent: (uri: Uri) => logContents.get(uri.toString()) || ''
	}));
	context.subscriptions.push(commands.registerCommand('pipeline.job.log', async (item: any) => {
		const config = getConfigForProject(item?.project);
		if (!config || !item?.jobId) { return; }
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
	}));

	// follow the active editor: expand its repo group and refresh the status bar
	context.subscriptions.push(window.onDidChangeActiveTextEditor(() => revealCurrentRepo(views)));

	const configs = getAllConfigs();
	const interval = (configs[0] && configs[0].interval) || 5000;
	const tid = setInterval(() => {
		try { updateAllPipelinesStatus(provider); } catch (e) { console.error(e); }
	}, interval);
	context.subscriptions.push({ dispose: () => clearInterval(tid) });

	updateAllPipelinesStatus(provider)
		.then(() => revealCurrentRepo(views))
		.catch(() => { /* ignore */ });
}

export function deactivate() { /* noop */ }
