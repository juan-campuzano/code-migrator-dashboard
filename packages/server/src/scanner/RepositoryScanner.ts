import {
  FileContent,
  FileEntry,
  Technology,
  Dependency,
  ScanResult,
  ScanError,
  ManifestParser,
  ParsedDependency,
} from '../models/types';
import { detectLanguages } from './languageDetector';
import { detectFrameworks } from './frameworkDetector';
import {
  PackageJsonParser,
  RequirementsTxtParser,
  PyprojectTomlParser,
  PomXmlParser,
  BuildGradleParser,
  CargoTomlParser,
  GoModParser,
  GemfileParser,
} from '../parsers';

/**
 * Orchestrates language detection, framework detection, and manifest parsing
 * to produce a complete ScanResult for a repository.
 */
export class RepositoryScanner {
  private readonly parsers: ManifestParser[];

  constructor() {
    this.parsers = [
      new PackageJsonParser(),
      new RequirementsTxtParser(),
      new PyprojectTomlParser(),
      new PomXmlParser(),
      new BuildGradleParser(),
      new CargoTomlParser(),
      new GoModParser(),
      new GemfileParser(),
    ];
  }

  /**
   * Scans repository files and file tree to extract technologies, dependencies, and errors.
   *
   * 1. Detects languages from the file tree
   * 2. Matches files to manifest parsers by filename
   * 3. Parses each matching file, collecting errors without stopping
   * 4. Converts ParsedDependency to Dependency (adding ecosystem)
   * 5. Detects frameworks from all collected parsed dependencies
   * 6. Returns combined ScanResult
   */
  scan(files: FileContent[], fileTree: FileEntry[]): ScanResult {
    const errors: ScanError[] = [];

    // 1. Detect languages from file tree
    const languageTechnologies: Technology[] = detectLanguages(fileTree);

    // 2-4. Parse manifest files and collect dependencies
    const allParsedDeps: ParsedDependency[] = [];
    const allDependencies: Dependency[] = [];

    for (const file of files) {
      const filename = this.getFilename(file.path);
      const parser = this.findParser(filename);
      if (!parser) continue;

      try {
        const result = parser.parse(file.content);

        // Collect parsed dependencies for framework detection
        allParsedDeps.push(...result.dependencies);

        // Convert to Dependency with ecosystem
        for (const dep of result.dependencies) {
          allDependencies.push({
            name: dep.name,
            versionConstraint: dep.versionConstraint,
            ecosystem: result.ecosystem,
            dependencyType: dep.dependencyType,
          });
        }

        // Collect parse-level errors (malformed entries)
        for (const parseError of result.errors) {
          errors.push({
            file: file.path,
            message: parseError.message,
          });
        }
      } catch (err: unknown) {
        // File-level error: catch and continue with other files
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ file: file.path, message });
      }
    }

    // 5. Detect frameworks from all collected parsed dependencies
    const frameworkTechnologies: Technology[] = detectFrameworks(allParsedDeps);

    // 6. Combine and return
    return {
      technologies: [...languageTechnologies, ...frameworkTechnologies],
      dependencies: allDependencies,
      errors,
    };
  }

  /**
   * Extracts the filename from a file path.
   */
  private getFilename(filePath: string): string {
    const lastSlash = filePath.lastIndexOf('/');
    return lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
  }

  /**
   * Finds the first parser whose filenames list includes the given filename.
   */
  private findParser(filename: string): ManifestParser | undefined {
    return this.parsers.find((p) => p.filenames.includes(filename));
  }
}
