import { describe, it, expect } from 'vitest';
import { BuildGradleParser } from './BuildGradleParser';

describe('BuildGradleParser', () => {
  const parser = new BuildGradleParser();

  it('should have correct filenames and ecosystem', () => {
    expect(parser.filenames).toEqual(['build.gradle']);
    const result = parser.parse('');
    expect(result.ecosystem).toBe('maven');
  });

  it('should extract single-quoted string-notation dependencies', () => {
    const content = `
      dependencies {
        implementation 'org.springframework:spring-core:5.3.20'
        implementation 'com.google.guava:guava:31.1-jre'
      }
    `;
    const result = parser.parse(content);

    expect(result.dependencies).toEqual([
      { name: 'org.springframework:spring-core', versionConstraint: '5.3.20', dependencyType: 'production' },
      { name: 'com.google.guava:guava', versionConstraint: '31.1-jre', dependencyType: 'production' },
    ]);
    expect(result.errors).toHaveLength(0);
  });

  it('should extract double-quoted string-notation dependencies', () => {
    const content = `
      dependencies {
        implementation "org.springframework:spring-web:5.3.20"
      }
    `;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]).toEqual({
      name: 'org.springframework:spring-web',
      versionConstraint: '5.3.20',
      dependencyType: 'production',
    });
  });

  it('should classify testImplementation as development', () => {
    const content = `
      dependencies {
        testImplementation 'junit:junit:4.13.2'
      }
    `;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]).toEqual({
      name: 'junit:junit',
      versionConstraint: '4.13.2',
      dependencyType: 'development',
    });
  });

  it('should classify testCompile as development', () => {
    const content = `
      dependencies {
        testCompile 'org.mockito:mockito-core:4.6.1'
      }
    `;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].dependencyType).toBe('development');
  });

  it('should classify testRuntimeOnly as development', () => {
    const content = `
      dependencies {
        testRuntimeOnly 'org.junit.jupiter:junit-jupiter-engine:5.9.0'
      }
    `;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].dependencyType).toBe('development');
  });

  it('should classify compile, api, and runtimeOnly as production', () => {
    const content = `
      dependencies {
        compile 'com.example:lib-a:1.0'
        api 'com.example:lib-b:2.0'
        runtimeOnly 'com.example:lib-c:3.0'
      }
    `;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(3);
    expect(result.dependencies.every((d) => d.dependencyType === 'production')).toBe(true);
  });

  it('should handle dependencies without version', () => {
    const content = `
      dependencies {
        implementation 'org.example:managed-dep'
      }
    `;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]).toEqual({
      name: 'org.example:managed-dep',
      versionConstraint: undefined,
      dependencyType: 'production',
    });
  });

  it('should parse map-notation dependencies', () => {
    const content = `
      dependencies {
        implementation group: 'com.example', name: 'my-lib', version: '1.0.0'
      }
    `;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]).toEqual({
      name: 'com.example:my-lib',
      versionConstraint: '1.0.0',
      dependencyType: 'production',
    });
  });

  it('should parse map-notation without version', () => {
    const content = `
      dependencies {
        implementation group: 'com.example', name: 'no-version'
      }
    `;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]).toEqual({
      name: 'com.example:no-version',
      versionConstraint: undefined,
      dependencyType: 'production',
    });
  });

  it('should handle mixed production and development dependencies', () => {
    const content = `
      dependencies {
        implementation 'org.springframework:spring-web:5.3.20'
        testImplementation 'org.mockito:mockito-core:4.6.1'
        compile 'com.google.guava:guava:31.1-jre'
        testCompile 'junit:junit:4.13.2'
      }
    `;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(4);
    expect(result.dependencies[0].dependencyType).toBe('production');
    expect(result.dependencies[1].dependencyType).toBe('development');
    expect(result.dependencies[2].dependencyType).toBe('production');
    expect(result.dependencies[3].dependencyType).toBe('development');
  });

  it('should handle empty content', () => {
    const result = parser.parse('');

    expect(result.ecosystem).toBe('maven');
    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle content with no dependencies block', () => {
    const content = `
      plugins {
        id 'java'
      }
      repositories {
        mavenCentral()
      }
    `;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should report error for malformed string-notation coordinate', () => {
    const content = `
      dependencies {
        implementation 'invalid-no-colon'
        implementation 'org.valid:valid-dep:1.0'
      }
    `;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].name).toBe('org.valid:valid-dep');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].entry).toBe('invalid-no-colon');
    expect(result.errors[0].message).toContain('Invalid dependency coordinate');
  });

  it('should handle mixed string and map notation', () => {
    const content = `
      dependencies {
        implementation 'org.example:string-dep:1.0'
        implementation group: 'com.example', name: 'map-dep', version: '2.0'
      }
    `;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(2);
    const names = result.dependencies.map((d) => d.name);
    expect(names).toContain('org.example:string-dep');
    expect(names).toContain('com.example:map-dep');
  });

  it('should handle map-notation with double quotes', () => {
    const content = `
      dependencies {
        implementation group: "com.example", name: "double-quoted", version: "3.0"
      }
    `;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].name).toBe('com.example:double-quoted');
    expect(result.dependencies[0].versionConstraint).toBe('3.0');
  });
});
