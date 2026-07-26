import {
	TreeItem,
	TreeDataProvider,
	TreeItemCollapsibleState,
	ProviderResult,
	Event,
	EventEmitter,
	window,
	workspace,
	ProgressLocation,
	StatusBarAlignment,
	StatusBarItem,
	TreeView
} from 'vscode';
import { RepoConfig, getAllConfigs, getRunningPipelines, getPipelineJobs, getJobNeeds } from './pipelines';
import { groupJobsByStage, resolveNeeds, aggregateStageStatus, JobDep } from './job-order';
import { repoProjectForPath, expansionChanges } from './expansion';
import { latestFailedByRef, pendingFailureNotifications, formatFailureMessage } from './notify';
import { pipelinesSignature } from './signature';

// ---------------------------------------------------------------------------
// module state
// ---------------------------------------------------------------------------

let repoNodes: any[] = [];
let pipelinesByRepo: Map<string, any[]> = new Map();
const configByProject: Map<string, RepoConfig> = new Map();
const pipelineConfigById: Map<number, RepoConfig> = new Map();
const lastStatusById: Map<number, string> = new Map();
// last failed pipeline id we notified about, per `project|ref` — so we notify
// once per branch failure, and only when that failure is the branch's latest.
const notifiedFailureByRef: Map<string, number> = new Map();
// stage-tree cache: the UI reads from here; the network is only touched when an entry
// is missing or its TTL has expired. Finished pipelines keep their tree for a long time
// (it never changes); running pipelines use a short TTL so progress still shows. Each
// entry is the pipeline's list of stage nodes (each carrying its job/dependency subtree).
const jobsCache: Map<number, { stages: any[]; ts: number }> = new Map();
const JOBS_TTL_RUNNING = 4000;
const JOBS_TTL_DONE = 10 * 60 * 1000;
// How long the transient failure toast stays before it dismisses itself (no click).
const FAILURE_TOAST_MS = 2500;
// signature of the last rendered pipeline data — the tree is only refreshed when
// this changes, so nothing re-renders (and expanded jobs stay cached) while the
// pipelines are unchanged.
let lastSignature: string | null = null;
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
		isPipelineNode: true,
		label: `${emoji}  ${pipeline.id} · ${pipeline.status} · ${pipeline.ref}`,
		collapsibleState: TreeItemCollapsibleState.Collapsed,
		tooltip: pipeline.web_url,
		contextValue: running ? 'pipelineItemRunning' : 'pipelineItemRetryable',
		pipelineId: pipeline.id,
		iid: pipeline.iid,
		pipelineStatus: pipeline.status,
		ref: pipeline.ref,
		project: config.project,
		webUrl: pipeline.web_url,
		command: { title: 'Open in GitLab', command: 'pipeline.click', arguments: [pipeline.web_url] }
	};
}

// A stage groups the jobs that run in it. Its label carries an aggregate status so
// the pipeline reads at a glance without expanding every stage.
function createStageNode(pipelineId: number, stage: string, jobNodes: any[], jobs: any[]): any {
	const emoji = STATUS_EMOJI[aggregateStageStatus(jobs)] || '⌛';
	return {
		id: `stage:${pipelineId}:${stage}`,
		isStageNode: true,
		label: `${emoji}  ${stage || 'jobs'} (${jobNodes.length})`,
		collapsibleState: TreeItemCollapsibleState.Expanded,
		contextValue: 'stageItem',
		children: jobNodes
	};
}

// A leaf under a job showing one of its `needs` (the DAG edge) and that job's status.
function createDepNode(parentJobId: number, dep: JobDep): any {
	const emoji = STATUS_EMOJI[dep.status] || '❔';
	return {
		id: `dep:${parentJobId}:${dep.name}`,
		isDepNode: true,
		label: `↳ ${emoji} ${dep.name}`,
		collapsibleState: TreeItemCollapsibleState.None,
		tooltip: `needs: ${dep.name} — ${dep.status}`
	};
}

// A job under its stage. If it has `needs`, it is collapsible and reveals them.
function createJobNode(job: any, config: RepoConfig, pipelineId: number, deps: JobDep[]): any {
	const emoji = STATUS_EMOJI[job.status] || '⌛';
	const depNodes = deps.map((d) => createDepNode(job.id, d));
	return {
		id: `job:${pipelineId}:${job.id}`,
		isJobNode: true,
		label: `${emoji}  ${job.name || job.id}`,
		collapsibleState: depNodes.length ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None,
		tooltip: job.web_url,
		contextValue: 'jobItem',
		jobId: job.id,
		jobName: job.name,
		jobStatus: job.status,
		project: config.project,
		webUrl: job.web_url,
		children: depNodes,
		command: { title: 'Open job in GitLab', command: 'pipeline.click', arguments: [job.web_url] }
	};
}

