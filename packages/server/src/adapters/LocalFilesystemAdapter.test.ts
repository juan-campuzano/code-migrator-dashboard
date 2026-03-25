import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { LocalFilesystemAdapter } from './LocalFilesystemAdapter';

describe('LocalFilesystemAdapter', () => {
  let adapter: LocalFilesystemAdapter;
  let tmpDir: string;

  beforeEach(async () => {
    adapter = new LocalFilesystemAdapter();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lfa-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('file tree walking', () => {
    it('builds a file tree from a directory structure', async () => {
      await fs.mkdir(path.join(tmpDir, 'src'));
      await fs.writeFile(path.join(tmpDir, 'src', 'index.ts'), 'console.log("hi")');
      await fs.writeFile(path.join(tmpDir, 'README.md'), '# Hello');

      const result = await adapter.fetch({ type: 'local', path: tmpDir });

      const paths = result.fileTree.map((e) => e.path).sort();
      expect(paths).toEqual(['README.md', 'src', 'src/index.ts'].sort());

      const srcDir = result.fileTree.find((e) => e.path === 'src');
      expect(srcDir?.type).toBe('directory');

      const readme = result.fileTree.find((e) => e.path === 'README.md');
      expect(readme?.type).toBe('file');
      expect(readme?.size).toBeGreaterThan(0);
    });

    it('skips node_modules, .git, dist, build, target, vendor directories', async () => {
      for (const dir of ['node_modules', '.git', 'dist', 'build', 'target', 'vendor']) {
        await fs.mkdir(path.join(tmpDir, dir));
        await fs.writeFile(path.join(tmpDir, dir, 'file.txt'), 'content');
      }
      await fs.writeFile(path.join(tmpDir, 'app.ts'), 'code');

      const result = await adapter.fetch({ type: 'local', path: tmpDir });

      const paths = result.fileTree.map((e) => e.path);
      expect(paths).toEqual(['app.ts']);
    });

    it('handles an empty directory', async () => {
      const result = await adapter.fetch({ type: 'local', path: tmpDir });
      expect(result.fileTree).toEqual([]);
      expect(result.files).toEqual([]);
    });

    it('walks nested directories recursively', async () => {
      await fs.mkdir(path.join(tmpDir, 'a', 'b', 'c'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, 'a', 'b', 'c', 'deep.ts'), 'deep');

      const result = await adapter.fetch({ type: 'local', path: tmpDir });

      const filePaths = result.fileTree.filter((e) => e.type === 'file').map((e) => e.path);
      expect(filePaths).toContain(path.join('a', 'b', 'c', 'deep.ts'));
    });
  });

  describe('manifest and config file reading', () => {
    it('reads manifest files and returns their content', async () => {
      const pkgContent = JSON.stringify({ name: 'test', dependencies: { lodash: '^4.0.0' } });
      await fs.writeFile(path.join(tmpDir, 'package.json'), pkgContent);

      const result = await adapter.fetch({ type: 'local', path: tmpDir });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('package.json');
      expect(result.files[0].content).toBe(pkgContent);
    });

    it('reads all supported manifest file types', async () => {
      const manifests = [
        'package.json',
        'requirements.txt',
        'pyproject.toml',
        'pom.xml',
        'build.gradle',
        'Cargo.toml',
        'go.mod',
        'Gemfile',
      ];
      for (const name of manifests) {
        await fs.writeFile(path.join(tmpDir, name), `content of ${name}`);
      }

      const result = await adapter.fetch({ type: 'local', path: tmpDir });

      const readPaths = result.files.map((f) => f.path).sort();
      expect(readPaths).toEqual(manifests.sort());
    });

    it('reads common config files', async () => {
      await fs.writeFile(path.join(tmpDir, 'tsconfig.json'), '{}');
      await fs.writeFile(path.join(tmpDir, 'Dockerfile'), 'FROM node:18');

      const result = await adapter.fetch({ type: 'local', path: tmpDir });

      const readPaths = result.files.map((f) => f.path).sort();
      expect(readPaths).toEqual(['Dockerfile', 'tsconfig.json']);
    });

    it('does not read non-manifest/config files', async () => {
      await fs.writeFile(path.join(tmpDir, 'index.ts'), 'code');
      await fs.writeFile(path.join(tmpDir, 'style.css'), 'body {}');
      await fs.writeFile(path.join(tmpDir, 'package.json'), '{}');

      const result = await adapter.fetch({ type: 'local', path: tmpDir });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('package.json');
      // But all files appear in the tree
      expect(result.fileTree.filter((e) => e.type === 'file')).toHaveLength(3);
    });

    it('reads manifest files in subdirectories', async () => {
      await fs.mkdir(path.join(tmpDir, 'packages', 'core'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, 'packages', 'core', 'package.json'), '{"name":"core"}');

      const result = await adapter.fetch({ type: 'local', path: tmpDir });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe(path.join('packages', 'core', 'package.json'));
      expect(result.files[0].content).toBe('{"name":"core"}');
    });
  });

  describe('error handling', () => {
    it('throws descriptive error for non-existent path', async () => {
      const badPath = path.join(tmpDir, 'does-not-exist');
      await expect(adapter.fetch({ type: 'local', path: badPath })).rejects.toThrow(
        /Path does not exist/
      );
    });

    it('throws descriptive error when path is a file, not a directory', async () => {
      const filePath = path.join(tmpDir, 'file.txt');
      await fs.writeFile(filePath, 'content');
      await expect(adapter.fetch({ type: 'local', path: filePath })).rejects.toThrow(
        /Path is not a directory/
      );
    });

    it('throws error for non-local source type', async () => {
      await expect(
        adapter.fetch({ type: 'github', url: 'https://github.com/a/b', token: 'tok' })
      ).rejects.toThrow(/only supports local sources/);
    });
  });
});
