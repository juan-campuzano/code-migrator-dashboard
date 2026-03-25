import { describe, it, expect } from 'vitest';
import { PomXmlParser } from './PomXmlParser';

describe('PomXmlParser', () => {
  const parser = new PomXmlParser();

  it('should have correct filenames and ecosystem', () => {
    expect(parser.filenames).toEqual(['pom.xml']);
    const result = parser.parse('<project></project>');
    expect(result.ecosystem).toBe('maven');
  });

  it('should extract production dependencies', () => {
    const content = `
      <project>
        <dependencies>
          <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-core</artifactId>
            <version>5.3.20</version>
          </dependency>
          <dependency>
            <groupId>com.google.guava</groupId>
            <artifactId>guava</artifactId>
            <version>31.1-jre</version>
          </dependency>
        </dependencies>
      </project>`;

    const result = parser.parse(content);

    expect(result.dependencies).toEqual([
      { name: 'org.springframework:spring-core', versionConstraint: '5.3.20', dependencyType: 'production' },
      { name: 'com.google.guava:guava', versionConstraint: '31.1-jre', dependencyType: 'production' },
    ]);
    expect(result.errors).toHaveLength(0);
  });

  it('should classify test scope as development', () => {
    const content = `
      <project>
        <dependencies>
          <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <version>4.13.2</version>
            <scope>test</scope>
          </dependency>
        </dependencies>
      </project>`;

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]).toEqual({
      name: 'junit:junit',
      versionConstraint: '4.13.2',
      dependencyType: 'development',
    });
  });

  it('should treat non-test scopes as production', () => {
    const content = `
      <project>
        <dependencies>
          <dependency>
            <groupId>javax.servlet</groupId>
            <artifactId>javax.servlet-api</artifactId>
            <version>4.0.1</version>
            <scope>provided</scope>
          </dependency>
          <dependency>
            <groupId>com.example</groupId>
            <artifactId>runtime-lib</artifactId>
            <version>1.0.0</version>
            <scope>runtime</scope>
          </dependency>
        </dependencies>
      </project>`;

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies[0].dependencyType).toBe('production');
    expect(result.dependencies[1].dependencyType).toBe('production');
  });

  it('should handle dependencies without version', () => {
    const content = `
      <project>
        <dependencies>
          <dependency>
            <groupId>org.example</groupId>
            <artifactId>managed-dep</artifactId>
          </dependency>
        </dependencies>
      </project>`;

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]).toEqual({
      name: 'org.example:managed-dep',
      versionConstraint: undefined,
      dependencyType: 'production',
    });
    expect(result.errors).toHaveLength(0);
  });

  it('should handle a single dependency (not wrapped in array)', () => {
    const content = `
      <project>
        <dependencies>
          <dependency>
            <groupId>org.example</groupId>
            <artifactId>only-one</artifactId>
            <version>1.0.0</version>
          </dependency>
        </dependencies>
      </project>`;

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].name).toBe('org.example:only-one');
  });

  it('should handle mixed production and development dependencies', () => {
    const content = `
      <project>
        <dependencies>
          <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-web</artifactId>
            <version>5.3.20</version>
          </dependency>
          <dependency>
            <groupId>org.mockito</groupId>
            <artifactId>mockito-core</artifactId>
            <version>4.6.1</version>
            <scope>test</scope>
          </dependency>
        </dependencies>
      </project>`;

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies[0].dependencyType).toBe('production');
    expect(result.dependencies[1].dependencyType).toBe('development');
  });

  it('should skip entries with missing groupId', () => {
    const content = `
      <project>
        <dependencies>
          <dependency>
            <artifactId>no-group</artifactId>
            <version>1.0.0</version>
          </dependency>
          <dependency>
            <groupId>org.valid</groupId>
            <artifactId>valid-dep</artifactId>
            <version>2.0.0</version>
          </dependency>
        </dependencies>
      </project>`;

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].name).toBe('org.valid:valid-dep');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].entry).toBe('no-group');
    expect(result.errors[0].message).toContain('groupId');
  });

  it('should skip entries with missing artifactId', () => {
    const content = `
      <project>
        <dependencies>
          <dependency>
            <groupId>org.example</groupId>
            <version>1.0.0</version>
          </dependency>
        </dependencies>
      </project>`;

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].entry).toBe('org.example');
    expect(result.errors[0].message).toContain('artifactId');
  });

  it('should handle empty dependencies section', () => {
    const content = `
      <project>
        <dependencies></dependencies>
      </project>`;

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle project with no dependencies section', () => {
    const content = `
      <project>
        <modelVersion>4.0.0</modelVersion>
        <groupId>com.example</groupId>
        <artifactId>my-app</artifactId>
      </project>`;

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle invalid XML', () => {
    const result = parser.parse('not valid xml <<<>>>');

    expect(result.ecosystem).toBe('maven');
    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('Invalid XML');
  });

  it('should handle empty content', () => {
    const result = parser.parse('');

    expect(result.ecosystem).toBe('maven');
    expect(result.dependencies).toHaveLength(0);
  });
});
