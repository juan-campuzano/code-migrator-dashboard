import { describe, it, expect } from 'vitest';
import { RequirementsTxtParser } from './RequirementsTxtParser';

describe('RequirementsTxtParser', () => {
  const parser = new RequirementsTxtParser();

  it('should have correct filenames and ecosystem', () => {
    expect(parser.filenames).toEqual(['requirements.txt']);
    const result = parser.parse('');
    expect(result.ecosystem).toBe('pip');
  });

  it('should parse packages with version specifiers', () => {
    const content = [
      'flask==2.0.1',
      'requests>=2.28.0',
      'numpy',
      'django~=4.2',
      'sqlalchemy!=1.4.0',
      'celery<=5.3.0',
      'redis>4.0',
      'gunicorn<21.0',
    ].join('\n');

    const result = parser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.dependencies).toEqual([
      { name: 'flask', versionConstraint: '==2.0.1', dependencyType: 'production' },
      { name: 'requests', versionConstraint: '>=2.28.0', dependencyType: 'production' },
      { name: 'numpy', dependencyType: 'production' },
      { name: 'django', versionConstraint: '~=4.2', dependencyType: 'production' },
      { name: 'sqlalchemy', versionConstraint: '!=1.4.0', dependencyType: 'production' },
      { name: 'celery', versionConstraint: '<=5.3.0', dependencyType: 'production' },
      { name: 'redis', versionConstraint: '>4.0', dependencyType: 'production' },
      { name: 'gunicorn', versionConstraint: '<21.0', dependencyType: 'production' },
    ]);
  });

  it('should classify all dependencies as production', () => {
    const content = 'flask==2.0.1\npytest==7.0.0';
    const result = parser.parse(content);

    for (const dep of result.dependencies) {
      expect(dep.dependencyType).toBe('production');
    }
  });

  it('should skip comments and blank lines', () => {
    const content = [
      '# This is a comment',
      '',
      'flask==2.0.1',
      '   ',
      '# Another comment',
      'requests>=2.28.0',
    ].join('\n');

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies[0].name).toBe('flask');
    expect(result.dependencies[1].name).toBe('requests');
    expect(result.errors).toHaveLength(0);
  });

  it('should skip pip options (-r, -c, -e, --)', () => {
    const content = [
      '-r base.txt',
      '-c constraints.txt',
      '-e git+https://github.com/user/repo.git',
      '--index-url https://pypi.org/simple',
      '--extra-index-url https://custom.pypi.org',
      'flask==2.0.1',
    ].join('\n');

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].name).toBe('flask');
    expect(result.errors).toHaveLength(0);
  });

  it('should handle inline comments', () => {
    const content = 'flask==2.0.1  # web framework\nrequests>=2.28.0 # http lib';
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies[0]).toEqual({
      name: 'flask',
      versionConstraint: '==2.0.1',
      dependencyType: 'production',
    });
    expect(result.dependencies[1]).toEqual({
      name: 'requests',
      versionConstraint: '>=2.28.0',
      dependencyType: 'production',
    });
  });

  it('should handle extras in package names', () => {
    const content = 'requests[security]>=2.28.0\ncelery[redis]==5.3.0';
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies[0].name).toBe('requests');
    expect(result.dependencies[0].versionConstraint).toBe('>=2.28.0');
    expect(result.dependencies[1].name).toBe('celery');
    expect(result.dependencies[1].versionConstraint).toBe('==5.3.0');
  });

  it('should handle environment markers', () => {
    const content = 'pywin32>=300; sys_platform == "win32"';
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].name).toBe('pywin32');
    expect(result.dependencies[0].versionConstraint).toBe('>=300');
  });

  it('should handle empty content', () => {
    const result = parser.parse('');

    expect(result.ecosystem).toBe('pip');
    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle content with only comments and blank lines', () => {
    const content = '# comment\n\n# another comment\n   \n';
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle packages without version specifiers', () => {
    const content = 'flask\nrequests\nnumpy';
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(3);
    for (const dep of result.dependencies) {
      expect(dep.versionConstraint).toBeUndefined();
      expect(dep.dependencyType).toBe('production');
    }
  });

  it('should report errors for malformed lines and continue parsing', () => {
    const content = [
      'flask==2.0.1',
      '!!!invalid!!!',
      'requests>=2.28.0',
      '===',
      'numpy',
    ].join('\n');

    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(3);
    expect(result.dependencies[0].name).toBe('flask');
    expect(result.dependencies[1].name).toBe('requests');
    expect(result.dependencies[2].name).toBe('numpy');
    expect(result.errors).toHaveLength(2);
  });

  it('should handle packages with dots, hyphens, and underscores in names', () => {
    const content = 'my-package==1.0\nmy_package==2.0\nmy.package==3.0';
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(3);
    expect(result.dependencies[0].name).toBe('my-package');
    expect(result.dependencies[1].name).toBe('my_package');
    expect(result.dependencies[2].name).toBe('my.package');
    expect(result.errors).toHaveLength(0);
  });
});
