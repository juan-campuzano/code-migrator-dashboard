import { ManifestParser, ManifestParseResult, ParsedDependency, ParseError } from '../models';

const PIP_OPTIONS = ['-r', '-c', '-e', '--'];
const VERSION_OPERATORS = ['~=', '==', '!=', '>=', '<=', '>', '<'];

export class RequirementsTxtParser implements ManifestParser {
  readonly filenames = ['requirements.txt'];

  parse(content: string): ManifestParseResult {
    const dependencies: ParsedDependency[] = [];
    const errors: ParseError[] = [];

    const lines = content.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (line === '' || line.startsWith('#')) {
        continue;
      }

      if (PIP_OPTIONS.some((opt) => line.startsWith(opt))) {
        continue;
      }

      try {
        const dep = this.parseLine(line);
        if (dep) {
          dependencies.push(dep);
        }
      } catch {
        errors.push({ entry: line, message: `Malformed requirement: "${line}"` });
      }
    }

    return { ecosystem: 'pip', dependencies, errors };
  }

  private parseLine(line: string): ParsedDependency | null {
    // Strip inline comments
    const commentIndex = line.indexOf('#');
    const effective = commentIndex >= 0 ? line.slice(0, commentIndex).trim() : line;

    if (effective === '') {
      return null;
    }

    // Strip environment markers (e.g., ; python_version >= "3.6")
    const markerIndex = effective.indexOf(';');
    const withoutMarker = markerIndex >= 0 ? effective.slice(0, markerIndex).trim() : effective;

    // Strip extras (e.g., requests[security])
    const extrasIndex = withoutMarker.indexOf('[');
    const withoutExtras = extrasIndex >= 0
      ? withoutMarker.slice(0, extrasIndex) + withoutMarker.slice(withoutMarker.indexOf(']') + 1)
      : withoutMarker;

    // Find the first version operator
    let splitIndex = -1;
    let operatorLen = 0;
    for (const op of VERSION_OPERATORS) {
      const idx = withoutExtras.indexOf(op);
      if (idx >= 0 && (splitIndex < 0 || idx < splitIndex)) {
        splitIndex = idx;
        operatorLen = op.length;
      }
    }

    if (splitIndex >= 0) {
      const name = withoutExtras.slice(0, splitIndex).trim();
      const versionConstraint = withoutExtras.slice(splitIndex).trim();

      if (!name || !this.isValidPackageName(name)) {
        throw new Error('Invalid package name');
      }

      return { name, versionConstraint, dependencyType: 'production' };
    }

    // No version specifier — just a package name
    const name = withoutExtras.trim();
    if (!name || !this.isValidPackageName(name)) {
      throw new Error('Invalid package name');
    }

    return { name, dependencyType: 'production' };
  }

  private isValidPackageName(name: string): boolean {
    // PEP 508: package names consist of letters, digits, hyphens, underscores, dots
    return /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/.test(name);
  }
}