// Build a pipeline's stage → job → dependency subtree. REST supplies the jobs (and
// their stages); GraphQL supplies the `needs` DAG — best-effort, so a token without
// GraphQL scope (or an old GitLab) simply yields jobs with no dependency edges.
async function buildStageTree(config: RepoConfig, pipelineId: number, iid: any): Promise<any[]> {
	let jobs: any[];
	try {
		jobs = await getPipelineJobs(config, pipelineId);
	} catch (e) {
		jobs = [];
	}
	let needs = new Map<string, string[]>();
	if (iid != null) {
		try {
			needs = await getJobNeeds(config, iid);
		} catch (e) {
			needs = new Map();
		}
	}
	const depsByName = resolveNeeds(jobs, needs);
	return groupJobsByStage(jobs).map((g) => {
		const jobNodes = g.jobs.map((j) =>
			createJobNode(j, config, pipelineId, depsByName.get((j?.name || '').trim()) || [])
		);
		return createStageNode(pipelineId, g.stage, jobNodes, g.jobs);
	});
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
		// Stage and job nodes carry their own subtree, built once when the pipeline
		// was expanded — no extra fetch, just hand back the cached children.
		if (element.isStageNode || element.isJobNode) {
			return element.children || [];
		}
		if (element.isDepNode) {
			return [];
		}
		if (element.isPipelineNode) {
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
				return cached.stages;
			}
			const stages = await buildStageTree(config, id, element.iid);
			jobsCache.set(id, { stages, ts: Date.now() });
			return stages;
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

// Invalidate a pipeline's cached job list when its status changes.
function trackStatus(pipeline: any): void {
	const id = pipeline.id;
	const prev = lastStatusById.get(id);
	lastStatusById.set(id, pipeline.status);
	if (prev && prev !== pipeline.status) {
		jobsCache.delete(id); // status changed → job list is stale
	}
}

// A self-dismissing failure toast: a notification that needs no click and slides
// away on its own after FAILURE_TOAST_MS. VS Code keeps a message with buttons (or an
// Error message) on screen until dismissed, so we use a progress notification whose
// task simply resolves after the delay — that auto-closes with no action to click.
function showTransientFailure(message: string): void {
	window.withProgress(
		{ location: ProgressLocation.Notification, title: message, cancellable: false },
		() => new Promise<void>((resolve) => setTimeout(resolve, FAILURE_TOAST_MS))
	);
}

/**
 * Notify about failed pipelines. A failure is reported only when it is the LATEST
 * pipeline for its branch (a newer success/running run suppresses it, and older
 * superseded failures are never reported), and only once per `project|ref` failure.
 * This runs on every poll INCLUDING the first, so a branch whose latest pipeline is
 * already red is announced at startup — just not the older, already-superseded ones.
 */
function notifyFailures(config: RepoConfig, pipelines: any[]): void {
	const latest = latestFailedByRef(pipelines);
	for (const { ref, id, key } of pendingFailureNotifications(latest, config.project, notifiedFailureByRef)) {
		notifiedFailureByRef.set(key, id);
		if (config.notifyOnFailed === false) {
			continue;
		}
		showTransientFailure(formatFailureMessage(config.project, ref, id));
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
	const sigParts: string[] = [];
	for (const config of configs) {
		configByProject.set(config.project, config);
		let pipelines: any[] | null;
		try {
			pipelines = await getRunningPipelines(config);
		} catch (e) {
			pipelines = null; // request failed — do NOT treat it as "no pipelines"
		}
		if (pipelines === null) {
			// A failed/incomplete fetch must not wipe this repo's view or notification
			// state (otherwise every recovery re-notifies old failures). Keep the
			// previous items and their ids, skip notifications, and leave the tree as-is.
			const prevItems = pipelinesByRepo.get(config.project) || [];
			for (const it of prevItems) {
				currentIds.add(it.pipelineId);
				pipelineConfigById.set(it.pipelineId, config);
			}
			newByRepo.set(config.project, prevItems);
			newRepoNodes.push(createRepoNode(config, prevItems.length));
			sigParts.push(
				`${config.project}@${config.currentBranch}#${pipelinesSignature(
					prevItems.map((it: any) => ({ id: it.pipelineId, status: it.pipelineStatus, ref: it.ref }))
				)}`
			);
			continue;
		}
		const items = pipelines.map((p: any) => {
			currentIds.add(p.id);
			pipelineConfigById.set(p.id, config);
			trackStatus(p);
			return createPipelineNode(p, config);
		});
		notifyFailures(config, pipelines);
		newByRepo.set(config.project, items);
		newRepoNodes.push(createRepoNode(config, items.length));
		sigParts.push(`${config.project}@${config.currentBranch}#${pipelinesSignature(pipelines)}`);
	}
	repoNodes = newRepoNodes;
	pipelinesByRepo = newByRepo;
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
	// forget notified failures whose pipeline is no longer in the list
	for (const [key, id] of notifiedFailureByRef) {
		if (!currentIds.has(id)) {
			notifiedFailureByRef.delete(key);
		}
	}
	updateStatusBar();
	// only re-render when the pipeline data actually changed — otherwise the tree
	// (and any expanded, cached jobs) stays put instead of flickering every poll.
	const signature = sigParts.join('|');
	if (lastSignature !== signature) {
		lastSignature = signature;
		provider.refresh();
	}
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

// Rebuild the repo nodes so their collapsibleState reflects the current
// expandedRepos. VS Code applies collapsibleState on refresh, so this collapses
// (or keeps expanded) repos in place across both panels — used for the accordion.
function rebuildRepoNodes(): void {
	repoNodes = Array.from(configByProject.values()).map((config) =>
		createRepoNode(config, (pipelinesByRepo.get(config.project) || []).length)
	);
}

export function revealRepoInView(view: TreeView<TreeItem>, project: string): void {
	if (!expansionChanges(expandedRepos, project, true)) {
		return; // already expanded — let a native click collapse it
	}
	doReveal(view, project);
}

// Expand the repo at `fsPath` (e.g. a git root) in the given view, and collapse
// every other repo — an accordion, so only the current project stays open. Used
// when a repository is selected in the built-in Source Control view.
export function revealRepoByPath(provider: TreeViewProvider, view: TreeView<TreeItem>, fsPath: string): void {
	const project = repoProjectForPath(repoNodes, fsPath);
	if (!project) {
		return;
	}
	expandedRepos.clear(); // accordion: keep only the selected repo expanded
	expandedRepos.add(project);
	rebuildRepoNodes(); // collapse the others in place…
	provider.refresh();
	doReveal(view, project); // …and scroll to + expand the current one
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
