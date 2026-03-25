import { describe, it, expect } from 'vitest';
import { classifyUrl } from './urlClassifier';

describe('classifyUrl', () => {
  describe('GitHub URLs', () => {
    it('classifies a standard GitHub URL', () => {
      const result = classifyUrl('https://github.com/facebook/react');
      expect(result).toEqual({ type: 'github', owner: 'facebook', repo: 'react' });
    });

    it('strips trailing .git', () => {
      const result = classifyUrl('https://github.com/owner/repo.git');
      expect(result).toEqual({ type: 'github', owner: 'owner', repo: 'repo' });
    });

    it('strips trailing slash', () => {
      const result = classifyUrl('https://github.com/owner/repo/');
      expect(result).toEqual({ type: 'github', owner: 'owner', repo: 'repo' });
    });

    it('handles owner and repo with hyphens and dots', () => {
      const result = classifyUrl('https://github.com/my-org/my-repo.js');
      expect(result).toEqual({ type: 'github', owner: 'my-org', repo: 'my-repo.js' });
    });
  });

  describe('Azure DevOps URLs', () => {
    it('classifies a standard Azure DevOps URL', () => {
      const result = classifyUrl('https://dev.azure.com/myorg/myproject/_git/myrepo');
      expect(result).toEqual({ type: 'azure_devops', org: 'myorg', project: 'myproject', repo: 'myrepo' });
    });

    it('strips trailing .git from Azure DevOps URL', () => {
      const result = classifyUrl('https://dev.azure.com/org/proj/_git/repo.git');
      expect(result).toEqual({ type: 'azure_devops', org: 'org', project: 'proj', repo: 'repo' });
    });

    it('strips trailing slash from Azure DevOps URL', () => {
      const result = classifyUrl('https://dev.azure.com/org/proj/_git/repo/');
      expect(result).toEqual({ type: 'azure_devops', org: 'org', project: 'proj', repo: 'repo' });
    });
  });

  describe('unsupported URLs', () => {
    it('throws for a Bitbucket URL', () => {
      expect(() => classifyUrl('https://bitbucket.org/owner/repo')).toThrow(
        /Unsupported repository URL.*Supported providers.*GitHub.*Azure DevOps/
      );
    });

    it('throws for a GitLab URL', () => {
      expect(() => classifyUrl('https://gitlab.com/owner/repo')).toThrow(
        /Unsupported repository URL/
      );
    });

    it('throws for a random URL', () => {
      expect(() => classifyUrl('https://example.com/something')).toThrow(
        /Supported providers/
      );
    });

    it('throws for an HTTP GitHub URL (not HTTPS)', () => {
      expect(() => classifyUrl('http://github.com/owner/repo')).toThrow(
        /Unsupported repository URL/
      );
    });

    it('throws for a GitHub URL with extra path segments', () => {
      expect(() => classifyUrl('https://github.com/owner/repo/tree/main')).toThrow(
        /Unsupported repository URL/
      );
    });
  });
});
