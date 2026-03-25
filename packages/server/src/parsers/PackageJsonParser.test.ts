import { describe, it, expect } from 'vitest';
import { PackageJsonParser } from './PackageJsonParser';

describe('PackageJsonParser', () => {
  const parser = new PackageJsonParser();

  it('should have correct filenames and ecosystem', () => {
    expect(parser.filenames).toEqual(['package.json']);
    const result = parser.parse('{}');
    expect(result.ecosystem).toBe('npm');
  });

  it('should extract production dependencies', () => {
    const content = JSON.stringify({
      dependencies: {
        express: '^4.18.2',
        lodash: '~4.17.21',
      },
    });

    const result = parser.parse(content);

    expect(result.dependencies).toEqual([
      { name: 'express', versionConstraint: '^4.18.2', dependencyType: 'production' },
      { name: 'lodash', versionConstraint: '~4.17.21', dependencyType: 'production' },
    ]);
    expect(result.errors).toHaveLength(0);
  });

  it('should extract development dependencies', () => {
    const content = JSON.stringify({
      devDependencies: {
        vitest: '^1.6.0',
        typescript: '^5.4.5',
      },
    });

    const result = parser.parse(content);

    expect(result.dependencies).toEqual([
      { name: 'vitest', versionConstraint: '^1.6.0', dependencyType: 'development' },
      { name: 'typescript', versionConstraint: '^5.4.5', dependencyType: 'development' },
    ]);
    expect(result.errors).toHaveLength(0);
  });

  it('should extract both production and development dependencies', () => {
    const content = JSON.stringify({
      dependencies: { react: '^18.2.0' },
      devDependencies: { jest: '^29.0.0' },
    });

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies[0]).toEqual({
      name: 'react',
      versionConstraint: '^18.2.0',
      dependencyType: 'production',
    });
    expect(result.dependencies[1]).toEqual({
      name: 'jest',
      versionConstraint: '^29.0.0',
      dependencyType: 'development',
    });
  });

  it('should handle empty dependencies objects', () => {
    const content = JSON.stringify({
      dependencies: {},
      devDependencies: {},
    });

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle missing dependencies and devDependencies keys', () => {
    const content = JSON.stringify({ name: 'my-package', version: '1.0.0' });

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should skip malformed entries with non-string version values', () => {
    const content = JSON.stringify({
      dependencies: {
        valid: '^1.0.0',
        'bad-number': 123,
        'bad-object': { version: '1.0.0' },
        'bad-null': null,
        'bad-bool': true,
        'also-valid': '~2.0.0',
      },
    });

    const result = parser.parse(content);

    expect(result.dependencies).toEqual([
      { name: 'valid', versionConstraint: '^1.0.0', dependencyType: 'production' },
      { name: 'also-valid', versionConstraint: '~2.0.0', dependencyType: 'production' },
    ]);
    expect(result.errors).toHaveLength(4);
    expect(result.errors.map((e) => e.entry)).toEqual([
      'bad-number',
      'bad-object',
      'bad-null',
      'bad-bool',
    ]);
  });

  it('should handle invalid JSON', () => {
    const result = parser.parse('not valid json {{{');

    expect(result.ecosystem).toBe('npm');
    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('Invalid JSON');
  });

  it('should handle non-object JSON (array)', () => {
    const result = parser.parse('[1, 2, 3]');

    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('Expected a JSON object');
  });

  it('should handle non-object dependencies section', () => {
    const content = JSON.stringify({
      dependencies: 'not-an-object',
    });

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].entry).toBe('dependencies');
  });

  it('should handle non-object devDependencies section', () => {
    const content = JSON.stringify({
      devDependencies: [{ name: 'foo' }],
    });

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].entry).toBe('devDependencies');
  });
});
