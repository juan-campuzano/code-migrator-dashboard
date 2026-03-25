export type UrlClassification =
  | { type: 'github'; owner: string; repo: string }
  | { type: 'azure_devops'; org: string; project: string; repo: string };

const GITHUB_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(\.git)?\/?$/;
const AZURE_DEVOPS_PATTERN = /^https:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+?)(\.git)?\/?$/;

const SUPPORTED_PROVIDERS = ['GitHub (https://github.com/{owner}/{repo})', 'Azure DevOps (https://dev.azure.com/{org}/{project}/_git/{repo})'];

export function classifyUrl(url: string): UrlClassification {
  const githubMatch = url.match(GITHUB_PATTERN);
  if (githubMatch) {
    return { type: 'github', owner: githubMatch[1], repo: githubMatch[2] };
  }

  const azureMatch = url.match(AZURE_DEVOPS_PATTERN);
  if (azureMatch) {
    return { type: 'azure_devops', org: azureMatch[1], project: azureMatch[2], repo: azureMatch[3] };
  }

  throw new Error(
    `Unsupported repository URL. Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`
  );
}
