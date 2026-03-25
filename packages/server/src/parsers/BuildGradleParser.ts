import { ManifestParser, ManifestParseResult, ParsedDependency, ParseError } from '../models';

/**
 * Regex-based parser for Gradle build.gradle files (Groovy DSL).
 * Extracts dependencies from common configuration blocks.
 */
export class BuildGradleParser implements ManifestParser {
  readonly filenames = ['build.gradle'];

  private static readonly PRODUCTION_CONFIGS = ['implementation', 'compile', 'api', 'runtimeOnly'];
  private static readonly DEVELOPMENT_CONFIGS = ['testImplementation', 'testCompile', 'testRuntimeOnly'];

  /**
   * Matches string-notation dependencies:
   *   implementation 'group:artifact:version'
   *   implementation "group:artifact:version"
   * Captures: (config) (group:artifact:version)
   */
  private static readonly STRING_NOTATION_REGEX =
    /\b(implementation|compile|api|runtimeOnly|testImplementation|testCompile|testRuntimeOnly)\s+['"]([^'"]+)['"]/g;

  /**
   * Matches map-notation dependencies:
   *   implementation group: 'com.example', name: 'lib', version: '1.0'
   * Captures: (config) then we parse the map entries separately
   */
  private static readonly MAP_NOTATION_REGEX =
    /\b(implementation|compile|api|runtimeOnly|testImplementation|testCompile|testRuntimeOnly)\s+(group\s*:\s*['"][^'"]*['"]\s*,\s*name\s*:\s*['"][^'"]*['"](?:\s*,\s*version\s*:\s*['"][^'"]*['"])?)/g;

  parse(content: string): ManifestParseResult {
    const dependencies: ParsedDependency[] = [];
    const errors: ParseError[] = [];

    // Track already-matched ranges to avoid double-counting map-notation deps
    // that also match the string-notation regex
    const mapMatchRanges: Array<{ start: number; end: number }> = [];

    // 1. Parse map-notation dependencies first
    this.parseMapNotation(content, dependencies, errors, mapMatchRanges);

    // 2. Parse string-notation dependencies, skipping ranges already matched by map notation
    this.parseStringNotation(content, dependencies, errors, mapMatchRanges);

    return { ecosystem: 'maven', dependencies, errors };
  }

  private parseMapNotation(
    content: string,
    dependencies: ParsedDependency[],
    errors: ParseError[],
    mapMatchRanges: Array<{ start: number; end: number }>,
  ): void {
    const regex = new RegExp(BuildGradleParser.MAP_NOTATION_REGEX.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const config = match[1];
      const mapStr = match[2];

      mapMatchRanges.push({ start: match.index, end: match.index + match[0].length });

      const group = this.extractMapValue(mapStr, 'group');
      const name = this.extractMapValue(mapStr, 'name');
      const version = this.extractMapValue(mapStr, 'version');

      if (!group || !name) {
        const label = group || name || mapStr.substring(0, 50);
        errors.push({ entry: label, message: 'Missing group or name in map-notation dependency' });
        continue;
      }

      dependencies.push({
        name: `${group}:${name}`,
        versionConstraint: version || undefined,
        dependencyType: this.classifyConfig(config),
      });
    }
  }

  private parseStringNotation(
    content: string,
    dependencies: ParsedDependency[],
    errors: ParseError[],
    mapMatchRanges: Array<{ start: number; end: number }>,
  ): void {
    const regex = new RegExp(BuildGradleParser.STRING_NOTATION_REGEX.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      // Skip if this range overlaps with a map-notation match
      const matchStart = match.index;
      const matchEnd = match.index + match[0].length;
      if (mapMatchRanges.some((r) => matchStart >= r.start && matchEnd <= r.end)) {
        continue;
      }

      const config = match[1];
      const coordinate = match[2].trim();

      const parts = coordinate.split(':');
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        errors.push({ entry: coordinate, message: 'Invalid dependency coordinate format' });
        continue;
      }

      const groupId = parts[0];
      const artifactId = parts[1];
      const version = parts.length >= 3 && parts[2] ? parts[2] : undefined;

      dependencies.push({
        name: `${groupId}:${artifactId}`,
        versionConstraint: version,
        dependencyType: this.classifyConfig(config),
      });
    }
  }

  private classifyConfig(config: string): 'production' | 'development' {
    if (BuildGradleParser.DEVELOPMENT_CONFIGS.includes(config)) {
      return 'development';
    }
    return 'production';
  }

  private extractMapValue(mapStr: string, key: string): string | null {
    const regex = new RegExp(`${key}\\s*:\\s*['"]([^'"]*)['"](\\s*,|\\s*$)`);
    const match = regex.exec(mapStr);
    return match ? match[1] : null;
  }
}
