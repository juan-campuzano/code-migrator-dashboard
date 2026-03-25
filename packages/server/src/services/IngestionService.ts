import { RepositoryDb } from '../db/RepositoryDb';
import { RepositoryScanner } from '../scanner/RepositoryScanner';
import { detectLanguageStats } from '../scanner/languageDetector';
import { LocalFilesystemAdapter } from '../adapters/LocalFilesystemAdapter';
import { GitHubAdapter } from '../adapters/GitHubAdapter';
import { AzureDevOpsAdapter } from '../adapters/AzureDevOpsAdapter';
import { classifyUrl } from '../adapters/urlClassifier';
import type {
  SourceAdapter,
  RepositorySource,
  IngestionRequest,
  IngestionRecord,
  RepositoryLanguage,
  RepositoryFramework,
  RepositoryDependency,
} from '../models/types';
import type { FreshnessService } from './FreshnessService';

/**
 * Orchestrates the full ingestion pipeline:
 * Source Adapter → Scanner → Database
 */
export class IngestionService {
  private readonly db: RepositoryDb;
  private readonly scanner: RepositoryScanner;
  private readonly adapters: Record<RepositorySource['type'], SourceAdapter>;
  private readonly freshnessService?: FreshnessService;

  constructor(
    db: RepositoryDb,
    options?: {
      scanner?: RepositoryScanner;
      adapters?: Partial<Record<RepositorySource['type'], SourceAdapter>>;
      freshnessService?: FreshnessService;
    },
  ) {
    this.db = db;
    this.scanner = options?.scanner ?? new RepositoryScanner();
    this.adapters = {
      local: options?.adapters?.local ?? new LocalFilesystemAdapter(),
      github: options?.adapters?.github ?? new GitHubAdapter(),
      azure_devops: options?.adapters?.azure_devops ?? new AzureDevOpsAdapter(),
    };
    this.freshnessService = options?.freshnessService;
  }

  /**
   * Start an ingestion for the given source. Returns the ingestion ID.
   *
   * Flow:
   * 1. Validate access token for remote sources
   * 2. Derive repository name and source identifier
   * 3. Upsert repository in database
   * 4. Create ingestion record (status: in_progress)
   * 5. Resolve source adapter and fetch contents
   * 6. Run scanner on fetched contents
   * 7. Convert scan results and upsert metadata to database
   * 8. Update ingestion status to completed or failed
   */
  async startIngestion(request: IngestionRequest): Promise<string> {
    const { source } = request;

    // 1. Validate access token for remote sources
    this.validateAccessToken(source);

    // 2. Derive repository name and source identifier
    const { name, sourceIdentifier } = this.deriveRepoIdentity(source);

    // 3. Upsert repository
    const repository = await this.db.upsertRepository(name, source.type, sourceIdentifier);

    // 4. Create ingestion record
    const ingestion = await this.db.createIngestion(repository.id);

    try {
      // 5. Resolve adapter and fetch contents
      const adapter = this.adapters[source.type];
      const fetchResult = await adapter.fetch(source);

      // 6. Run scanner
      const scanResult = this.scanner.scan(fetchResult.files, fetchResult.fileTree);

      // 7. Convert and upsert all metadata
      const languages: RepositoryLanguage[] = detectLanguageStats(fetchResult.fileTree).map(
        (stat) => ({
          language: stat.name,
          fileCount: stat.fileCount,
          proportion: stat.proportion,
        }),
      );

      const frameworks: RepositoryFramework[] = scanResult.technologies
        .filter((t) => t.type === 'framework')
        .map((t) => ({
          name: t.name,
          version: t.version,
        }));

      const dependencies: RepositoryDependency[] = scanResult.dependencies.map((d) => ({
        ecosystem: d.ecosystem,
        name: d.name,
        versionConstraint: d.versionConstraint,
        dependencyType: d.dependencyType,
      }));

      await Promise.all([
        this.db.upsertLanguages(repository.id, languages),
        this.db.upsertFrameworks(repository.id, frameworks),
        this.db.upsertDependencies(repository.id, dependencies),
        this.db.upsertFileTree(repository.id, fetchResult.fileTree),
      ]);

      // 8. Mark completed
      await this.db.updateIngestionStatus(ingestion.id, 'completed', undefined, new Date());

      // 9. Trigger freshness scoring (fire-and-forget, errors must not fail ingestion)
      if (this.freshnessService) {
        try {
          await this.freshnessService.computeScores(repository.id, ingestion.id);
        } catch (scoringError: unknown) {
          const msg = scoringError instanceof Error ? scoringError.message : String(scoringError);
          console.error(`Freshness scoring failed for repository ${repository.id}: ${msg}`);
        }
      }

      return ingestion.id;
    } catch (error: unknown) {
      // 9. On failure, record error details
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.db.updateIngestionStatus(ingestion.id, 'failed', errorMessage, new Date());
      throw error;
    }
  }

  /**
   * Get the current status of an ingestion by ID.
   */
  async getIngestionStatus(ingestionId: string): Promise<IngestionRecord | null> {
    return this.db.getIngestion(ingestionId);
  }

  /**
   * Validates that remote sources have a non-empty access token.
   * Throws a descriptive error if the token is missing.
   */
  private validateAccessToken(source: RepositorySource): void {
    if (source.type === 'github' && !source.token?.trim()) {
      throw new Error(
        'Access token is required for GitHub repositories. Please configure a GitHub personal access token or OAuth token.',
      );
    }
    if (source.type === 'azure_devops' && !source.token?.trim()) {
      throw new Error(
        'Access token is required for Azure DevOps repositories. Please configure an Azure DevOps personal access token.',
      );
    }
  }

  /**
   * Derives a human-readable repository name and a normalized source identifier
   * from the given source.
   */
  private deriveRepoIdentity(source: RepositorySource): {
    name: string;
    sourceIdentifier: string;
  } {
    if (source.type === 'local') {
      // Use the last directory segment as the name
      const segments = source.path.replace(/[\\/]+$/, '').split(/[\\/]/);
      const name = segments[segments.length - 1] || source.path;
      return { name, sourceIdentifier: source.path };
    }

    // Remote sources: classify the URL to extract structured info
    const classification = classifyUrl(source.url);
    if (classification.type === 'github') {
      return {
        name: `${classification.owner}/${classification.repo}`,
        sourceIdentifier: source.url,
      };
    }

    // azure_devops
    return {
      name: `${(classification as { org: string; project: string; repo: string }).project}/${(classification as { org: string; project: string; repo: string }).repo}`,
      sourceIdentifier: source.url,
    };
  }
}
