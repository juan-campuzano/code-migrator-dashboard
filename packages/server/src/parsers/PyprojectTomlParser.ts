import TOML from '@iarna/toml';
import { ManifestParser, ManifestParseResult, ParsedDependency, ParseError } from '../models';

const VERSION_OPERATORS = ['~=', '==', '!=', '>=', '<=', '>', '<'];
const DEV_GROUPS = ['dev', 'test', 'testing'];

export class PyprojectTomlParser implements ManifestParser {
  readonly filenames = ['pyproject.toml'];

  parse(content: string): ManifestParseResult {
    const dependencies: ParsedDependency[] = [];
    const errors: ParseError[] = [];

    let parsed: Record<string, unknown>;
    try {
      parsed = TOML.parse(content) as Record<string, unknown>;
    } catch {
      errors.push({ entry: 'pyproject.toml', message: 'Invalid TOML' });
      return { ecosystem: 'pip', dependencies, errors };
    }

    const project = parsed['project'] as Record<string, unknown> | undefined;
    if (!project || typeof project !== 'object') {
      return { ecosystem: 'pip', dependencies, errors };
    }

    // Extract [project.dependencies] as production
    const mainDeps = project['dependencies'];
    if (Array.isArray(mainDeps)) {
      for (const entry of mainDeps) {
        if (typeof entry !== 'string') {
          errors.push({ entry: String(entry), message: 'Expected a string dependency entry' });
          continue;
        }
        this.parsePep508(entry, 'production', dependencies, errors);
      }
    }

    // Extract [project.optional-dependencies]
    const optionalDeps = project['optional-dependencies'] as Record<string, unknown> | undefined;
    if (optionalDeps && typeof optionalDeps === 'object' && !Array.isArray(optionalDeps)) {
      for (const [group, entries] of Object.entries(optionalDeps)) {
        const depType = DEV_GROUPS.includes(group.toLowerCase()) ? 'development' : 'production';
        if (!Array.isArray(entries)) {
          errors.push({ entry: group, message: `Expected an array for optional-dependencies group "${group}"` });
          continue;
        }
        for (const entry of entries) {
          if (typeof entry !== 'string') {
            errors.push({ entry: String(entry), message: 'Expected a string dependency entry' });
            continue;
          }
          this.parsePep508(entry, depType, dependencies, errors);
        }
      }
    }

    return { ecosystem: 'pip', dependencies, errors };
  }

  private parsePep508(
    raw: string,
    depType: 'production' | 'development',
    dependencies: ParsedDependency[],
    errors: ParseError[],
  ): void {
    const trimmed = raw.trim();
    if (trimmed === '') {
      return;
    }

    // Strip environment markers (after ;)
    const markerIdx = trimmed.indexOf(';');
    const withoutMarker = markerIdx >= 0 ? trimmed.slice(0, markerIdx).trim() : trimmed;

    // Strip extras (e.g., package[extra])
    const extrasStart = withoutMarker.indexOf('[');
    const withoutExtras = extrasStart >= 0
      ? withoutMarker.slice(0, extrasStart) + withoutMarker.slice(withoutMarker.indexOf(']') + 1)
      : withoutMarker;

    // Find the first version operator
    let splitIndex = -1;
    let bestOp = '';
    for (const op of VERSION_OPERATORS) {
      const idx = withoutExtras.indexOf(op);
      if (idx >= 0 && (splitIndex < 0 || idx < splitIndex)) {
        splitIndex = idx;
        bestOp = op;
      }
    }

    if (splitIndex >= 0) {
      const name = withoutExtras.slice(0, splitIndex).trim();
      const versionConstraint = withoutExtras.slice(splitIndex).trim();

      if (!name || !this.isValidPackageName(name)) {
        errors.push({ entry: raw, message: `Invalid package name in "${raw}"` });
        return;
      }

      dependencies.push({ name, versionConstraint, dependencyType: depType });
    } else {
      const name = withoutExtras.trim();
      if (!name || !this.isValidPackageName(name)) {
        errors.push({ entry: raw, message: `Invalid package name in "${raw}"` });
        return;
      }

      dependencies.push({ name, dependencyType: depType });
    }
  }

  private isValidPackageName(name: string): boolean {
    return /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/.test(name);
  }
}
