import { ParsedDependency, Technology } from '../models/types';

/**
 * Maps dependency names to framework display names.
 * Organized by ecosystem but stored in a single flat map since
 * dependency names are unique across ecosystems.
 */
const DEPENDENCY_TO_FRAMEWORK: Record<string, string> = {
  // npm
  'react': 'React',
  '@angular/core': 'Angular',
  'vue': 'Vue.js',
  'next': 'Next.js',
  'express': 'Express',
  '@nestjs/core': 'NestJS',
  'nestjs': 'NestJS',
  'svelte': 'Svelte',

  // pip
  'django': 'Django',
  'flask': 'Flask',
  'fastapi': 'FastAPI',
  'tornado': 'Tornado',
  'pyramid': 'Pyramid',

  // maven (groupId:artifactId format)
  'org.springframework:spring-core': 'Spring Boot',
  'org.springframework.boot:spring-boot': 'Spring Boot',
  'io.quarkus:quarkus-core': 'Quarkus',

  // cargo
  'actix-web': 'Actix Web',
  'rocket': 'Rocket',
  'axum': 'Axum',

  // rubygems
  'rails': 'Ruby on Rails',
  'sinatra': 'Sinatra',
};

/**
 * Go module path fragments that indicate a framework.
 * Go dependencies use full module paths (e.g., github.com/gin-gonic/gin),
 * so we match by checking if the dependency name contains the fragment.
 */
const GO_MODULE_FRAMEWORKS: Array<{ fragment: string; framework: string }> = [
  { fragment: 'gin-gonic/gin', framework: 'Gin' },
  { fragment: 'gorilla/mux', framework: 'Gorilla Mux' },
  { fragment: 'labstack/echo', framework: 'Echo' },
];

/**
 * Detects frameworks from parsed dependencies by matching known dependency
 * names to framework names. Extracts version information where available.
 *
 * @param dependencies - Parsed dependencies from manifest files
 * @returns Technology objects with type 'framework'
 */
export function detectFrameworks(dependencies: ParsedDependency[]): Technology[] {
  const seen = new Map<string, Technology>();

  for (const dep of dependencies) {
    // Direct name match (npm, pip, maven, cargo, rubygems)
    const directMatch = DEPENDENCY_TO_FRAMEWORK[dep.name];
    if (directMatch) {
      addFramework(seen, directMatch, dep.versionConstraint);
      continue;
    }

    // Go module path matching (contains fragment)
    for (const { fragment, framework } of GO_MODULE_FRAMEWORKS) {
      if (dep.name.includes(fragment)) {
        addFramework(seen, framework, dep.versionConstraint);
        break;
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Adds a framework to the seen map, preferring entries that have version info.
 */
function addFramework(
  seen: Map<string, Technology>,
  name: string,
  versionConstraint?: string,
): void {
  const existing = seen.get(name);
  if (existing) {
    // Keep the entry that has version info
    if (!existing.version && versionConstraint) {
      existing.version = versionConstraint;
    }
    return;
  }

  const tech: Technology = { name, type: 'framework' };
  if (versionConstraint) {
    tech.version = versionConstraint;
  }
  seen.set(name, tech);
}
