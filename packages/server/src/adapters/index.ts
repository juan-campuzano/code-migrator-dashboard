// Source adapters: LocalFilesystemAdapter, GitHubAdapter, AzureDevOpsAdapter
export { classifyUrl, type UrlClassification } from './urlClassifier';
export { LocalFilesystemAdapter } from './LocalFilesystemAdapter';
export { GitHubAdapter, GitHubApiError } from './GitHubAdapter';
export { AzureDevOpsAdapter, AzureDevOpsApiError } from './AzureDevOpsAdapter';
