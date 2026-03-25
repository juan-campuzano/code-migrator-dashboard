import { FileEntry, Technology } from '../models/types';

/**
 * Language detection result with file count and proportion data.
 */
export interface LanguageStats {
  name: string;
  fileCount: number;
  proportion: number;
}

/**
 * Maps file extensions to programming language names.
 * Keys are lowercase extensions (with leading dot), except .R which is case-sensitive.
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.py': 'Python',
  '.java': 'Java',
  '.rs': 'Rust',
  '.go': 'Go',
  '.rb': 'Ruby',
  '.cs': 'C#',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.cxx': 'C++',
  '.c++': 'C++',
  '.c': 'C',
  '.h': 'C',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  '.scala': 'Scala',
  '.php': 'PHP',
  '.dart': 'Dart',
  '.ex': 'Elixir',
  '.exs': 'Elixir',
  '.hs': 'Haskell',
  '.lua': 'Lua',
  '.r': 'R',
  '.R': 'R',
  '.m': 'Objective-C',
  '.pl': 'Perl',
  '.pm': 'Perl',
  '.sh': 'Shell',
  '.bash': 'Shell',
};

/**
 * Extracts the file extension from a path.
 * Returns empty string if no extension found.
 */
function getExtension(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  const filename = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0) return '';
  const ext = filename.slice(dotIndex);
  // .R is case-sensitive; all others are lowercased
  if (ext === '.R') return '.R';
  return ext.toLowerCase();
}

/**
 * Detects programming languages from file entries and returns detailed stats
 * including file count and proportion per language.
 * Only counts files (not directories). Skips unrecognized extensions silently.
 */
export function detectLanguageStats(files: FileEntry[]): LanguageStats[] {
  const languageCounts = new Map<string, number>();
  let totalRecognized = 0;

  for (const entry of files) {
    if (entry.type !== 'file') continue;

    const ext = getExtension(entry.path);
    if (!ext) continue;

    const language = EXTENSION_TO_LANGUAGE[ext];
    if (!language) continue;

    languageCounts.set(language, (languageCounts.get(language) || 0) + 1);
    totalRecognized++;
  }

  if (totalRecognized === 0) return [];

  return Array.from(languageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, fileCount]) => ({
      name,
      fileCount,
      proportion: fileCount / totalRecognized,
    }));
}

/**
 * Detects programming languages from file entries and returns Technology objects.
 * Only counts files (not directories). Skips unrecognized extensions silently.
 * Returns Technology objects with type: 'language', sorted by file count descending.
 */
export function detectLanguages(files: FileEntry[]): Technology[] {
  return detectLanguageStats(files).map(({ name }) => ({
    name,
    type: 'language' as const,
  }));
}
