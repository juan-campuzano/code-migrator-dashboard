// =============================================================================
// RegistryClient — fetches latest versions from package registries
// =============================================================================

import pLimit = require('p-limit');

// =============================================================================
// Interfaces
// =============================================================================

export interface RegistryClientOptions {
  concurrencyLimit: number;  // default: 5
  cacheTtlMs: number;        // default: 3600000 (1 hour)
  timeoutMs: number;         // default: 10000 (10 seconds)
}

export interface RegistryLookupResult {
  ecosystem: string;
  packageName: string;
  latestVersion: string | null;
  error?: string;
}

interface CacheEntry {
  result: RegistryLookupResult;
  expiresAt: number;
}

// =============================================================================
// Registry URL builders & response parsers
// =============================================================================

const REGISTRY_HANDLERS: Record<
  string,
  {
    buildUrl: (packageName: string) => string;
    extractVersion: (data: unknown) => string | null;
  }
> = {
  npm: {
    buildUrl: (pkg) => `https://registry.npmjs.org/${encodeURIComponent(pkg)}`,
    extractVersion: (data: unknown) => {
      const d = data as Record<string, unknown>;
      const distTags = d['dist-tags'] as Record<string, string> | undefined;
      return distTags?.latest ?? null;
    },
  },
  pypi: {
    buildUrl: (pkg) => `https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`,
    extractVersion: (data: unknown) => {
      const d = data as Record<string, unknown>;
      const info = d.info as Record<string, unknown> | undefined;
      return (info?.version as string) ?? null;
    },
  },
  cargo: {
    buildUrl: (pkg) => `https://crates.io/api/v1/crates/${encodeURIComponent(pkg)}`,
    extractVersion: (data: unknown) => {
      const d = data as Record<string, unknown>;
      const crate = d.crate as Record<string, unknown> | undefined;
      return (crate?.newest_version as string) ?? null;
    },
  },
  maven: {
    buildUrl: (pkg) => {
      // Maven packages use "group:artifact" format
      const parts = pkg.split(':');
      if (parts.length === 2) {
        const [group, artifact] = parts;
        return `https://search.maven.org/solrsearch/select?q=g:${encodeURIComponent(group)}+AND+a:${encodeURIComponent(artifact)}&rows=1&wt=json`;
      }
      // Fallback: treat entire name as artifact
      return `https://search.maven.org/solrsearch/select?q=a:${encodeURIComponent(pkg)}&rows=1&wt=json`;
    },
    extractVersion: (data: unknown) => {
      const d = data as Record<string, unknown>;
      const response = d.response as Record<string, unknown> | undefined;
      const docs = response?.docs as Array<Record<string, unknown>> | undefined;
      if (docs && docs.length > 0) {
        return (docs[0].latestVersion as string) ?? (docs[0].v as string) ?? null;
      }
      return null;
    },
  },
  rubygems: {
    buildUrl: (pkg) => `https://rubygems.org/api/v1/gems/${encodeURIComponent(pkg)}.json`,
    extractVersion: (data: unknown) => {
      const d = data as Record<string, unknown>;
      return (d.version as string) ?? null;
    },
  },
  go: {
    buildUrl: (pkg) => `https://proxy.golang.org/${pkg}/@latest`,
    extractVersion: (data: unknown) => {
      const d = data as Record<string, unknown>;
      const version = (d.Version as string) ?? null;
      // Strip leading 'v' prefix for consistency
      return version?.replace(/^v/, '') ?? null;
    },
  },
};

// =============================================================================
// RegistryClient class
// =============================================================================

export class RegistryClient {
  private readonly options: RegistryClientOptions;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly limiter: ReturnType<typeof pLimit>;

  constructor(options?: Partial<RegistryClientOptions>) {
    this.options = {
      concurrencyLimit: options?.concurrencyLimit ?? 5,
      cacheTtlMs: options?.cacheTtlMs ?? 3_600_000, // 1 hour
      timeoutMs: options?.timeoutMs ?? 10_000,       // 10 seconds
    };
    this.limiter = pLimit(this.options.concurrencyLimit);
  }

  /**
   * Fetch the latest version for a single dependency from its ecosystem registry.
   */
  async fetchLatest(ecosystem: string, packageName: string): Promise<RegistryLookupResult> {
    const cacheKey = `${ecosystem}::${packageName}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const eco = ecosystem.toLowerCase();
    const handler = REGISTRY_HANDLERS[eco];

    if (!handler) {
      const result: RegistryLookupResult = {
        ecosystem,
        packageName,
        latestVersion: null,
        error: `Unsupported ecosystem: "${ecosystem}"`,
      };
      return result;
    }

    const url = handler.buildUrl(packageName);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          // crates.io requires a User-Agent
          'User-Agent': 'repo-metadata-dashboard/1.0',
        },
      });

      clearTimeout(timeoutId);

      // 404 — package not found, no error
      if (response.status === 404) {
        const result: RegistryLookupResult = {
          ecosystem,
          packageName,
          latestVersion: null,
        };
        this.cacheResult(cacheKey, result);
        return result;
      }

      if (!response.ok) {
        const result: RegistryLookupResult = {
          ecosystem,
          packageName,
          latestVersion: null,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
        return result;
      }

      const data: unknown = await response.json();
      const latestVersion = handler.extractVersion(data);

      const result: RegistryLookupResult = {
        ecosystem,
        packageName,
        latestVersion,
      };

      this.cacheResult(cacheKey, result);
      return result;
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.name === 'AbortError'
            ? `Request timed out after ${this.options.timeoutMs}ms`
            : err.message
          : String(err);

      return {
        ecosystem,
        packageName,
        latestVersion: null,
        error: message,
      };
    }
  }

  /**
   * Fetch latest versions for multiple dependencies with concurrency limiting.
   */
  async fetchMany(
    deps: Array<{ ecosystem: string; name: string }>,
  ): Promise<RegistryLookupResult[]> {
    const tasks = deps.map((dep) =>
      this.limiter(() => this.fetchLatest(dep.ecosystem, dep.name)),
    );
    return Promise.all(tasks);
  }

  /**
   * Clear the in-memory cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private cacheResult(key: string, result: RegistryLookupResult): void {
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + this.options.cacheTtlMs,
    });
  }
}
