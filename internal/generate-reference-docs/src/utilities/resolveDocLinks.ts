import type {Declaration, ImportReference, MemberInfo} from '../types.ts';
import {isPublicMember} from './isPublicMember.ts';
import {toDocFileName} from './toDocFileName.ts';

/**
 * An anchor target for link resolution.
 */
interface AnchorTarget {
  /** The full link href (e.g. `#configurationfreeze` or `../error/docs/references/README.md#assistanterror`). */
  anchor: string;
  /** Display label (e.g. `freeze()`, `Configuration`). */
  label: string;
}

/**
 * Resolves `{@link ...}` references in a single declaration's markdown.
 *
 * Resolution order for each reference:
 * 1. Current declaration's own members (unqualified only)
 * 2. All declarations on the same page
 * 3. External imports from other `@olavoasantos/*` packages
 *
 * @param markdown - The rendered markdown for a single declaration.
 * @param currentDecl - The declaration this markdown belongs to.
 * @param allDeclarations - All declarations on the page for cross-references.
 * @param externalIndex - Map of imported names to cross-package link targets.
 * @returns The markdown with resolved links.
 */
export function resolveDocLinks(
  markdown: string,
  currentDecl: Declaration,
  allDeclarations: Declaration[],
  externalIndex: Map<string, AnchorTarget>,
): string {
  const localIndex = buildMemberIndex(currentDecl);
  const globalIndex = buildGlobalIndex(allDeclarations);

  return markdown.replace(/\{@link\s+([^}]+)\}/g, (_match, ref: string) => {
    const trimmed = ref.trim();

    // Qualified reference: "Configuration.freeze"
    if (trimmed.includes('.')) {
      const target = resolveReference(trimmed, globalIndex);
      if (target) return `[\`${target.label}\`](${target.anchor})`;
    } else {
      // Unqualified: try current declaration's members first
      const local = resolveReference(trimmed, localIndex);
      if (local) return `[\`${local.label}\`](${local.anchor})`;

      // Fall back to global (declaration names, other declarations' members)
      const global = resolveReference(trimmed, globalIndex);
      if (global) return `[\`${global.label}\`](${global.anchor})`;
    }

    // Fall back to external imports
    const external = resolveReference(trimmed, externalIndex);
    if (external) return `[\`${external.label}\`](${external.anchor})`;

    return `\`${trimmed}\``;
  });
}

/**
 * Builds an external link index from imports across all files
 * that contribute to a page.
 *
 * Maps imported names from `@olavoasantos/*` packages to relative
 * paths pointing to the target package's reference documentation.
 *
 * @param imports - All imports from files contributing to this page.
 * @param currentPackageName - The current package's npm name.
 * @returns A map of imported names to cross-package link targets.
 */
export function buildExternalIndex(
  imports: ImportReference[],
  currentPackageName: string,
): Map<string, AnchorTarget> {
  const index = new Map<string, AnchorTarget>();
  const scope = packageScope(currentPackageName);
  if (!scope) return index;

  for (const imp of imports) {
    if (!imp.source.startsWith(scope)) continue;
    // Skip namespace imports like `import * as Contracts`
    if (imp.originalName === '*') continue;

    const resolvedName = imp.originalName !== 'default' ? imp.originalName : imp.name;
    const href = buildExternalHref(imp.source, scope, resolvedName);
    if (href) {
      index.set(imp.name, {anchor: href, label: resolvedName});
    }
  }

  return index;
}

/**
 * Builds an index of the current declaration's own members.
 *
 * Used for resolving unqualified references like `{@link set}` within
 * a declaration's own docblocks.
 */
function buildMemberIndex(decl: Declaration): Map<string, AnchorTarget> {
  const index = new Map<string, AnchorTarget>();
  const publicMembers = (decl.members ?? []).filter(isPublicMember);

  for (const m of publicMembers) {
    const anchor = toAnchor(scopedMemberHeadingLabel(decl.name, m));
    const label = memberDisplayLabel(m);
    index.set(m.name, {anchor: `#${anchor}`, label});
  }

  return index;
}

