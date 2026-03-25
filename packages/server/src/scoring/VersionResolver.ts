// =============================================================================
// VersionResolver — extracts concrete minimum versions from version constraints
// =============================================================================

export interface ResolvedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

export interface VersionResolveResult {
  resolved: ResolvedVersion | null;
  unpinned: boolean;
  warning?: string;
}

/**
 * Parse a semver-like version string into its components.
 * Accepts optional leading `v` or `=` prefix.
 */
function parseSemver(raw: string): ResolvedVersion | null {
  const trimmed = raw.trim().replace(/^[v=]+/, '');
  const match = trimmed.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-(.+))?$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: match[2] !== undefined ? parseInt(match[2], 10) : 0,
    patch: match[3] !== undefined ? parseInt(match[3], 10) : 0,
    prerelease: match[4] || undefined,
  };
}

// ---------------------------------------------------------------------------
// npm / cargo — semver ranges
// ---------------------------------------------------------------------------

function resolveNpmCargo(constraint: string): VersionResolveResult {
  const trimmed = constraint.trim();

  // Handle exact version: 1.2.3
  if (/^\d+(\.\d+)*(-[\w.]+)?$/.test(trimmed)) {
    const v = parseSemver(trimmed);
    if (v) return { resolved: v, unpinned: false };
  }

  // Handle ^, ~, >=, =, v prefixes — extract the version that follows
  const prefixMatch = trimmed.match(/^(?:[~^>=v]+\s*)(\d+(?:\.\d+)*(?:-[\w.]+)?)/);
  if (prefixMatch) {
    const v = parseSemver(prefixMatch[1]);
    if (v) return { resolved: v, unpinned: false };
  }

  // Handle range: >=1.0.0 <2.0.0 — take the lower bound
  const rangeMatch = trimmed.match(/>=?\s*(\d+(?:\.\d+)*(?:-[\w.]+)?)/);
  if (rangeMatch) {
    const v = parseSemver(rangeMatch[1]);
    if (v) return { resolved: v, unpinned: false };
  }

  // Handle hyphen range: 1.0.0 - 2.0.0 — take the lower bound
  const hyphenMatch = trimmed.match(/^(\d+(?:\.\d+)*(?:-[\w.]+)?)\s+-\s+/);
  if (hyphenMatch) {
    const v = parseSemver(hyphenMatch[1]);
    if (v) return { resolved: v, unpinned: false };
  }

  // Handle || (union) — take the first range
  if (trimmed.includes('||')) {
    const first = trimmed.split('||')[0].trim();
    if (first) return resolveNpmCargo(first);
  }

  // Wildcard: * or x
  if (/^[*x]$/i.test(trimmed)) {
    return { resolved: null, unpinned: true };
  }

  return { resolved: null, unpinned: false, warning: `Unable to parse npm/cargo constraint: "${constraint}"` };
}

// ---------------------------------------------------------------------------
// pypi — PEP 440
// ---------------------------------------------------------------------------

function resolvePypi(constraint: string): VersionResolveResult {
  const trimmed = constraint.trim();

  // Exact version: ==1.2.3
  const exactMatch = trimmed.match(/^==\s*(\d+(?:\.\d+)*(?:[\w.]*)?)/);
  if (exactMatch) {
    const v = parseSemver(exactMatch[1]);
    if (v) return { resolved: v, unpinned: false };
  }

  // Plain version without operator: 1.2.3
  if (/^\d+(\.\d+)*$/.test(trimmed)) {
    const v = parseSemver(trimmed);
    if (v) return { resolved: v, unpinned: false };
  }

  // Compatible release: ~=3.4 → 3.4.0
  const compatMatch = trimmed.match(/^~=\s*(\d+(?:\.\d+)*)/);
  if (compatMatch) {
    const v = parseSemver(compatMatch[1]);
    if (v) return { resolved: v, unpinned: false };
  }

  // Range with >= as lower bound: >=1.0,<2.0 or >=1.0
  const gteMatch = trimmed.match(/>=\s*(\d+(?:\.\d+)*)/);
  if (gteMatch) {
    const v = parseSemver(gteMatch[1]);
    if (v) return { resolved: v, unpinned: false };
  }

  // Greater than: >1.0
  const gtMatch = trimmed.match(/^>\s*(\d+(?:\.\d+)*)/);
  if (gtMatch) {
    const v = parseSemver(gtMatch[1]);
    if (v) return { resolved: v, unpinned: false };
  }

  // Wildcard: *
  if (trimmed === '*') {
    return { resolved: null, unpinned: true };
  }

  return { resolved: null, unpinned: false, warning: `Unable to parse pypi constraint: "${constraint}"` };
}

// ---------------------------------------------------------------------------
// maven — version ranges and plain versions
// ---------------------------------------------------------------------------

