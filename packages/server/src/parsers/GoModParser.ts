import { ManifestParser, ManifestParseResult, ParsedDependency, ParseError } from '../models';

export class GoModParser implements ManifestParser {
  readonly filenames = ['go.mod'];

  parse(content: string): ManifestParseResult {
    const dependencies: ParsedDependency[] = [];
    const errors: ParseError[] = [];
    const lines = content.split('\n');

    let inRequireBlock = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (line === '' || line.startsWith('//')) {
        continue;
      }

      // Detect start of require block
      if (line.startsWith('require') && line.includes('(')) {
        inRequireBlock = true;
        continue;
      }

      // Detect end of require block
      if (inRequireBlock && line === ')') {
        inRequireBlock = false;
        continue;
      }

      // Parse entries inside a require block
      if (inRequireBlock) {
        try {
          const dep = this.parseRequireLine(line);
          if (dep) {
            dependencies.push(dep);
          }
        } catch {
          errors.push({ entry: line, message: `Malformed require entry: "${line}"` });
        }
        continue;
      }

      // Parse single-line require directive
      if (line.startsWith('require ') && !line.includes('(')) {
        const rest = line.slice('require '.length).trim();
        try {
          const dep = this.parseRequireLine(rest);
          if (dep) {
            dependencies.push(dep);
          }
        } catch {
          errors.push({ entry: rest, message: `Malformed require entry: "${rest}"` });
        }
        continue;
      }

      // Skip module, go, replace, exclude, retract directives
    }

    return { ecosystem: 'go', dependencies, errors };
  }

  private parseRequireLine(line: string): ParsedDependency | null {
    // Strip inline comments (// indirect or other comments)
    const commentIndex = line.indexOf('//');
    const effective = commentIndex >= 0 ? line.slice(0, commentIndex).trim() : line.trim();

    if (effective === '') {
      return null;
    }

    const parts = effective.split(/\s+/);
    if (parts.length < 2) {
      throw new Error('Missing version');
    }

    const name = parts[0];
    const version = parts[1];

    if (!name || !this.isValidModulePath(name)) {
      throw new Error('Invalid module path');
    }

    if (!version || !version.startsWith('v')) {
      throw new Error('Invalid version');
    }

    return { name, versionConstraint: version, dependencyType: 'production' };
  }

  private isValidModulePath(path: string): boolean {
    // Go module paths must contain a dot in the first path element
    return /^[a-zA-Z0-9]/.test(path) && path.includes('.');
  }
}
