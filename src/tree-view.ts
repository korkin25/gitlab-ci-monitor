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
	ThemeIcon,
	StatusBarAlignment,
	StatusBarItem,
	TreeView
} from 'vscode';
import { RepoConfig, getAllConfigs, getRunningPipelines, getPipelineJobs, getJobNeeds } from './pipelines';
import { groupJobsByStage, resolveNeeds, aggregateStageStatus, JobDep } from './job-order';
import { formatDuration, jobDurationSeconds, pipelineDurationSeconds } from './duration';
import { shouldFlash } from './flash';
import { repoProjectForPath, expansionChanges } from './expansion';
import { latestFailedByRef, pendingFailureNotifications, formatFailureMessage } from './notify';
import { pipelinesSignature } from './signature';

// ` · 1m 23s` suffix for a node label, or '' when the duration is unknown.
const durationSuffix = (seconds: number | null): string => {
	const d = seconds == null ? '' : formatDuration(seconds);
	return d ? ` · ${d}` : '';
};

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
// When a pipeline's jobs fail to load, we keep re-fetching them in the BACKGROUND —
// regardless of whether the node is still expanded — so the data the user tried to
// open finishes loading and is ready in the cache when they come back. The queue holds
// every pipeline whose fetch failed (and hasn't succeeded yet); a single timer drains
// it, re-rendering once when any recover.
const JOBS_RETRY_MS = 3000;
const jobRetryQueue: Map<number, { config: RepoConfig; iid: any }> = new Map();
let jobRetryTimer: ReturnType<typeof setTimeout> | null = null;

function ensureJobRetryLoop(provider: TreeViewProvider): void {
	if (jobRetryTimer || jobRetryQueue.size === 0) {
		return;
	}
	jobRetryTimer = setTimeout(() => runJobRetryRound(provider), JOBS_RETRY_MS);
}

async function runJobRetryRound(provider: TreeViewProvider): Promise<void> {
	jobRetryTimer = null;
	let recovered = false;
	for (const [id, info] of Array.from(jobRetryQueue)) {
		if (!pipelineConfigById.has(id)) {
			jobRetryQueue.delete(id); // pipeline dropped out of the list — stop chasing it
			continue;
		}
		try {
			const stages = await buildStageTree(info.config, id, info.iid);
			jobsCache.set(id, { stages, ts: Date.now() });
			jobRetryQueue.delete(id);
			recovered = true;
		} catch (e) {
			/* still failing — keep it queued for the next round */
		}
	}
	if (recovered) {
		provider.refresh(); // now-cached jobs appear on the next render (if expanded)
	}
	ensureJobRetryLoop(provider); // reschedule while anything remains
}
// How long the transient failure toast stays before it dismisses itself (no click).
const FAILURE_TOAST_MS = 2500;
// signature of the last rendered pipeline data — the tree is only refreshed when
// this changes, so nothing re-renders (and expanded jobs stay cached) while the
// pipelines are unchanged.
let lastSignature: string | null = null;
// bumped each poll while any pipeline is running, so live durations tick in the label
let runningTick = 0;
// true when the last poll saw a running/pending pipeline — drives the adaptive interval
let anyRunningNow = false;
export const hasRunningPipelines = (): boolean => anyRunningNow;
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

// Drop a pipeline's cached job subtree so the next render re-fetches it — called after
// a job action (retry/cancel/play) so the change shows without waiting for a poll.
export const invalidatePipelineJobs = (pipelineId: any): void => {
	jobsCache.delete(Number(pipelineId));
};

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
// Brighter icons shown for a fraction of a second the instant a node finishes/breaks,
// then it reverts to the normal STATUS_EMOJI. Purely a "something just happened" cue.
const FLASH_EMOJI: { [k: string]: string } = {
	success: '✨',
	failed: '💥',
	canceled: '⚪',
	skipped: '🔵'
};
const FLASH_MS = 330;
// key (`pipe:<id>` / `job:<id>`) → timestamp the flash ends; and the live node object so
// we can revert its label in place when the flash expires (no re-fetch needed).
const flashUntil: Map<string, number> = new Map();
const flashNodes: Map<string, any> = new Map();
const lastJobStatus: Map<number, string> = new Map();
let flashTimer: ReturnType<typeof setTimeout> | null = null;
let providerRef: TreeViewProvider | null = null;

