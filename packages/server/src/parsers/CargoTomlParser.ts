import TOML from '@iarna/toml';
import { ManifestParser, ManifestParseResult, ParsedDependency, ParseError } from '../models';

export class CargoTomlParser implements ManifestParser {
  readonly filenames = ['Cargo.toml'];

  parse(content: string): ManifestParseResult {
    const dependencies: ParsedDependency[] = [];
    const errors: ParseError[] = [];

    let parsed: Record<string, unknown>;
    try {
      parsed = TOML.parse(content) as Record<string, unknown>;
    } catch {
      errors.push({ entry: 'Cargo.toml', message: 'Invalid TOML' });
      return { ecosystem: 'cargo', dependencies, errors };
    }

    this.extractSection(parsed['dependencies'], 'production', dependencies, errors);
    this.extractSection(parsed['dev-dependencies'], 'development', dependencies, errors);

    return { ecosystem: 'cargo', dependencies, errors };
  }

  private extractSection(
    section: unknown,
    depType: 'production' | 'development',
    dependencies: ParsedDependency[],
    errors: ParseError[],
  ): void {
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
      return;
    }

    for (const [name, value] of Object.entries(section as Record<string, unknown>)) {
      try {
        if (typeof value === 'string') {
          // Simple format: serde = "1.0"
          dependencies.push({ name, versionConstraint: value, dependencyType: depType });
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Table format: serde = { version = "1.0", features = ["derive"] }
          const table = value as Record<string, unknown>;
          const version = table['version'];
          if (typeof version === 'string') {
            dependencies.push({ name, versionConstraint: version, dependencyType: depType });
          } else {
            // Git/path deps without version
            dependencies.push({ name, dependencyType: depType });
          }
        } else {
          errors.push({ entry: name, message: `Unexpected dependency format for "${name}"` });
        }
      } catch {
        errors.push({ entry: name, message: `Failed to parse dependency "${name}"` });
      }
    }
  }
}
