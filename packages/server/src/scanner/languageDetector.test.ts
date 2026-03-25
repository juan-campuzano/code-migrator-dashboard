import { describe, it, expect } from 'vitest';
import { detectLanguages, detectLanguageStats } from './languageDetector';
import { FileEntry } from '../models/types';

function file(path: string, size?: number): FileEntry {
  return { path, type: 'file', size };
}

function dir(path: string): FileEntry {
  return { path, type: 'directory' };
}

describe('detectLanguages', () => {
  it('detects TypeScript from .ts and .tsx files', () => {
    const files = [file('src/index.ts'), file('src/App.tsx')];
    const result = detectLanguages(files);
    expect(result).toEqual([{ name: 'TypeScript', type: 'language' }]);
  });

  it('detects multiple languages', () => {
    const files = [
      file('main.py'),
      file('lib.rs'),
      file('app.go'),
    ];
    const result = detectLanguages(files);
    expect(result).toHaveLength(3);
    const names = result.map(t => t.name);
    expect(names).toContain('Python');
    expect(names).toContain('Rust');
    expect(names).toContain('Go');
    result.forEach(t => expect(t.type).toBe('language'));
  });

  it('returns empty array for no files', () => {
    expect(detectLanguages([])).toEqual([]);
  });

  it('returns empty array when all files have unrecognized extensions', () => {
    const files = [file('readme.md'), file('data.csv'), file('.gitignore')];
    expect(detectLanguages(files)).toEqual([]);
  });

  it('skips directories', () => {
    const files: FileEntry[] = [
      dir('src'),
      file('src/index.ts'),
    ];
    const result = detectLanguages(files);
    expect(result).toEqual([{ name: 'TypeScript', type: 'language' }]);
  });

  it('skips files without extensions', () => {
    const files = [file('Makefile'), file('Dockerfile'), file('main.go')];
    const result = detectLanguages(files);
    expect(result).toEqual([{ name: 'Go', type: 'language' }]);
  });

  it('groups multiple extensions for the same language', () => {
    const files = [
      file('a.cpp'),
      file('b.cc'),
      file('c.cxx'),
      file('d.c++'),
    ];
    const result = detectLanguages(files);
    expect(result).toEqual([{ name: 'C++', type: 'language' }]);
  });

  it('sorts by file count descending', () => {
    const files = [
      file('a.py'),
      file('b.ts'),
      file('c.ts'),
      file('d.ts'),
      file('e.py'),
    ];
    const result = detectLanguages(files);
    expect(result[0].name).toBe('TypeScript');
    expect(result[1].name).toBe('Python');
  });

  it('detects all supported languages', () => {
    const files = [
      file('a.ts'), file('b.js'), file('c.py'), file('d.java'),
      file('e.rs'), file('f.go'), file('g.rb'), file('h.cs'),
      file('i.cpp'), file('j.c'), file('k.swift'), file('l.kt'),
      file('m.scala'), file('n.php'), file('o.dart'), file('p.ex'),
      file('q.hs'), file('r.lua'), file('s.r'), file('t.m'),
      file('u.pl'), file('v.sh'),
    ];
    const result = detectLanguages(files);
    const names = result.map(t => t.name);
    expect(names).toContain('TypeScript');
    expect(names).toContain('JavaScript');
    expect(names).toContain('Python');
    expect(names).toContain('Java');
    expect(names).toContain('Rust');
    expect(names).toContain('Go');
    expect(names).toContain('Ruby');
    expect(names).toContain('C#');
    expect(names).toContain('C++');
    expect(names).toContain('C');
    expect(names).toContain('Swift');
    expect(names).toContain('Kotlin');
    expect(names).toContain('Scala');
    expect(names).toContain('PHP');
    expect(names).toContain('Dart');
    expect(names).toContain('Elixir');
    expect(names).toContain('Haskell');
    expect(names).toContain('Lua');
    expect(names).toContain('R');
    expect(names).toContain('Objective-C');
    expect(names).toContain('Perl');
    expect(names).toContain('Shell');
  });
});

describe('detectLanguageStats', () => {
  it('calculates correct file counts', () => {
    const files = [
      file('a.ts'), file('b.ts'), file('c.ts'),
      file('d.py'),
    ];
    const stats = detectLanguageStats(files);
    const ts = stats.find(s => s.name === 'TypeScript');
    const py = stats.find(s => s.name === 'Python');
    expect(ts?.fileCount).toBe(3);
    expect(py?.fileCount).toBe(1);
  });

  it('calculates proportions that sum to 1.0', () => {
    const files = [
      file('a.ts'), file('b.ts'),
      file('c.py'), file('d.py'), file('e.py'),
      file('f.go'),
    ];
    const stats = detectLanguageStats(files);
    const total = stats.reduce((sum, s) => sum + s.proportion, 0);
    expect(total).toBeCloseTo(1.0, 10);
  });

  it('calculates correct proportions', () => {
    const files = [
      file('a.ts'), file('b.ts'),
      file('c.py'),
    ];
    const stats = detectLanguageStats(files);
    const ts = stats.find(s => s.name === 'TypeScript');
    const py = stats.find(s => s.name === 'Python');
    expect(ts?.proportion).toBeCloseTo(2 / 3, 10);
    expect(py?.proportion).toBeCloseTo(1 / 3, 10);
  });

  it('returns empty array for empty input', () => {
    expect(detectLanguageStats([])).toEqual([]);
  });

  it('ignores directories in count', () => {
    const files: FileEntry[] = [
      dir('src'),
      dir('lib'),
      file('src/main.ts'),
    ];
    const stats = detectLanguageStats(files);
    expect(stats).toHaveLength(1);
    expect(stats[0].fileCount).toBe(1);
    expect(stats[0].proportion).toBe(1.0);
  });

  it('handles mixed recognized and unrecognized extensions', () => {
    const files = [
      file('a.ts'),
      file('readme.md'),
      file('b.py'),
      file('data.csv'),
    ];
    const stats = detectLanguageStats(files);
    // Only 2 recognized files
    expect(stats).toHaveLength(2);
    const total = stats.reduce((sum, s) => sum + s.proportion, 0);
    expect(total).toBeCloseTo(1.0, 10);
    stats.forEach(s => expect(s.proportion).toBeCloseTo(0.5, 10));
  });

  it('handles .R extension case-sensitively', () => {
    const files = [file('analysis.R'), file('script.r')];
    const stats = detectLanguageStats(files);
    expect(stats).toHaveLength(1);
    expect(stats[0].name).toBe('R');
    expect(stats[0].fileCount).toBe(2);
  });
});
