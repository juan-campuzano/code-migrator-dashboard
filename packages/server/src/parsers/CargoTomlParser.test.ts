import { describe, it, expect } from 'vitest';
import { CargoTomlParser } from './CargoTomlParser';

describe('CargoTomlParser', () => {
  const parser = new CargoTomlParser();

  it('should have correct filenames and ecosystem', () => {
    expect(parser.filenames).toEqual(['Cargo.toml']);
    const result = parser.parse('[package]\nname = "test"');
    expect(result.ecosystem).toBe('cargo');
  });

  it('should extract simple string dependencies', () => {
    const content = `
[dependencies]
serde = "1.0"
tokio = "1.28"
`;
    const result = parser.parse(content);

    expect(result.dependencies).toEqual([
      { name: 'serde', versionConstraint: '1.0', dependencyType: 'production' },
      { name: 'tokio', versionConstraint: '1.28', dependencyType: 'production' },
    ]);
    expect(result.errors).toHaveLength(0);
  });

  it('should extract table dependencies with version', () => {
    const content = `
[dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1.28", features = ["full"] }
`;
    const result = parser.parse(content);

    expect(result.dependencies).toEqual([
      { name: 'serde', versionConstraint: '1.0', dependencyType: 'production' },
      { name: 'tokio', versionConstraint: '1.28', dependencyType: 'production' },
    ]);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle git/path deps without version', () => {
    const content = `
[dependencies]
my-lib = { path = "../my-lib" }
other-lib = { git = "https://github.com/user/repo" }
`;
    const result = parser.parse(content);

    expect(result.dependencies).toEqual([
      { name: 'my-lib', dependencyType: 'production' },
      { name: 'other-lib', dependencyType: 'production' },
    ]);
    expect(result.errors).toHaveLength(0);
  });

  it('should extract dev-dependencies as development', () => {
    const content = `
[dev-dependencies]
criterion = "0.5"
proptest = { version = "1.2" }
`;
    const result = parser.parse(content);

    expect(result.dependencies).toEqual([
      { name: 'criterion', versionConstraint: '0.5', dependencyType: 'development' },
      { name: 'proptest', versionConstraint: '1.2', dependencyType: 'development' },
    ]);
    expect(result.errors).toHaveLength(0);
  });

  it('should extract both production and development dependencies', () => {
    const content = `
[dependencies]
serde = "1.0"

[dev-dependencies]
criterion = "0.5"
`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies[0]).toEqual({
      name: 'serde', versionConstraint: '1.0', dependencyType: 'production',
    });
    expect(result.dependencies[1]).toEqual({
      name: 'criterion', versionConstraint: '0.5', dependencyType: 'development',
    });
  });

  it('should handle empty dependencies sections', () => {
    const content = `
[dependencies]

[dev-dependencies]
`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle missing dependencies sections', () => {
    const content = `
[package]
name = "my-crate"
version = "0.1.0"
`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle invalid TOML', () => {
    const result = parser.parse('not valid toml {{{');

    expect(result.ecosystem).toBe('cargo');
    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('Invalid TOML');
  });

  it('should handle mixed dependency formats', () => {
    const content = `
[dependencies]
serde = "1.0"
tokio = { version = "1.28", features = ["full"] }
local-dep = { path = "../local" }
`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(3);
    expect(result.dependencies[0]).toEqual({
      name: 'serde', versionConstraint: '1.0', dependencyType: 'production',
    });
    expect(result.dependencies[1]).toEqual({
      name: 'tokio', versionConstraint: '1.28', dependencyType: 'production',
    });
    expect(result.dependencies[2]).toEqual({
      name: 'local-dep', dependencyType: 'production',
    });
    expect(result.errors).toHaveLength(0);
  });
});
