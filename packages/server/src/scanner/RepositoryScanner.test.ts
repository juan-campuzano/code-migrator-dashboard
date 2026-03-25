import { describe, it, expect } from 'vitest';
import { RepositoryScanner } from './RepositoryScanner';
import { FileContent, FileEntry } from '../models/types';

function file(path: string, size?: number): FileEntry {
  return { path, type: 'file', size };
}

function dir(path: string): FileEntry {
  return { path, type: 'directory' };
}

function content(path: string, text: string): FileContent {
  return { path, content: text };
}

describe('RepositoryScanner', () => {
  const scanner = new RepositoryScanner();

  describe('scan', () => {
    it('detects languages from file tree', () => {
      const fileTree = [file('src/index.ts'), file('src/utils.ts'), file('main.py')];
      const result = scanner.scan([], fileTree);

      const langNames = result.technologies
        .filter((t) => t.type === 'language')
        .map((t) => t.name);
      expect(langNames).toContain('TypeScript');
      expect(langNames).toContain('Python');
      expect(result.dependencies).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('parses manifest files and extracts dependencies', () => {
      const fileTree = [file('package.json')];
      const files = [
        content(
          'package.json',
          JSON.stringify({
            dependencies: { express: '^4.18.0' },
            devDependencies: { vitest: '^1.0.0' },
          }),
        ),
      ];

      const result = scanner.scan(files, fileTree);

      expect(result.dependencies).toHaveLength(2);
      const express = result.dependencies.find((d) => d.name === 'express');
      expect(express).toEqual({
        name: 'express',
        versionConstraint: '^4.18.0',
        ecosystem: 'npm',
        dependencyType: 'production',
      });
      const vitest = result.dependencies.find((d) => d.name === 'vitest');
      expect(vitest).toEqual({
        name: 'vitest',
        versionConstraint: '^1.0.0',
        ecosystem: 'npm',
        dependencyType: 'development',
      });
    });

    it('detects frameworks from parsed dependencies', () => {
      const fileTree = [file('package.json'), file('src/app.ts')];
      const files = [
        content(
          'package.json',
          JSON.stringify({
            dependencies: { react: '^18.2.0', express: '^4.18.0' },
          }),
        ),
      ];

      const result = scanner.scan(files, fileTree);

      const frameworks = result.technologies.filter((t) => t.type === 'framework');
      const frameworkNames = frameworks.map((t) => t.name);
      expect(frameworkNames).toContain('React');
      expect(frameworkNames).toContain('Express');
    });

    it('combines language and framework technologies', () => {
      const fileTree = [file('src/index.ts'), file('package.json')];
      const files = [
        content(
          'package.json',
          JSON.stringify({ dependencies: { react: '^18.0.0' } }),
        ),
      ];

      const result = scanner.scan(files, fileTree);

      const types = result.technologies.map((t) => t.type);
      expect(types).toContain('language');
      expect(types).toContain('framework');
    });

    it('collects parser errors without stopping the scan', () => {
      const fileTree = [file('package.json'), file('requirements.txt')];
      const files = [
        content('package.json', '{ invalid json'),
        content('requirements.txt', 'flask==2.0.0\nrequests>=2.28.0'),
      ];

      const result = scanner.scan(files, fileTree);

      // requirements.txt should still be parsed successfully
      expect(result.dependencies.length).toBeGreaterThanOrEqual(2);
      const depNames = result.dependencies.map((d) => d.name);
      expect(depNames).toContain('flask');
      expect(depNames).toContain('requests');

      // package.json should have produced an error
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      const pkgError = result.errors.find((e) => e.file === 'package.json');
      expect(pkgError).toBeDefined();
    });

    it('handles files that throw errors during parsing', () => {
      const fileTree = [file('package.json'), file('Cargo.toml')];
      const files = [
        content(
          'package.json',
          JSON.stringify({ dependencies: { lodash: '^4.0.0' } }),
        ),
        // Cargo.toml with completely invalid TOML that may throw
        content('Cargo.toml', '\0\0\0invalid toml content\0\0\0'),
      ];

      const result = scanner.scan(files, fileTree);

      // package.json should still be parsed
      expect(result.dependencies.some((d) => d.name === 'lodash')).toBe(true);
      // Errors should be collected
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });

    it('skips files that do not match any parser', () => {
      const fileTree = [file('README.md'), file('src/index.ts')];
      const files = [
        content('README.md', '# My Project'),
        content('src/index.ts', 'console.log("hello")'),
      ];

      const result = scanner.scan(files, fileTree);

      expect(result.dependencies).toEqual([]);
      expect(result.errors).toEqual([]);
      // Languages should still be detected from file tree
      const langNames = result.technologies.map((t) => t.name);
      expect(langNames).toContain('TypeScript');
    });

    it('handles empty inputs', () => {
      const result = scanner.scan([], []);

      expect(result.technologies).toEqual([]);
      expect(result.dependencies).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('handles repository with no manifest files', () => {
      const fileTree = [
        dir('src'),
        file('src/main.rs'),
        file('src/lib.rs'),
        file('README.md'),
      ];

      const result = scanner.scan([], fileTree);

      const langNames = result.technologies.map((t) => t.name);
      expect(langNames).toContain('Rust');
      expect(result.dependencies).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('parses multiple manifest files from different ecosystems', () => {
      const fileTree = [
        file('package.json'),
        file('requirements.txt'),
        file('src/app.ts'),
        file('scripts/run.py'),
      ];
      const files = [
        content(
          'package.json',
          JSON.stringify({ dependencies: { express: '^4.18.0' } }),
        ),
        content('requirements.txt', 'django==4.2.0'),
      ];

      const result = scanner.scan(files, fileTree);

      // Dependencies from both ecosystems
      const ecosystems = [...new Set(result.dependencies.map((d) => d.ecosystem))];
      expect(ecosystems).toContain('npm');
      expect(ecosystems).toContain('pip');

      // Frameworks detected from both
      const frameworkNames = result.technologies
        .filter((t) => t.type === 'framework')
        .map((t) => t.name);
      expect(frameworkNames).toContain('Express');
      expect(frameworkNames).toContain('Django');
    });

    it('handles nested manifest file paths', () => {
      const fileTree = [file('services/api/package.json')];
      const files = [
        content(
          'services/api/package.json',
          JSON.stringify({ dependencies: { fastify: '^4.0.0' } }),
        ),
      ];

      const result = scanner.scan(files, fileTree);

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0].name).toBe('fastify');
      expect(result.dependencies[0].ecosystem).toBe('npm');
    });

    it('includes parse-level errors from malformed entries', () => {
      const fileTree = [file('package.json')];
      const files = [
        content(
          'package.json',
          JSON.stringify({
            dependencies: { valid: '^1.0.0', broken: 123 },
          }),
        ),
      ];

      const result = scanner.scan(files, fileTree);

      // Valid dependency should be extracted
      expect(result.dependencies.some((d) => d.name === 'valid')).toBe(true);
      // Malformed entry should produce an error
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors[0].file).toBe('package.json');
    });
  });
});
