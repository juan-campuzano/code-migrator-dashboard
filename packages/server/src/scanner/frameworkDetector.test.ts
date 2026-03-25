import { describe, it, expect } from 'vitest';
import { detectFrameworks } from './frameworkDetector';
import { ParsedDependency } from '../models/types';

describe('detectFrameworks', () => {
  it('returns empty array when no dependencies match known frameworks', () => {
    const deps: ParsedDependency[] = [
      { name: 'lodash', dependencyType: 'production' },
      { name: 'chalk', versionConstraint: '^5.0.0', dependencyType: 'production' },
    ];
    expect(detectFrameworks(deps)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(detectFrameworks([])).toEqual([]);
  });

  // npm frameworks
  it('detects React from npm dependencies', () => {
    const deps: ParsedDependency[] = [
      { name: 'react', versionConstraint: '^18.2.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'React', type: 'framework', version: '^18.2.0' }]);
  });

  it('detects Angular from @angular/core', () => {
    const deps: ParsedDependency[] = [
      { name: '@angular/core', versionConstraint: '~16.0.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Angular', type: 'framework', version: '~16.0.0' }]);
  });

  it('detects Vue.js', () => {
    const deps: ParsedDependency[] = [
      { name: 'vue', versionConstraint: '^3.3.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Vue.js', type: 'framework', version: '^3.3.0' }]);
  });

  it('detects Next.js', () => {
    const deps: ParsedDependency[] = [
      { name: 'next', versionConstraint: '13.4.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Next.js', type: 'framework', version: '13.4.0' }]);
  });

  it('detects Express', () => {
    const deps: ParsedDependency[] = [
      { name: 'express', versionConstraint: '^4.18.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Express', type: 'framework', version: '^4.18.0' }]);
  });

  it('detects NestJS from @nestjs/core', () => {
    const deps: ParsedDependency[] = [
      { name: '@nestjs/core', versionConstraint: '^10.0.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'NestJS', type: 'framework', version: '^10.0.0' }]);
  });

  it('detects NestJS from nestjs', () => {
    const deps: ParsedDependency[] = [
      { name: 'nestjs', versionConstraint: '^9.0.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'NestJS', type: 'framework', version: '^9.0.0' }]);
  });

  it('detects Svelte', () => {
    const deps: ParsedDependency[] = [
      { name: 'svelte', versionConstraint: '^4.0.0', dependencyType: 'development' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Svelte', type: 'framework', version: '^4.0.0' }]);
  });

  // pip frameworks
  it('detects Django', () => {
    const deps: ParsedDependency[] = [
      { name: 'django', versionConstraint: '>=4.2', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Django', type: 'framework', version: '>=4.2' }]);
  });

  it('detects Flask', () => {
    const deps: ParsedDependency[] = [
      { name: 'flask', versionConstraint: '>=2.3.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Flask', type: 'framework', version: '>=2.3.0' }]);
  });

  it('detects FastAPI', () => {
    const deps: ParsedDependency[] = [
      { name: 'fastapi', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'FastAPI', type: 'framework' }]);
  });

  it('detects Tornado', () => {
    const deps: ParsedDependency[] = [
      { name: 'tornado', versionConstraint: '>=6.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Tornado', type: 'framework', version: '>=6.0' }]);
  });

  it('detects Pyramid', () => {
    const deps: ParsedDependency[] = [
      { name: 'pyramid', versionConstraint: '>=2.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Pyramid', type: 'framework', version: '>=2.0' }]);
  });

  // maven frameworks
  it('detects Spring Boot from spring-core', () => {
    const deps: ParsedDependency[] = [
      { name: 'org.springframework:spring-core', versionConstraint: '5.3.20', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Spring Boot', type: 'framework', version: '5.3.20' }]);
  });

  it('detects Spring Boot from spring-boot', () => {
    const deps: ParsedDependency[] = [
      { name: 'org.springframework.boot:spring-boot', versionConstraint: '3.1.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Spring Boot', type: 'framework', version: '3.1.0' }]);
  });

  it('detects Quarkus', () => {
    const deps: ParsedDependency[] = [
      { name: 'io.quarkus:quarkus-core', versionConstraint: '3.2.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Quarkus', type: 'framework', version: '3.2.0' }]);
  });

  // cargo frameworks
  it('detects Actix Web', () => {
    const deps: ParsedDependency[] = [
      { name: 'actix-web', versionConstraint: '4', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Actix Web', type: 'framework', version: '4' }]);
  });

  it('detects Rocket', () => {
    const deps: ParsedDependency[] = [
      { name: 'rocket', versionConstraint: '0.5', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Rocket', type: 'framework', version: '0.5' }]);
  });

  it('detects Axum', () => {
    const deps: ParsedDependency[] = [
      { name: 'axum', versionConstraint: '0.6', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Axum', type: 'framework', version: '0.6' }]);
  });

  // rubygems frameworks
  it('detects Ruby on Rails', () => {
    const deps: ParsedDependency[] = [
      { name: 'rails', versionConstraint: '~> 7.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Ruby on Rails', type: 'framework', version: '~> 7.0' }]);
  });

  it('detects Sinatra', () => {
    const deps: ParsedDependency[] = [
      { name: 'sinatra', versionConstraint: '~> 3.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Sinatra', type: 'framework', version: '~> 3.0' }]);
  });

  // go frameworks (module path matching)
  it('detects Gin from Go module path', () => {
    const deps: ParsedDependency[] = [
      { name: 'github.com/gin-gonic/gin', versionConstraint: 'v1.9.1', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Gin', type: 'framework', version: 'v1.9.1' }]);
  });

  it('detects Gorilla Mux from Go module path', () => {
    const deps: ParsedDependency[] = [
      { name: 'github.com/gorilla/mux', versionConstraint: 'v1.8.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Gorilla Mux', type: 'framework', version: 'v1.8.0' }]);
  });

  it('detects Echo from Go module path', () => {
    const deps: ParsedDependency[] = [
      { name: 'github.com/labstack/echo', versionConstraint: 'v4.11.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Echo', type: 'framework', version: 'v4.11.0' }]);
  });

  // deduplication
  it('deduplicates frameworks when multiple deps map to the same framework', () => {
    const deps: ParsedDependency[] = [
      { name: 'org.springframework:spring-core', versionConstraint: '5.3.20', dependencyType: 'production' },
      { name: 'org.springframework.boot:spring-boot', versionConstraint: '3.1.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Spring Boot');
  });

  it('prefers version from first matching dependency but fills in missing version', () => {
    const deps: ParsedDependency[] = [
      { name: 'org.springframework:spring-core', dependencyType: 'production' },
      { name: 'org.springframework.boot:spring-boot', versionConstraint: '3.1.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Spring Boot', type: 'framework', version: '3.1.0' });
  });

  it('deduplicates NestJS from nestjs and @nestjs/core', () => {
    const deps: ParsedDependency[] = [
      { name: 'nestjs', versionConstraint: '^9.0.0', dependencyType: 'production' },
      { name: '@nestjs/core', versionConstraint: '^10.0.0', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('NestJS');
  });

  // multiple frameworks
  it('detects multiple frameworks from mixed dependencies', () => {
    const deps: ParsedDependency[] = [
      { name: 'react', versionConstraint: '^18.0.0', dependencyType: 'production' },
      { name: 'express', versionConstraint: '^4.18.0', dependencyType: 'production' },
      { name: 'lodash', versionConstraint: '^4.17.0', dependencyType: 'production' },
      { name: 'typescript', versionConstraint: '^5.0.0', dependencyType: 'development' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toHaveLength(2);
    const names = result.map((t) => t.name);
    expect(names).toContain('React');
    expect(names).toContain('Express');
  });

  // version handling
  it('omits version property when versionConstraint is undefined', () => {
    const deps: ParsedDependency[] = [
      { name: 'flask', dependencyType: 'production' },
    ];
    const result = detectFrameworks(deps);
    expect(result).toEqual([{ name: 'Flask', type: 'framework' }]);
    expect(result[0]).not.toHaveProperty('version');
  });
});
