import {
	TreeItem,
	TreeDataProvider,
	TreeItemCollapsibleState,
	ProviderResult,
	Event,
	EventEmitter,
	window,
	workspace,
	commands,
	Uri,
	StatusBarAlignment,
	StatusBarItem,
	TreeView
} from 'vscode';
import { RepoConfig, getAllConfigs, getRunningPipelines, getPipelineJobs } from './pipelines';
import { orderJobs } from './job-order';
import { repoProjectForPath, expansionChanges } from './expansion';

// ---------------------------------------------------------------------------
// module state
// ---------------------------------------------------------------------------

let repoNodes: any[] = [];
let pipelinesByRepo: Map<string, any[]> = new Map();
const configByProject: Map<string, RepoConfig> = new Map();
const pipelineConfigById: Map<number, RepoConfig> = new Map();
const lastStatusById: Map<number, string> = new Map();
// jobs cache: the UI reads from here; the network is only touched when an entry is
// missing or its TTL has expired. Finished pipelines keep their jobs for a long time
// (they never change); running pipelines use a short TTL so progress still shows.
const jobsCache: Map<number, { items: any[]; ts: number }> = new Map();
const JOBS_TTL_RUNNING = 4000;
const JOBS_TTL_DONE = 10 * 60 * 1000;
let baselineDone = false;
let currentConfig: RepoConfig | null = null;
let statusBar: StatusBarItem | undefined;
// which repo groups are expanded — persisted across refreshes so a group the user
// opened does not collapse itself when the tree rebuilds every few seconds.
const expandedRepos: Set<string> = new Set();

export const setRepoExpanded = (project: string, expanded: boolean): void => {
	if (expanded) {
		expandedRepos.add(project);
	} else {
		expandedRepos.delete(project);
	}
};

export const getConfigForProject = (project: string): RepoConfig | null =>
	configByProject.get(project) || currentConfig;
export const getConfigForPipeline = (pipelineId: any): RepoConfig | null =>
	pipelineConfigById.get(Number(pipelineId)) || currentConfig;

const STATUS_EMOJI: { [k: string]: string } = {
	success: '✅',
	running: '🏃',
	pending: '⌛',
	failed: '❌',
	canceled: '⛔',
	skipped: '⏭️',
	manual: '🚦',
	created: '🕒',
	scheduled: '🗓️',
	waiting_for_resource: '⏳'
};
const STATUS_CODICON: { [k: string]: string } = {
	success: '$(check)',
	running: '$(sync~spin)',
	pending: '$(clock)',
	failed: '$(error)',
	canceled: '$(circle-slash)',
	skipped: '$(debug-step-over)',
	manual: '$(person)',
	created: '$(clock)',
	scheduled: '$(calendar)'
};

// ---------------------------------------------------------------------------
// tree item builders (plain objects are valid TreeItems; extra fields are ours)
// ---------------------------------------------------------------------------

function createRepoNode(config: RepoConfig, count: number): any {
	const short = (config.project || '').split('/').filter(Boolean).slice(-1)[0] || config.project;
	return {
		id: `repo:${config.project}`,
		isRepoNode: true,
		project: config.project,
		fsPath: config.fsPath,
		label: `📦 ${short} · ${config.currentBranch || ''} (${count})`,
		collapsibleState: expandedRepos.has(config.project)
			? TreeItemCollapsibleState.Expanded
			: TreeItemCollapsibleState.Collapsed,
		tooltip: config.project
	};
}

function createPipelineNode(pipeline: any, config: RepoConfig): any {
	const emoji = STATUS_EMOJI[pipeline.status] || '⌛';
	const running = pipeline.status === 'running' || pipeline.status === 'pending';
	return {
		id: `pipe:${pipeline.id}`,
		label: `${emoji}  ${pipeline.id} · ${pipeline.status} · ${pipeline.ref}`,
		collapsibleState: TreeItemCollapsibleState.Collapsed,
		tooltip: pipeline.web_url,
		contextValue: running ? 'pipelineItemRunning' : 'pipelineItemRetryable',
		pipelineId: pipeline.id,
		pipelineStatus: pipeline.status,
		ref: pipeline.ref,
		project: config.project,
		webUrl: pipeline.web_url,
		command: { title: 'Open in GitLab', command: 'pipeline.click', arguments: [pipeline.web_url] }
	};
}