/**
 * Builds a global index of all declarations and their members.
 *
 * Indexes:
 * - Declaration names: `"Configuration"` → `#configuration`
 * - Qualified members: `"Configuration.get"` → `#configurationget`
 * - Unqualified members: `"get"` → first declaration's `get` (for pages
 *   with a single declaration)
 */
function buildGlobalIndex(declarations: Declaration[]): Map<string, AnchorTarget> {
  const index = new Map<string, AnchorTarget>();

  for (const decl of declarations) {
    const declAnchor = toAnchor(declHeadingLabel(decl));
    const declLabel = decl.kind === 'function' ? `${decl.name}()` : decl.name;
    index.set(decl.name, {anchor: `#${declAnchor}`, label: declLabel});

    const publicMembers = (decl.members ?? []).filter(isPublicMember);
    for (const m of publicMembers) {
      const anchor = toAnchor(scopedMemberHeadingLabel(decl.name, m));
      const label = memberDisplayLabel(m);
      const target: AnchorTarget = {anchor: `#${anchor}`, label};

      // Qualified: "Configuration.get"
      index.set(`${decl.name}.${m.name}`, target);

      // Unqualified fallback (first declaration wins)
      if (!index.has(m.name)) {
        index.set(m.name, target);
      }
    }
  }

  return index;
}

/**
 * Resolves a reference string against an anchor index.
 *
 * Tries exact match first, then case-insensitive.
 */
function resolveReference(ref: string, index: Map<string, AnchorTarget>): AnchorTarget | null {
  const exact = index.get(ref);
  if (exact) return exact;

  const lower = ref.toLowerCase();
  for (const [key, target] of index) {
    if (key.toLowerCase() === lower) return target;
  }

  return null;
}

/**
 * Converts a heading label to a GitHub-style markdown anchor.
 */
export function toAnchor(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Produces the heading label for a declaration.
 */
function declHeadingLabel(decl: Declaration): string {
  return decl.kind === 'function' ? `${decl.name}()` : decl.name;
}

/**
 * Produces the scoped heading label for a member, including
 * the parent declaration name to ensure unique anchors.
 *
 * E.g. `Configuration.freeze()`, `Event.type`.
 */
export function scopedMemberHeadingLabel(parentName: string, m: MemberInfo): string {
  switch (m.kind) {
    case 'method':
    case 'constructor':
      return m.static ? `${parentName} static ${m.name}()` : `${parentName}.${m.name}()`;
    case 'getter':
      return `${parentName}.${m.name}`;
    case 'setter':
      return `${parentName}.${m.name}`;
    case 'call-signature':
      return `${parentName}()`;
    case 'construct-signature':
      return `${parentName}.new()`;
    default:
      return m.static ? `${parentName} static ${m.name}` : `${parentName}.${m.name}`;
  }
}

/**
 * Produces the display label for a member in resolved links.
 */
function memberDisplayLabel(m: MemberInfo): string {
  switch (m.kind) {
    case 'method':
    case 'constructor':
      return `${m.name}()`;
    case 'getter':
    case 'setter':
      return m.name;
    default:
      return m.name;
  }
}

/**
 * Extracts the scope prefix from a package name.
 *
 * E.g. `@olavoasantos/error` → `@olavoasantos/`.
 * Returns `null` for unscoped packages.
 */
function packageScope(packageName: string): string | null {
  const scopeEnd = packageName.indexOf('/');
  if (!packageName.startsWith('@') || scopeEnd === -1) return null;
  return packageName.slice(0, scopeEnd + 1);
}

/**
 * Builds a relative href from the current package's docs to
 * an imported name in another package's reference docs.
 *
 * The href is relative from `packages/X/docs/references/` to
 * `packages/Y/docs/references/FILE.md#anchor`.
 */
function buildExternalHref(source: string, scope: string, exportedName: string): string | null {
  const withoutScope = source.slice(scope.length);
  const parts = withoutScope.split('/');
  const pkgDir = parts[0];
  if (!pkgDir) return null;

  // Determine subpath: "@scope/pkg/sub/path" → "./sub/path"
  const subpath = parts.length > 1 ? `./${parts.slice(1).join('/')}` : '.';
  const docFile = toDocFileName(subpath);
  const anchor = toAnchor(exportedName);

  return `../../../${pkgDir}/docs/references/${docFile}#${anchor}`;
}
