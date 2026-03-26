import { LanguageDistributionEntry, RepositoryLanguage } from '../models/types';

export function aggregateLanguages(
  repoLanguages: RepositoryLanguage[][]
): LanguageDistributionEntry[] {
  const counts = new Map<string, number>();

  for (const repoLangs of repoLanguages) {
    for (const lang of repoLangs) {
      counts.set(lang.language, (counts.get(lang.language) ?? 0) + lang.fileCount);
    }
  }

  const totalFileCount = Array.from(counts.values()).reduce((sum, c) => sum + c, 0);

  if (totalFileCount === 0) {
    return [];
  }

  return Array.from(counts.entries())
    .map(([language, totalFiles]) => ({
      language,
      totalFileCount: totalFiles,
      proportion: totalFiles / totalFileCount,
    }))
    .sort((a, b) => b.totalFileCount - a.totalFileCount);
}