function createJobNode(job: any, config: RepoConfig): any {
	const emoji = STATUS_EMOJI[job.status] || '⌛';
	const stage = job.stage ? `[${job.stage}] ` : '';
	return {
		id: `job:${job.id}`,
		label: `${emoji}  ${stage}${job.name || job.id}`,
		collapsibleState: TreeItemCollapsibleState.None,
		tooltip: job.web_url,
		contextValue: 'jobItem',
		jobId: job.id,
		jobName: job.name,
		project: config.project,
		webUrl: job.web_url,
		command: { title: 'Open job in GitLab', command: 'pipeline.click', arguments: [job.web_url] }
	};
}

// ---------------------------------------------------------------------------
// tree data provider
// ---------------------------------------------------------------------------

export class TreeViewProvider implements TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData = new EventEmitter<any>();
	readonly onDidChangeTreeData: Event<any> = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(element: TreeItem): TreeItem {
		return element;
	}

	getParent(element: any): ProviderResult<TreeItem> {
		if (!element || element.isRepoNode) {
			return undefined;
		}
		if (element.pipelineId != null) {
			return repoNodes.find((r) => r.project === element.project);
		}
		return undefined;
	}

	async getChildren(element?: any): Promise<TreeItem[]> {
		if (!element) {
			return repoNodes;
		}
		if (element.isRepoNode) {
			return pipelinesByRepo.get(element.project) || [];
		}
		if (element.pipelineId != null) {
			const id = Number(element.pipelineId);
			const config = pipelineConfigById.get(id) || currentConfig;
			if (!config) {
				return [];
			}
			const status = element.pipelineStatus;
			const ttl =
				status === 'running' || status === 'pending' || status === 'created' ? JOBS_TTL_RUNNING : JOBS_TTL_DONE;
			const cached = jobsCache.get(id);
			if (cached && Date.now() - cached.ts < ttl) {
				return cached.items;
			}
			let jobs: any[];
			try {
				jobs = await getPipelineJobs(config, id);
			} catch (e) {
				jobs = [];
			}
			const items = orderJobs(jobs).map((j) => createJobNode(j, config));
			jobsCache.set(id, { items, ts: Date.now() });
			return items;
		}
		return [];
	}
}

// ---------------------------------------------------------------------------
// status bar
// ---------------------------------------------------------------------------

export function initStatusBar(): StatusBarItem {
	statusBar = window.createStatusBarItem(StatusBarAlignment.Left, -Infinity);
	statusBar.text = '$(sync~spin) GitLab CI';
	statusBar.tooltip = 'GitLab CI Monitor';
	statusBar.show();
	return statusBar;
}

function pickCurrentConfig(): RepoConfig | null {
	const ed = window.activeTextEditor;
	if (ed && ed.document && ed.document.uri) {
		const wf = workspace.getWorkspaceFolder(ed.document.uri);
		if (wf) {
			for (const c of configByProject.values()) {
				if (c.fsPath === wf.uri.fsPath) {
					return c;
				}
			}
		}
	}
	return currentConfig;
}

function updateStatusBar(): void {
	if (!statusBar) {
		return;
	}
	const config = pickCurrentConfig();
	if (!config) {
		statusBar.text = '$(circle-slash) GitLab CI';
		statusBar.tooltip = 'GitLab CI Monitor — no repo';
		statusBar.command = undefined;
		return;
	}
	const short = (config.project || '').split('/').slice(-1)[0];
	const items = pipelinesByRepo.get(config.project) || [];
	const item = items.find((it: any) => it.ref === config.currentBranch) || items[0];
	if (!item) {
		statusBar.text = `$(circle-slash) ${short}: no pipeline`;
		statusBar.tooltip = `${config.project}: no pipeline for current branch`;
		statusBar.command = undefined;
		return;
	}
	const codicon = STATUS_CODICON[item.pipelineStatus] || '$(clock)';
	statusBar.text = `${codicon} ${short}: ${item.pipelineStatus}`;
	statusBar.tooltip = `${config.project}\npipeline #${item.pipelineId} (${item.ref}) — ${item.pipelineStatus}\nClick to open in GitLab`;
	statusBar.command = { title: 'Open pipeline in GitLab', command: 'pipeline.click', arguments: [item.webUrl] };
}

// ---------------------------------------------------------------------------
// failure notifications
// ---------------------------------------------------------------------------

