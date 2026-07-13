// Pure markdown <-> block model for the Daily Note editor. No React here.
// The source of truth stays a markdown string; blocks are a transient view.

export const CALLOUT_KIND_KEYS = ['note', 'info', 'warning', 'success', 'danger'];

// Icon + label per callout kind — shared by the renderer, the "/" menu and the
// block editor so the visual identity of a callout lives in one place.
export const CALLOUT_KINDS = {
  note:    { icon: '💡', label: 'Note' },
  info:    { icon: 'ℹ️', label: 'Info' },
  warning: { icon: '⚠️', label: 'Warning' },
  success: { icon: '✅', label: 'Success' },
  danger:  { icon: '🔥', label: 'Danger' },
};

let _idc = 0;
const nid = () => `b${_idc++}`;

const CHECK = /^\s*[-*]\s*\[( |x|X)\]\s?(.*)$/;

// md string -> Block[]
export const parseMarkdown = (md) => {
  const lines = String(md ?? '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];

    // code fence
    if (/^```/.test(ln)) {
      const lang = ln.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { body.push(lines[i]); i++; }
      out.push({ id: nid(), type: 'code', lang, text: body.join('\n') });
      continue;
    }

    // toggle: "> [>] title" + indented (>=2 space) children
    const tog = ln.match(/^>\s?\[>\]\s?(.*)$/);
    if (tog) {
      const children = [];
      while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1])) {
        i++; children.push(lines[i].replace(/^\s{2,}/, ''));
      }
      out.push({ id: nid(), type: 'toggle', title: tog[1] || '', children: children.join('\n') });
      continue;
    }

    // callout: "> [!kind] text" + following "> " continuation
    const call = ln.match(/^>\s?\[!(\w+)\]\s?(.*)$/);
    if (call) {
      const kind = CALLOUT_KIND_KEYS.includes(call[1].toLowerCase()) ? call[1].toLowerCase() : 'note';
      const body = [call[2]];
      while (i + 1 < lines.length && /^>\s?(?!\[)/.test(lines[i + 1])) {
        i++; body.push(lines[i].replace(/^>\s?/, ''));
      }
      out.push({ id: nid(), type: 'callout', kind, text: body.join('\n') });
      continue;
    }

    const chk = ln.match(CHECK);
    if (chk) { out.push({ id: nid(), type: 'todo', checked: chk[1].toLowerCase() === 'x', text: chk[2] }); continue; }

    const img = ln.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (img) { out.push({ id: nid(), type: 'image', alt: img[1], url: img[2] }); continue; }

    const file = ln.match(/^\[([^\]]+)\]\(([^)]+)\)\s*$/);
    if (file) { out.push({ id: nid(), type: 'file', label: file[1], url: file[2] }); continue; }

    const h = ln.match(/^(#{1,3})\s+(.*)$/);
    if (h) { out.push({ id: nid(), type: `h${h[1].length}`, text: h[2] }); continue; }

    if (/^>\s?/.test(ln)) { out.push({ id: nid(), type: 'quote', text: ln.replace(/^>\s?/, '') }); continue; }
    if (/^[-*]\s+/.test(ln)) { out.push({ id: nid(), type: 'bullet', text: ln.replace(/^[-*]\s+/, '') }); continue; }
    if (/^---+$/.test(ln.trim())) { out.push({ id: nid(), type: 'divider', text: '' }); continue; }

    out.push({ id: nid(), type: 'paragraph', text: ln });
  }
  return out;
};

const one = (b) => {
  switch (b.type) {
    case 'h1': return `# ${b.text}`;
    case 'h2': return `## ${b.text}`;
    case 'h3': return `### ${b.text}`;
    case 'todo': return `- [${b.checked ? 'x' : ' '}] ${b.text}`;
    case 'bullet': return `- ${b.text}`;
    case 'quote': return `> ${b.text}`;
    case 'divider': return '---';
    case 'image': return `![${b.alt || ''}](${b.url})`;
    case 'file': return `[${b.label}](${b.url})`;
    case 'code': return '```' + (b.lang || '') + '\n' + (b.text || '') + '\n```';
    case 'callout': {
      const [first, ...rest] = String(b.text ?? '').split('\n');
      return [`> [!${b.kind || 'note'}] ${first}`, ...rest.map((l) => `> ${l}`)].join('\n');
    }
    case 'toggle': {
      const kids = String(b.children ?? '').length
        ? String(b.children).split('\n').map((l) => `    ${l}`)
        : [];
      return [`> [>] ${b.title || ''}`, ...kids].join('\n');
    }
    default: return b.text ?? '';
  }
};

export const serializeBlocks = (blocks) => (blocks || []).map(one).join('\n');
