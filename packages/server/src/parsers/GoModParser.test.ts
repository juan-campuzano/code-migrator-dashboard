import { describe, it, expect } from 'vitest';
import { GoModParser } from './GoModParser';

describe('GoModParser', () => {
  const parser = new GoModParser();

  it('should have correct filenames and ecosystem', () => {
    expect(parser.filenames).toEqual(['go.mod']);
    const result = parser.parse('');
    expect(result.ecosystem).toBe('go');
  });

  it('should parse single-line require directives', () => {
    const content = [
      'module github.com/myorg/myapp',
      '',
      'go 1.21',
      '',
      'require github.com/pkg/errors v0.9.1',
    ].join('\n');

    const result = parser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.dependencies).toEqual([
      { name: 'github.com/pkg/errors', versionConstraint: 'v0.9.1', dependencyType: 'production' },
    ]);
  });

  it('should parse block require directives', () => {
    const content = [
      'module github.com/myorg/myapp',
      '',
      'go 1.21',
      '',
      'require (',
      '\tgithub.com/pkg/errors v0.9.1',
      '\tgolang.org/x/text v0.3.7',
      '\tgithub.com/stretchr/testify v1.8.4',
      ')',
    ].join('\n');

    const result = parser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.dependencies).toHaveLength(3);
    expect(result.dependencies[0]).toEqual({
      name: 'github.com/pkg/errors',
      versionConstraint: 'v0.9.1',
      dependencyType: 'production',
    });
    expect(result.dependencies[1]).toEqual({
      name: 'golang.org/x/text',
      versionConstraint: 'v0.3.7',
      dependencyType: 'production',
    });
    expect(result.dependencies[2]).toEqual({
      name: 'github.com/stretchr/testify',
      versionConstraint: 'v1.8.4',
      dependencyType: 'production',
    });
  });

  it('should extract indirect dependencies (skip comment but keep dep)', () => {
    const content = [
      'module github.com/myorg/myapp',
      '',
      'require (',
      '\tgithub.com/pkg/errors v0.9.1',
      '\tgolang.org/x/sys v0.5.0 // indirect',
      ')',
    ].join('\n');

    const result = parser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies[1]).toEqual({
      name: 'golang.org/x/sys',
      versionConstraint: 'v0.5.0',
      dependencyType: 'production',
    });
  });

  it('should classify all dependencies as production', () => {
    const content = [
      'require (',
      '\tgithub.com/pkg/errors v0.9.1',
      '\tgolang.org/x/sys v0.5.0 // indirect',
      ')',
    ].join('\n');

    const result = parser.parse(content);

    for (const dep of result.dependencies) {
      expect(dep.dependencyType).toBe('production');
    }
  });

  it('should skip module, go, replace, exclude, and retract directives', () => {
    const content = [
      'module github.com/myorg/myapp',
      '',
      'go 1.21',
      '',
      'require github.com/pkg/errors v0.9.1',
      '',
      'replace github.com/pkg/errors => ../errors',
      '',
      'exclude github.com/old/pkg v1.0.0',
      '',
      'retract v1.0.0',
    ].join('\n');

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].name).toBe('github.com/pkg/errors');
    expect(result.errors).toHaveLength(0);
  });

  it('should handle empty content', () => {
    const result = parser.parse('');

    expect(result.ecosystem).toBe('go');
    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle content with only module and go directives', () => {
    const content = [
      'module github.com/myorg/myapp',
      '',
      'go 1.21',
    ].join('\n');

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should skip comment-only lines', () => {
    const content = [
      '// This is a go.mod file',
      'module github.com/myorg/myapp',
      '',
      '// Dependencies',
      'require github.com/pkg/errors v0.9.1',
    ].join('\n');

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle multiple require blocks', () => {
    const content = [
      'module github.com/myorg/myapp',
      '',
      'require (',
      '\tgithub.com/pkg/errors v0.9.1',
      ')',
      '',
      'require (',
      '\tgolang.org/x/text v0.3.7 // indirect',
      '\tgolang.org/x/sys v0.5.0 // indirect',
      ')',
    ].join('\n');

    const result = parser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.dependencies).toHaveLength(3);
  });

  it('should report errors for malformed entries and continue parsing', () => {
    const content = [
      'require (',
      '\tgithub.com/pkg/errors v0.9.1',
      '\tmalformed-no-version',
      '\tgolang.org/x/text v0.3.7',
      ')',
    ].join('\n');

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies[0].name).toBe('github.com/pkg/errors');
    expect(result.dependencies[1].name).toBe('golang.org/x/text');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].entry).toBe('malformed-no-version');
  });

  it('should handle versions with pre-release and build metadata', () => {
    const content = [
      'require (',
      '\tgithub.com/some/pkg v1.2.3-beta.1',
      '\tgithub.com/other/pkg v0.0.0-20230101120000-abcdef123456',
      ')',
    ].join('\n');

    const result = parser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies[0].versionConstraint).toBe('v1.2.3-beta.1');
    expect(result.dependencies[1].versionConstraint).toBe('v0.0.0-20230101120000-abcdef123456');
  });

  it('should handle mixed single-line and block requires', () => {
    const content = [
      'module github.com/myorg/myapp',
      '',
      'go 1.21',
      '',
      'require github.com/single/dep v1.0.0',
      '',
      'require (',
      '\tgithub.com/block/dep1 v2.0.0',
      '\tgithub.com/block/dep2 v3.0.0',
      ')',
    ].join('\n');

    const result = parser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.dependencies).toHaveLength(3);
    expect(result.dependencies[0].name).toBe('github.com/single/dep');
    expect(result.dependencies[1].name).toBe('github.com/block/dep1');
    expect(result.dependencies[2].name).toBe('github.com/block/dep2');
  });

  it('should reject entries with invalid version (no v prefix)', () => {
    const content = 'require github.com/pkg/errors 0.9.1';
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });
});
