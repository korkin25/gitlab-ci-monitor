// Secure token storage. Depends only on a minimal SecretStorage-like interface
// (not on `vscode`), so it can be unit-tested with an in-memory fake.

export interface SecretStorageLike {
	get(key: string): PromiseLike<string | undefined>;
	store(key: string, value: string): PromiseLike<void>;
	delete(key: string): PromiseLike<void>;
}

/** Storage key for a domain's token in SecretStorage. */
export function secretKey(domain: string): string {
	return `gitlabCiMonitor.token.${domain}`;
}

/** Resolve a token from the available sources, most trusted first:
 *  SecretStorage → settings.json → the GITLAB_TOKEN env var. Empty strings
 *  count as absent. */
export function resolveToken(sources: {
	secret?: string | null;
	setting?: string | null;
	env?: string | null;
}): string | null {
	return sources.secret || sources.setting || sources.env || null;
}

/**
 * Wraps SecretStorage with a synchronous in-memory cache. The refresh loop and
 * tree provider resolve tokens synchronously, so secrets are read once (async)
 * into the cache via {@link load}/{@link set} and served from {@link cached}.
 */
export class TokenStore {
	private cache = new Map<string, string>();

	constructor(private readonly storage: SecretStorageLike) {}

	/** Warm the cache for the given domains from SecretStorage. */
	async load(domains: string[]): Promise<void> {
		for (const domain of domains) {
			const value = await this.storage.get(secretKey(domain));
			if (value) {
				this.cache.set(domain, value);
			} else {
				this.cache.delete(domain);
			}
		}
	}

	/** Read a cached secret. Returns null until {@link load}/{@link set} runs. */
	cached(domain: string): string | null {
		return this.cache.get(domain) || null;
	}

	/** Persist a token to SecretStorage and update the cache. */
	async set(domain: string, token: string): Promise<void> {
		await this.storage.store(secretKey(domain), token);
		this.cache.set(domain, token);
	}

	/** Remove a token from SecretStorage and the cache. */
	async clear(domain: string): Promise<void> {
		await this.storage.delete(secretKey(domain));
		this.cache.delete(domain);
	}
}
