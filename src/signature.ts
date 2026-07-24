// Pure change-detection signature for a project's pipelines, so the tree is only
// refreshed when something actually changed (id / status / ref), avoiding a
// whole-tree re-render — and re-fetch of expanded jobs — every poll.
import { PipelineLite } from './notify';

export function pipelinesSignature(pipelines: PipelineLite[]): string {
	return pipelines.map((p) => `${p.id}:${p.status}:${p.ref}`).join(',');
}