// Build a node label whose status emoji flashes bright while `flashUntil[key]` is live,
// then reverts. The node keeps its normal label so the flash-clear timer can restore it.
function flashableLabel(key: string, status: string, rest: string, node: any): string {
	const normal = `${STATUS_EMOJI[status] || '⌛'}  ${rest}`;
	node._normalLabel = normal;
	const until = flashUntil.get(key);
	if (until && Date.now() < until) {
		flashNodes.set(key, node);
		return `${FLASH_EMOJI[status] || STATUS_EMOJI[status] || '⌛'}  ${rest}`;
	}
	return normal;
}

// Start a flash for a node key (called when a status change is detected during a build).
function startFlash(key: string): void {
	flashUntil.set(key, Date.now() + FLASH_MS);
	ensureFlashClear();
}

// One timer reverts every expired flash: restore each node's normal label in place and
// re-render, then reschedule while any flash remains.
function ensureFlashClear(): void {
	if (flashTimer || flashUntil.size === 0) {
		return;
	}
	flashTimer = setTimeout(() => {
		flashTimer = null;
		const now = Date.now();
		let changed = false;
		for (const [key, until] of Array.from(flashUntil)) {
			if (now >= until) {
				const node = flashNodes.get(key);
				if (node) {
					node.label = node._normalLabel;
				}
				flashNodes.delete(key);
				flashUntil.delete(key);
				changed = true;
			}
		}
		if (changed && providerRef) {
			providerRef.refresh();
		}
		ensureFlashClear();
	}, FLASH_MS + 30);
}

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
	const status = pipeline.status;
	// Running/pending → can be stopped; anything finished → can be re-run fresh.
	const running = status === 'running' || status === 'pending' || status === 'created';
	// The status emoji already conveys success/failed/running — no need to spell it out.
	const rest = `${pipeline.id} · ${pipeline.ref}${durationSuffix(pipelineDurationSeconds(pipeline, Date.now()))}`;
	const node: any = {
		id: `pipe:${pipeline.id}`,
		isPipelineNode: true,
		label: '',
		collapsibleState: TreeItemCollapsibleState.Collapsed,
		tooltip: pipeline.web_url,
		contextValue: running ? 'pipelineItemRunning' : 'pipelineItemDone',
		pipelineId: pipeline.id,
		iid: pipeline.iid,
		pipelineStatus: pipeline.status,
		ref: pipeline.ref,
		sha: pipeline.sha,
		project: config.project,
		webUrl: pipeline.web_url,
		command: { title: 'Open in GitLab', command: 'pipeline.click', arguments: [pipeline.web_url] }
	};
	node.label = flashableLabel(`pipe:${pipeline.id}`, status, rest, node);
	return node;
}

