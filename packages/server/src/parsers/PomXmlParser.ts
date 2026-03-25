import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { ManifestParser, ManifestParseResult, ParsedDependency, ParseError } from '../models';

export class PomXmlParser implements ManifestParser {
  readonly filenames = ['pom.xml'];

  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    isArray: (name) => name === 'dependency',
  });

  parse(content: string): ManifestParseResult {
    const dependencies: ParsedDependency[] = [];
    const errors: ParseError[] = [];

    const validation = XMLValidator.validate(content);
    if (validation !== true) {
      errors.push({ entry: 'pom.xml', message: 'Invalid XML' });
      return { ecosystem: 'maven', dependencies, errors };
    }

    let parsed: unknown;
    try {
      parsed = this.xmlParser.parse(content);
    } catch {
      errors.push({ entry: 'pom.xml', message: 'Invalid XML' });
      return { ecosystem: 'maven', dependencies, errors };
    }

    const project = (parsed as Record<string, unknown>)?.project;
    if (!project || typeof project !== 'object') {
      return { ecosystem: 'maven', dependencies, errors };
    }

    const depsSection = (project as Record<string, unknown>).dependencies;
    if (!depsSection || typeof depsSection !== 'object') {
      return { ecosystem: 'maven', dependencies, errors };
    }

    const depArray = (depsSection as Record<string, unknown>).dependency;
    if (!depArray) {
      return { ecosystem: 'maven', dependencies, errors };
    }

    const items = Array.isArray(depArray) ? depArray : [depArray];

    for (const dep of items) {
      if (!dep || typeof dep !== 'object') {
        errors.push({ entry: 'unknown', message: 'Invalid dependency entry' });
        continue;
      }

      const entry = dep as Record<string, unknown>;
      const groupId = entry.groupId;
      const artifactId = entry.artifactId;

      if (typeof groupId !== 'string' || !groupId.trim()) {
        const label = typeof artifactId === 'string' ? artifactId : 'unknown';
        errors.push({ entry: label, message: 'Missing or invalid groupId' });
        continue;
      }

      if (typeof artifactId !== 'string' || !artifactId.trim()) {
        errors.push({ entry: groupId, message: 'Missing or invalid artifactId' });
        continue;
      }

      const name = `${groupId}:${artifactId}`;
      const version = typeof entry.version === 'string' ? entry.version : undefined;
      const scope = typeof entry.scope === 'string' ? entry.scope.trim().toLowerCase() : undefined;
      const dependencyType: 'production' | 'development' = scope === 'test' ? 'development' : 'production';

      dependencies.push({
        name,
        versionConstraint: version,
        dependencyType,
      });
    }

    return { ecosystem: 'maven', dependencies, errors };
  }
}
