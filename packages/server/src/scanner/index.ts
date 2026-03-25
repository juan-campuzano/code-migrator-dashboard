// Repository scanner: language detection, framework detection, orchestration
export { detectLanguages, detectLanguageStats } from './languageDetector';
export type { LanguageStats } from './languageDetector';
export { detectFrameworks } from './frameworkDetector';
export { RepositoryScanner } from './RepositoryScanner';
