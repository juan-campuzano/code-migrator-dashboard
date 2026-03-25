import { ManifestParser, ManifestParseResult, ParsedDependency, ParseError } from '../models';

/**
 * Regex-based parser for Ruby Gemfile files.
 * Extracts gem declarations with version constraints and classifies
 * dependencies as production or development based on group blocks.
 */
export class GemfileParser implements ManifestParser {
  readonly filenames = ['Gemfile'];

  /**
   * Matches a gem declaration:
   *   gem 'name'
   *   gem 'name', '~> 1.0'
   *   gem "name", ">= 2.0", "< 3.0"
   * Captures: (name) and optional rest of the line for version parsing
   */
  private static readonly GEM_REGEX =
    /^\s*gem\s+['"]([^'"]+)['"](.*)?$/;

  /**
   * Matches version constraint strings in single or double quotes.
   */
  private static readonly VERSION_REGEX = /['"]([~><=!]+\s*[\d][^'"]*)['"]/g;

  /**
   * Matches the opening of a group block:
   *   group :development do
   *   group :development, :test do
   *   group :test do
   */
  private static readonly GROUP_START_REGEX =
    /^\s*group\s+((?::\w+\s*,?\s*)+)\s+do\s*$/;

  private static readonly DEV_GROUPS = ['development', 'test'];

  parse(content: string): ManifestParseResult {
    const dependencies: ParsedDependency[] = [];
    const errors: ParseError[] = [];
    const lines = content.split('\n');

    let insideDevGroup = false;
    let groupDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip blank lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Check for group block start
      const groupMatch = GemfileParser.GROUP_START_REGEX.exec(trimmed);
      if (groupMatch) {
        groupDepth++;
        const groupNames = groupMatch[1]
          .split(',')
          .map((g) => g.trim().replace(/^:/, ''));
        const isDev = groupNames.some((g) => GemfileParser.DEV_GROUPS.includes(g));
        if (isDev) {
          insideDevGroup = true;
        }
        continue;
      }

      // Check for end of block
      if (trimmed === 'end' && groupDepth > 0) {
        groupDepth--;
        if (groupDepth === 0) {
          insideDevGroup = false;
        }
        continue;
      }

      // Try to match a gem declaration
      const gemMatch = GemfileParser.GEM_REGEX.exec(trimmed);
      if (gemMatch) {
        const name = gemMatch[1];
        const rest = gemMatch[2] || '';

        try {
          const versionConstraint = this.extractVersionConstraint(rest);
          dependencies.push({
            name,
            versionConstraint: versionConstraint || undefined,
            dependencyType: insideDevGroup ? 'development' : 'production',
          });
        } catch {
          errors.push({
            entry: name,
            message: 'Failed to parse version constraint',
          });
        }
      }
    }

    return { ecosystem: 'rubygems', dependencies, errors };
  }

  /**
   * Extracts version constraints from the remainder of a gem line.
   * Handles multiple constraints: gem 'rails', '>= 5.0', '< 7.0' → '>= 5.0, < 7.0'
   */
  private extractVersionConstraint(rest: string): string | null {
    const versions: string[] = [];
    const regex = new RegExp(GemfileParser.VERSION_REGEX.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(rest)) !== null) {
      versions.push(match[1]);
    }

    return versions.length > 0 ? versions.join(', ') : null;
  }
}
