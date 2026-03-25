import { describe, it, expect } from 'vitest';
import { PyprojectTomlParser } from './PyprojectTomlParser';

describe('PyprojectTomlParser', () => {
  const parser = new PyprojectTomlParser();

  it('should have correct filenames and ecosystem', () => {
    expect(parser.filenames).toEqual(['pyproject.toml']);
    const result = parser.parse('[project]\nname = "test"');
    expect(result.ecosystem).toBe('pip');
  });

  it('should extract production dependencies from [project.dependencies]', () => {
    const content = `
[project]
name = "myapp"
dependencies = [
  "flask>=2.0.1",
  "requests",
  "django~=4.2",
]
`;
    const result = parser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.dependencies).toEqual([
      { name: 'flask', versionConstraint: '>=2.0.1', dependencyType: 'production' },
      { name: 'requests', dependencyType: 'production' },
      { name: 'django', versionConstraint: '~=4.2', dependencyType: 'production' },
    ]);
  });

  it('should classify dev/test/testing optional-dependency groups as development', () => {
    const content = `
[project]
name = "myapp"

[project.optional-dependencies]
dev = ["pytest>=7.0", "black"]
test = ["coverage>=6.0"]
testing = ["tox"]
`;
    const result = parser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.dependencies).toHaveLength(4);
    for (const dep of result.dependencies) {
      expect(dep.dependencyType).toBe('development');
    }
  });

  it('should classify non-dev optional-dependency groups as production', () => {
    const content = `
[project]
name = "myapp"

[project.optional-dependencies]
docs = ["sphinx>=5.0"]
all = ["numpy", "pandas"]
`;
    const result = parser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.dependencies).toHaveLength(3);
    for (const dep of result.dependencies) {
      expect(dep.dependencyType).toBe('production');
    }
  });

  it('should extract both production and development dependencies', () => {
    const content = `
[project]
name = "myapp"
dependencies = ["flask>=2.0"]

[project.optional-dependencies]
dev = ["pytest>=7.0"]
docs = ["sphinx"]
`;
    const result = parser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.dependencies).toHaveLength(3);
    expect(result.dependencies[0]).toEqual({
      name: 'flask', versionConstraint: '>=2.0', dependencyType: 'production',
    });
    expect(result.dependencies[1]).toEqual({
      name: 'pytest', versionConstraint: '>=7.0', dependencyType: 'development',
    });
    expect(result.dependencies[2]).toEqual({
      name: 'sphinx', dependencyType: 'production',
    });
  });

  it('should handle all PEP 508 version operators', () => {
    const content = `
[project]
name = "myapp"
dependencies = [
  "a~=1.0",
  "b==2.0",
  "c!=3.0",
  "d>=4.0",
  "e<=5.0",
  "f>6.0",
  "g<7.0",
]
`;
    const result = parser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.dependencies).toHaveLength(7);
    expect(result.dependencies[0].versionConstraint).toBe('~=1.0');
    expect(result.dependencies[1].versionConstraint).toBe('==2.0');
    expect(result.dependencies[2].versionConstraint).toBe('!=3.0');
    expect(result.dependencies[3].versionConstraint).toBe('>=4.0');
    expect(result.dependencies[4].versionConstraint).toBe('<=5.0');
    expect(result.dependencies[5].versionConstraint).toBe('>6.0');
    expect(result.dependencies[6].versionConstraint).toBe('<7.0');
  });

  it('should handle environment markers by stripping them', () => {
    const content = `
[project]
name = "myapp"
dependencies = [
  'pywin32>=300; sys_platform == "win32"',
]
`;
    const result = parser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].name).toBe('pywin32');
    expect(result.dependencies[0].versionConstraint).toBe('>=300');
  });

  it('should handle extras in dependency strings', () => {
    const content = `
[project]
name = "myapp"
dependencies = [
  "requests[security]>=2.28.0",
  "celery[redis]==5.3.0",
]
`;
    const result = parser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies[0].name).toBe('requests');
    expect(result.dependencies[0].versionConstraint).toBe('>=2.28.0');
    expect(result.dependencies[1].name).toBe('celery');
    expect(result.dependencies[1].versionConstraint).toBe('==5.3.0');
  });

  it('should handle empty dependencies array', () => {
    const content = `
[project]
name = "myapp"
dependencies = []
`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle missing project section', () => {
    const content = `
[tool.setuptools]
packages = ["myapp"]
`;
    const result = parser.parse(content);

    expect(result.ecosystem).toBe('pip');
    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle missing dependencies key in project', () => {
    const content = `
[project]
name = "myapp"
version = "1.0.0"
`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle invalid TOML', () => {
    const result = parser.parse('this is not valid toml [[[');

    expect(result.ecosystem).toBe('pip');
    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('Invalid TOML');
  });

  it('should handle empty content', () => {
    const result = parser.parse('');

    expect(result.ecosystem).toBe('pip');
    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should report errors for malformed entries and continue parsing', () => {
    const content = `
[project]
name = "myapp"
dependencies = [
  "flask>=2.0",
  "!!!invalid!!!",
  "requests",
]
`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies[0].name).toBe('flask');
    expect(result.dependencies[1].name).toBe('requests');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].entry).toBe('!!!invalid!!!');
  });

  it('should handle case-insensitive dev group names', () => {
    const content = `
[project]
name = "myapp"

[project.optional-dependencies]
Dev = ["pytest"]
TEST = ["coverage"]
Testing = ["tox"]
`;
    const result = parser.parse(content);

    expect(result.errors).toHaveLength(0);
    for (const dep of result.dependencies) {
      expect(dep.dependencyType).toBe('development');
    }
  });
});
