import { describe, it, expect } from 'vitest';
import { GemfileParser } from './GemfileParser';

describe('GemfileParser', () => {
  const parser = new GemfileParser();

  it('should have correct filenames and ecosystem', () => {
    expect(parser.filenames).toEqual(['Gemfile']);
    const result = parser.parse('');
    expect(result.ecosystem).toBe('rubygems');
  });

  it('should extract gems with version constraints', () => {
    const content = `
gem 'rails', '~> 7.0'
gem 'pg', '>= 1.0'
`;
    const result = parser.parse(content);

    expect(result.dependencies).toEqual([
      { name: 'rails', versionConstraint: '~> 7.0', dependencyType: 'production' },
      { name: 'pg', versionConstraint: '>= 1.0', dependencyType: 'production' },
    ]);
    expect(result.errors).toHaveLength(0);
  });

  it('should extract gems without version constraints', () => {
    const content = `gem 'nokogiri'`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]).toEqual({
      name: 'nokogiri',
      versionConstraint: undefined,
      dependencyType: 'production',
    });
  });

  it('should handle double-quoted gem names', () => {
    const content = `gem "puma", "~> 5.0"`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]).toEqual({
      name: 'puma',
      versionConstraint: '~> 5.0',
      dependencyType: 'production',
    });
  });

  it('should classify gems in development group as development', () => {
    const content = `
gem 'rails', '~> 7.0'

group :development do
  gem 'pry'
  gem 'better_errors'
end
`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(3);
    expect(result.dependencies[0]).toEqual({
      name: 'rails',
      versionConstraint: '~> 7.0',
      dependencyType: 'production',
    });
    expect(result.dependencies[1]).toEqual({
      name: 'pry',
      versionConstraint: undefined,
      dependencyType: 'development',
    });
    expect(result.dependencies[2]).toEqual({
      name: 'better_errors',
      versionConstraint: undefined,
      dependencyType: 'development',
    });
  });

  it('should classify gems in test group as development', () => {
    const content = `
group :test do
  gem 'rspec', '~> 3.12'
end
`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].dependencyType).toBe('development');
  });

  it('should classify gems in combined development/test group as development', () => {
    const content = `
group :development, :test do
  gem 'rspec-rails'
  gem 'factory_bot_rails'
end
`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies.every((d) => d.dependencyType === 'development')).toBe(true);
  });

  it('should classify gems in non-dev groups as production', () => {
    const content = `
group :production do
  gem 'unicorn'
end
`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].dependencyType).toBe('production');
  });

  it('should handle multiple version constraints', () => {
    const content = `gem 'activerecord', '>= 5.0', '< 7.0'`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]).toEqual({
      name: 'activerecord',
      versionConstraint: '>= 5.0, < 7.0',
      dependencyType: 'production',
    });
  });

  it('should skip comments and blank lines', () => {
    const content = `
# This is a comment
source 'https://rubygems.org'

# Another comment
gem 'rails', '~> 7.0'

# gem 'commented_out'
`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].name).toBe('rails');
  });

  it('should handle empty content', () => {
    const result = parser.parse('');

    expect(result.ecosystem).toBe('rubygems');
    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle content with no gem declarations', () => {
    const content = `
source 'https://rubygems.org'
ruby '3.1.0'
`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle a realistic Gemfile', () => {
    const content = `
source 'https://rubygems.org'
ruby '3.1.0'

gem 'rails', '~> 7.0.4'
gem 'pg', '~> 1.4'
gem 'puma', '~> 5.0'
gem 'redis', '~> 5.0'
gem 'sidekiq'

group :development, :test do
  gem 'rspec-rails', '~> 6.0'
  gem 'factory_bot_rails'
end

group :development do
  gem 'web-console'
end

group :test do
  gem 'capybara'
  gem 'selenium-webdriver'
end
`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(10);
    expect(result.errors).toHaveLength(0);

    const prodDeps = result.dependencies.filter((d) => d.dependencyType === 'production');
    const devDeps = result.dependencies.filter((d) => d.dependencyType === 'development');

    expect(prodDeps).toHaveLength(5);
    expect(devDeps).toHaveLength(5);

    expect(prodDeps.map((d) => d.name)).toEqual(['rails', 'pg', 'puma', 'redis', 'sidekiq']);
    expect(devDeps.map((d) => d.name)).toEqual([
      'rspec-rails',
      'factory_bot_rails',
      'web-console',
      'capybara',
      'selenium-webdriver',
    ]);
  });

  it('should handle gems with extra options after version', () => {
    const content = `gem 'pg', '~> 1.4', require: false`;
    const result = parser.parse(content);

    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]).toEqual({
      name: 'pg',
      versionConstraint: '~> 1.4',
      dependencyType: 'production',
    });
  });
});
