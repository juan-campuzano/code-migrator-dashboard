import { ManifestParser, ManifestParseResult, ParsedDependency, ParseError } from '../models';

export class PackageJsonParser implements ManifestParser {
  readonly filenames = ['package.json'];

  parse(content: string): ManifestParseResult {
    const dependencies: ParsedDependency[] = [];
    const errors: ParseError[] = [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      errors.push({ entry: 'package.json', message: 'Invalid JSON' });
      return { ecosystem: 'npm', dependencies, errors };
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      errors.push({ entry: 'package.json', message: 'Expected a JSON object' });
      return { ecosystem: 'npm', dependencies, errors };
    }

    const pkg = parsed as Record<string, unknown>;

    this.extractDeps(pkg['dependencies'], 'production', dependencies, errors);
    this.extractDeps(pkg['devDependencies'], 'development', dependencies, errors);

    return { ecosystem: 'npm', dependencies, errors };
  }

  private extractDeps(
    section: unknown,
    type: 'production' | 'development',
    dependencies: ParsedDependency[],
    errors: ParseError[],
  ): void {
    if (section === undefined || section === null) {
      return;
    }

    if (typeof section !== 'object' || Array.isArray(section)) {
      errors.push({
        entry: type === 'production' ? 'dependencies' : 'devDependencies',
        message: `Expected an object for ${type === 'production' ? 'dependencies' : 'devDependencies'}`,
      });
      return;
    }

    const entries = section as Record<string, unknown>;

    for (const [name, version] of Object.entries(entries)) {
      if (typeof version !== 'string') {
        errors.push({
          entry: name,
          message: `Invalid version constraint for "${name}": expected a string, got ${typeof version}`,
        });
        continue;
      }

      dependencies.push({
        name,
        versionConstraint: version,
        dependencyType: type,
      });
    }
  }
}