function checkFailure(pipeline: any, config: RepoConfig): void {
	const id = pipeline.id;
	const prev = lastStatusById.get(id);
	lastStatusById.set(id, pipeline.status);
	if (prev && prev !== pipeline.status) {
		jobsCache.delete(id);
	} // status changed → job list is stale
	if (!baselineDone) {
		return;
	} // don't notify for the initial snapshot
	if (config.notifyOnFailed === false) {
		return;
	}
	if (pipeline.status === 'failed' && prev !== 'failed') {
		const short = (config.project || '').split('/').slice(-1)[0];
		window
			.showErrorMessage(`❌ Pipeline #${pipeline.id} failed — ${short} (${pipeline.ref})`, 'Open in GitLab')
			.then((choice) => {
				if (choice && pipeline.web_url) {
					commands.executeCommand('vscode.open', Uri.parse(pipeline.web_url));
				}
			});
	}
}

// ---------------------------------------------------------------------------
// refresh loop
// ---------------------------------------------------------------------------

export async function updateAllPipelinesStatus(provider: TreeViewProvider): Promise<void> {
	const configs = getAllConfigs();
	currentConfig = configs[0] || currentConfig;
	configByProject.clear();
	pipelineConfigById.clear();
	const newRepoNodes: any[] = [];
	const newByRepo = new Map<string, any[]>();
	const currentIds = new Set<number>();
	for (const config of configs) {
		configByProject.set(config.project, config);
		let pipelines: any[];
		try {
			pipelines = await getRunningPipelines(config);
		} catch (e) {
			pipelines = [];
		}
		const items = pipelines.map((p: any) => {
			currentIds.add(p.id);
			pipelineConfigById.set(p.id, config);
			checkFailure(p, config);
			return createPipelineNode(p, config);
		});
		newByRepo.set(config.project, items);
		newRepoNodes.push(createRepoNode(config, items.length));
	}
	repoNodes = newRepoNodes;
	pipelinesByRepo = newByRepo;
	baselineDone = true;
	// drop cache entries for pipelines that dropped out of the list
	for (const id of jobsCache.keys()) {
		if (!currentIds.has(id)) {
			jobsCache.delete(id);
		}
	}
	for (const id of lastStatusById.keys()) {
		if (!currentIds.has(id)) {
			lastStatusById.delete(id);
		}
	}
	updateStatusBar();
	provider.refresh();
}

// ---------------------------------------------------------------------------
// expansion via reveal() — but only in the panel the user is already in
// ---------------------------------------------------------------------------

/**
 * Expand and reveal a repo in ONE view. reveal() reliably expands the node, and
 * because we only ever call it on the view whose container is already frontmost
 * (the panel the click / active editor came from), the sidebar never jumps.
 * Only acts when the repo is currently collapsed, so clicking an expanded repo
 * still collapses it natively (no fight with the native toggle). The other panel
 * catches up on the next periodic refresh via `expandedRepos` → collapsibleState.
 */
function doReveal(view: TreeView<TreeItem>, project: string): void {
	const target = repoNodes.find((r) => r.project === project);
	if (!target) {
		return;
	}
	expandedRepos.add(project); // persist across the periodic refresh
	try {
		view.reveal(target, { expand: true, select: false, focus: false });
	} catch (e) {
		/* ignore */
	}
}

export function revealRepoInView(view: TreeView<TreeItem>, project: string): void {
	if (!expansionChanges(expandedRepos, project, true)) {
		return; // already expanded — let a native click collapse it
	}
	doReveal(view, project);
}

// Expand the repo at `fsPath` (e.g. a git root) in the given view — always scroll
// to and expand it. Used when a repository is selected in the built-in Source
// Control view, so the matching project opens in our "Pipelines" panel.
export function revealRepoByPath(view: TreeView<TreeItem>, fsPath: string): void {
	const project = repoProjectForPath(repoNodes, fsPath);
	if (project) {
		doReveal(view, project);
	}
}

// Expand the active editor's repo in the Explorer panel (where files live), so
// opening a file expands its project. Only when that panel is actually visible,
// so switching files never pulls focus to it from another sidebar.
export function expandActiveEditorRepo(explorerView: TreeView<TreeItem>): void {
	const ed = window.activeTextEditor;
	if (ed && ed.document && ed.document.uri && explorerView.visible) {
		const wf = workspace.getWorkspaceFolder(ed.document.uri);
		if (wf) {
			const project = repoProjectForPath(repoNodes, wf.uri.fsPath);
			if (project) {
				revealRepoInView(explorerView, project);
			}
		}
	}
	updateStatusBar();
}