function resolveMaven(constraint: string): VersionResolveResult {
  const trimmed = constraint.trim();

  // Plain version: 1.2.3
  if (/^\d+(\.\d+)*(-[\w.]+)?$/.test(trimmed)) {
    const v = parseSemver(trimmed);
    if (v) return { resolved: v, unpinned: false };
  }

  // Range: [1.2,2.0) or [1.2,) or (,2.0] etc.
  const rangeMatch = trimmed.match(/^[\[(]\s*([^,]*)\s*,\s*([^)\]]*)\s*[)\]]$/);
  if (rangeMatch) {
    const lower = rangeMatch[1].trim();
    if (lower) {
      const v = parseSemver(lower);
      if (v) return { resolved: v, unpinned: false };
    }
    // Open lower bound like (,2.0] — unpinned
    return { resolved: null, unpinned: true };
  }

  // Exact range: [1.2.3]
  const exactRange = trimmed.match(/^\[\s*(\d+(?:\.\d+)*(?:-[\w.]+)?)\s*\]$/);
  if (exactRange) {
    const v = parseSemver(exactRange[1]);
    if (v) return { resolved: v, unpinned: false };
  }

  return { resolved: null, unpinned: false, warning: `Unable to parse maven constraint: "${constraint}"` };
}

// ---------------------------------------------------------------------------
// rubygems — pessimistic constraints
// ---------------------------------------------------------------------------

function resolveRubygems(constraint: string): VersionResolveResult {
  const trimmed = constraint.trim();

  // Exact version: 1.2.3
  if (/^\d+(\.\d+)*(-[\w.]+)?$/.test(trimmed)) {
    const v = parseSemver(trimmed);
    if (v) return { resolved: v, unpinned: false };
  }

  // Pessimistic: ~> 1.2
  const pessimisticMatch = trimmed.match(/^~>\s*(\d+(?:\.\d+)*)/);
  if (pessimisticMatch) {
    const v = parseSemver(pessimisticMatch[1]);
    if (v) return { resolved: v, unpinned: false };
  }

  // Range with >=: >= 1.0, < 2.0
  const gteMatch = trimmed.match(/>=\s*(\d+(?:\.\d+)*)/);
  if (gteMatch) {
    const v = parseSemver(gteMatch[1]);
    if (v) return { resolved: v, unpinned: false };
  }

  // Exact with =: = 1.2.3
  const eqMatch = trimmed.match(/^=\s*(\d+(?:\.\d+)*)/);
  if (eqMatch) {
    const v = parseSemver(eqMatch[1]);
    if (v) return { resolved: v, unpinned: false };
  }

  return { resolved: null, unpinned: false, warning: `Unable to parse rubygems constraint: "${constraint}"` };
}

// ---------------------------------------------------------------------------
// go — module versions (v-prefix, pseudo-versions)
// ---------------------------------------------------------------------------

function resolveGo(constraint: string): VersionResolveResult {
  const trimmed = constraint.trim();

  // Go pseudo-version: v0.0.0-20210101000000-abcdef123456
  // Format: vX.Y.Z-yyyymmddhhmmss-abcdefabcdef
  // The base version is the part before the timestamp
  const pseudoMatch = trimmed.match(
    /^v?(\d+)\.(\d+)\.(\d+)-(\d{14})-[0-9a-f]{12}$/
  );
  if (pseudoMatch) {
    return {
      resolved: {
        major: parseInt(pseudoMatch[1], 10),
        minor: parseInt(pseudoMatch[2], 10),
        patch: parseInt(pseudoMatch[3], 10),
      },
      unpinned: false,
    };
  }

  // Standard go version: v1.2.3 or v1.2.3-pre
  const stripped = trimmed.replace(/^v/, '');
  const v = parseSemver(stripped);
  if (v) return { resolved: v, unpinned: false };

  return { resolved: null, unpinned: false, warning: `Unable to parse go constraint: "${constraint}"` };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Resolve a version constraint to a concrete minimum version.
 *
 * Returns `{ resolved: null, unpinned: true }` for empty/undefined constraints.
 * Returns `{ resolved: null, warning: "..." }` for unparseable constraints.
 */
export function resolveVersion(
  ecosystem: string,
  constraint: string | undefined,
): VersionResolveResult {
  if (constraint === undefined || constraint === null || constraint.trim() === '') {
    return { resolved: null, unpinned: true };
  }

  const eco = ecosystem.toLowerCase();

  switch (eco) {
    case 'npm':
    case 'cargo':
      return resolveNpmCargo(constraint);
    case 'pypi':
      return resolvePypi(constraint);
    case 'maven':
    case 'gradle':
      return resolveMaven(constraint);
    case 'rubygems':
      return resolveRubygems(constraint);
    case 'go':
      return resolveGo(constraint);
    default:
      return {
        resolved: null,
        unpinned: false,
        warning: `Unsupported ecosystem: "${ecosystem}"`,
      };
  }
}