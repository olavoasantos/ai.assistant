import type {Declaration, DocBlock, MemberInfo} from '../types.ts';
import {isPublicMember} from './isPublicMember.ts';
import {renderMemberSignature} from './renderMemberSignature.ts';
import {renderSignature} from './renderSignature.ts';
import {scopedMemberHeadingLabel} from './resolveDocLinks.ts';

/**
 * Renders a single declaration as a markdown section.
 *
 * For declarations with members (classes, interfaces, enums), each
 * public member gets its own subsection with full docblock content
 * including description, parameters, returns, throws, templates,
 * and examples.
 *
 * @param decl - The declaration to render.
 * @returns Markdown string for the declaration.
 */
export function renderDeclarationMarkdown(decl: Declaration): string {
  const parts: string[] = [];
  const heading = decl.kind === 'function' ? `### \`${decl.name}()\`` : `### \`${decl.name}\``;

  parts.push('');
  parts.push(heading);
  parts.push('');
  parts.push(`> ${decl.kind}`);

  if (decl.docblock?.summary) {
    parts.push('');
    parts.push(decl.docblock.summary);
  }

  parts.push('');
  parts.push('```ts');
  parts.push(renderSignature(decl));
  parts.push('```');

  renderDocBlockBody(parts, decl.docblock);

  const publicMembers = (decl.members ?? []).filter(isPublicMember);
  if (publicMembers.length > 0) {
    parts.push('');
    parts.push('#### Members');

    for (const m of publicMembers) {
      renderMemberSection(parts, m, decl.name);
    }
  }

  return parts.join('\n');
}

/**
 * Renders the body of a docblock (description, params, returns,
 * throws, templates, examples) after the summary and signature.
 */
function renderDocBlockBody(parts: string[], docblock: DocBlock | undefined): void {
  if (docblock?.description && docblock.description !== docblock.summary) {
    const bodyText = docblock.description.slice(docblock.summary.length).trim();
    if (bodyText) {
      parts.push('');
      parts.push(bodyText);
    }
  }

  renderTemplateTags(parts, docblock);
  renderParamTags(parts, docblock);
  renderReturnTag(parts, docblock);
  renderThrowsTags(parts, docblock);
  renderSeeTags(parts, docblock);
  renderDeprecatedTag(parts, docblock);
  renderExampleTags(parts, docblock);
}

function renderTemplateTags(parts: string[], docblock: DocBlock | undefined): void {
  const tags = docblock?.tags.filter((t) => t.tag === 'template') ?? [];
  if (tags.length === 0) return;

  parts.push('');
  parts.push('**Type Parameters:**');
  parts.push('');
  for (const tag of tags) {
    parts.push(`- \`${tag.name}\` — ${tag.description}`);
  }
}

function renderParamTags(parts: string[], docblock: DocBlock | undefined): void {
  const tags = docblock?.tags.filter((t) => t.tag === 'param') ?? [];
  if (tags.length === 0) return;

  parts.push('');
  parts.push('**Parameters:**');
  parts.push('');
  for (const tag of tags) {
    parts.push(`- \`${tag.name}\` — ${tag.description}`);
  }
}

function renderReturnTag(parts: string[], docblock: DocBlock | undefined): void {
  const tag = docblock?.tags.find((t) => t.tag === 'returns');
  if (!tag) return;

  parts.push('');
  parts.push(`**Returns:** ${tag.description}`);
}

function renderThrowsTags(parts: string[], docblock: DocBlock | undefined): void {
  const tags = docblock?.tags.filter((t) => t.tag === 'throws') ?? [];
  if (tags.length === 0) return;

  parts.push('');
  parts.push('**Throws:**');
  parts.push('');
  for (const tag of tags) {
    const desc = (tag.description ?? '').replace(/^\{(\w+)\}/, '{@link $1}');
    parts.push(`- ${desc}`);
  }
}

function renderSeeTags(parts: string[], docblock: DocBlock | undefined): void {
  const tags = docblock?.tags.filter((t) => t.tag === 'see') ?? [];
  if (tags.length === 0) return;

  parts.push('');
  parts.push('**See also:**');
  parts.push('');
  for (const tag of tags) {
    parts.push(`- ${tag.description ?? tag.name}`);
  }
}

function renderDeprecatedTag(parts: string[], docblock: DocBlock | undefined): void {
  const tag = docblock?.tags.find((t) => t.tag === 'deprecated');
  if (!tag) return;

  parts.push('');
  parts.push(`> **Deprecated:** ${tag.description ?? tag.name}`);
}

function renderExampleTags(parts: string[], docblock: DocBlock | undefined): void {
  const tags = docblock?.tags.filter((t) => t.tag === 'example') ?? [];
  if (tags.length === 0) return;

  for (const tag of tags) {
    parts.push('');
    parts.push('**Example:**');
    parts.push('');
    parts.push(tag.description ?? '');
  }
}

/**
 * Renders a full member subsection with signature, description,
 * and all docblock tags.
 */
function renderMemberSection(parts: string[], m: MemberInfo, parentName: string): void {
  const label = scopedMemberHeadingLabel(parentName, m);
  parts.push('');
  parts.push(`##### \`${label}\``);
  parts.push('');

  const sig = renderMemberSignature(m);
  parts.push('```ts');
  parts.push(sig);
  parts.push('```');

  if (m.docblock?.summary) {
    parts.push('');
    parts.push(m.docblock.summary);
  }

  renderDocBlockBody(parts, m.docblock);
}