// The context value drives which right-click actions a job offers (see package.json
// `view/item/context`): a running/pending job can be canceled, a manual one played,
// a finished one retried. All start with `jobItem` so "open in GitLab" applies to any.
function jobContextValue(status: string): string {
	if (status === 'running' || status === 'pending' || status === 'created') {
		return 'jobItemRunning';
	}
	if (status === 'manual') {
		return 'jobItemManual';
	}
	return 'jobItemRetryable';
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

// Shown under a pipeline while its jobs are still being fetched (or a fetch failed and
// we are retrying) — a spinning "loading" placeholder instead of a misleading empty node.
function createLoadingNode(pipelineId: number): any {
	return {
		id: `loading:${pipelineId}`,
		isLoadingNode: true,
		label: 'loading jobs…',
		iconPath: new ThemeIcon('sync~spin'),
		collapsibleState: TreeItemCollapsibleState.None,
		contextValue: 'loadingItem'
	};
}

// A leaf under a job showing one of its `needs` (a DAG dependency, NOT a job in this
// stage). The explicit "needs" wording avoids reading it as "this job is inside here".
function createDepNode(parentJobId: number, dep: JobDep): any {
	const emoji = STATUS_EMOJI[dep.status] || '❔';
	return {
		id: `dep:${parentJobId}:${dep.name}`,
		isDepNode: true,
		label: `↳ needs ${emoji} ${dep.name}`,
		collapsibleState: TreeItemCollapsibleState.None,
		tooltip: `needs ${dep.name} (${dep.status}) — a dependency this job waits for`
	};
}

// A job under its stage. If it has `needs`, it is collapsible and reveals them.
// Clicking a job streams its log live; right-click opens it in GitLab + offers actions.
function createJobNode(job: any, config: RepoConfig, pipelineId: number, deps: JobDep[]): any {
	const depNodes = deps.map((d) => createDepNode(job.id, d));
	const rest = `${job.name || job.id}${durationSuffix(jobDurationSeconds(job, Date.now()))}`;
	const node: any = {
		id: `job:${pipelineId}:${job.id}`,
		isJobNode: true,
		label: '',
		collapsibleState: depNodes.length ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None,
		tooltip: job.web_url,
		contextValue: jobContextValue(job.status),
		jobId: job.id,
		jobName: job.name,
		jobStatus: job.status,
		pipelineId,
		project: config.project,
		webUrl: job.web_url,
		children: depNodes
	};
	node.label = flashableLabel(`job:${job.id}`, job.status, rest, node);
	// Left-click → stream the live log (the node carries the fields the command needs).
	node.command = { title: 'Stream job log', command: 'pipeline.job.log', arguments: [node] };
	return node;
}

// Build a pipeline's stage → job → dependency subtree. REST supplies the jobs (and
// their stages); GraphQL supplies the `needs` DAG — best-effort, so a token without
// GraphQL scope (or an old GitLab) simply yields jobs with no dependency edges.
async function buildStageTree(config: RepoConfig, pipelineId: number, iid: any): Promise<any[]> {
	// Let a jobs-fetch failure PROPAGATE — getChildren must be able to tell "no jobs"
	// from "fetch failed" so it does not cache an empty subtree on a transient timeout.
	const jobs = await getPipelineJobs(config, pipelineId);
	let needs = new Map<string, string[]>();
	if (iid != null) {
		try {
			needs = await getJobNeeds(config, iid);
		} catch (e) {
			needs = new Map();
		}
	}
	// Flash a job's icon the moment it finishes/breaks (detected against the last status
	// we rendered for it). Done before building the nodes, so createJobNode picks it up.
	for (const j of jobs) {
		const jid = j?.id;
		if (jid == null) {
			continue;
		}
		const prev = lastJobStatus.get(jid);
		lastJobStatus.set(jid, j?.status);
		if (shouldFlash(prev, j?.status)) {
			startFlash(`job:${jid}`);
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
			try {
				const stages = await buildStageTree(config, id, element.iid);
				jobsCache.set(id, { stages, ts: Date.now() });
				return stages;
			} catch (e) {
				// A failed/timed-out fetch must NOT be cached as "no jobs" — otherwise the
				// pipeline stays expanded-but-empty. Queue a BACKGROUND re-fetch that keeps
				// trying until it succeeds (ready in the cache even if the user navigates
				// away), and meanwhile show the stale subtree if we have one, else a
				// spinning "loading jobs…" placeholder — never a misleading empty node.
				jobRetryQueue.set(id, { config, iid: element.iid });
				ensureJobRetryLoop(this);
				return cached ? cached.stages : [createLoadingNode(id)];
			}
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
	if (shouldFlash(prev, pipeline.status)) {
		startFlash(`pipe:${id}`); // it just finished/broke → flash its icon briefly
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
	providerRef = provider; // used by the flash-clear timer to re-render
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
	// Only re-render when the pipeline data actually changed — otherwise the tree stays
	// put instead of flickering every poll. EXCEPTION: while something is running, add a
	// per-poll tick so the live durations advance (and running jobs refresh); when the
	// workspace is idle the signature is stable again, so nothing re-renders needlessly.
	let anyRunning = false;
	for (const items of newByRepo.values()) {
		for (const it of items) {
			const s = it.pipelineStatus;
			if (s === 'running' || s === 'pending' || s === 'created') {
				anyRunning = true;
				break;
			}
		}
		if (anyRunning) {
			break;
		}
	}
	anyRunningNow = anyRunning; // drives the adaptive poll interval (poll faster while running)
	if (anyRunning) {
		runningTick++;
	}
	const signature = sigParts.join('|') + (anyRunning ? `~${runningTick}` : '');
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
