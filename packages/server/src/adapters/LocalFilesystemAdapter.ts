import * as fs from 'fs/promises';
import * as path from 'path';
import type { SourceAdapter, RepositorySource, FetchResult, FileEntry, FileContent } from '../models/types';

/** Directories to skip when walking the file tree */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'target',
  'vendor',
]);

/** Manifest filenames that should have their contents read */
const MANIFEST_FILES = new Set([
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'pom.xml',
  'build.gradle',
  'Cargo.toml',
  'go.mod',
  'Gemfile',
]);

/** Common config files that should have their contents read */
const CONFIG_FILES = new Set([
  'tsconfig.json',
  'angular.json',
  '.babelrc',
  'babel.config.js',
  'babel.config.json',
  'webpack.config.js',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.mjs',
  'nuxt.config.ts',
  'nuxt.config.js',
  'vue.config.js',
  '.eslintrc.json',
  '.eslintrc.js',
  'jest.config.js',
  'jest.config.ts',
  'vitest.config.ts',
  'vitest.config.js',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.env.example',
  'Makefile',
  'CMakeLists.txt',
  'setup.py',
  'setup.cfg',
]);

function shouldReadFile(filename: string): boolean {
  return MANIFEST_FILES.has(filename) || CONFIG_FILES.has(filename);
}

export class LocalFilesystemAdapter implements SourceAdapter {
  async fetch(source: RepositorySource): Promise<FetchResult> {
    if (source.type !== 'local') {
      throw new Error(`LocalFilesystemAdapter only supports local sources, got '${source.type}'`);
    }

    const rootPath = path.resolve(source.path);

    // Validate the path exists and is accessible
    try {
      const stat = await fs.stat(rootPath);
      if (!stat.isDirectory()) {
        throw new Error(`Path is not a directory: ${rootPath}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
          throw new Error(`Path does not exist: ${rootPath}`);
        }
        if (code === 'EACCES') {
          throw new Error(`Permission denied: cannot access ${rootPath}`);
        }
      }
      throw err;
    }

    const fileTree: FileEntry[] = [];
    const files: FileContent[] = [];

    await this.walkDirectory(rootPath, rootPath, fileTree, files);

    return { fileTree, files };
  }

  private async walkDirectory(
    currentPath: string,
    rootPath: string,
    fileTree: FileEntry[],
    files: FileContent[],
  ): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(rootPath, fullPath);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) {
          continue;
        }
        fileTree.push({ path: relativePath, type: 'directory' });
        await this.walkDirectory(fullPath, rootPath, fileTree, files);
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        fileTree.push({ path: relativePath, type: 'file', size: stat.size });

        if (shouldReadFile(entry.name)) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            files.push({ path: relativePath, content });
          } catch {
            // Skip files that can't be read (e.g. permission issues)
          }
        }
      }
    }
  }
}
