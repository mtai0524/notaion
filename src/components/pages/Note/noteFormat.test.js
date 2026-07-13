import { describe, it, expect } from 'vitest';
import { parseMarkdown, serializeBlocks } from './noteFormat';

describe('parseMarkdown', () => {
  it('parses a plain paragraph', () => {
    const b = parseMarkdown('hello world');
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ type: 'paragraph', text: 'hello world' });
  });

  it('parses headings 1-3', () => {
    const b = parseMarkdown('# A\n## B\n### C');
    expect(b.map((x) => x.type)).toEqual(['h1', 'h2', 'h3']);
    expect(b.map((x) => x.text)).toEqual(['A', 'B', 'C']);
  });

  it('parses todo with checked state', () => {
    const b = parseMarkdown('- [ ] open\n- [x] done');
    expect(b[0]).toMatchObject({ type: 'todo', checked: false, text: 'open' });
    expect(b[1]).toMatchObject({ type: 'todo', checked: true, text: 'done' });
  });

  it('parses a callout with kind and multi-line body', () => {
    const b = parseMarkdown('> [!warning] be careful\n> second line');
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ type: 'callout', kind: 'warning', text: 'be careful\nsecond line' });
  });

  it('parses a toggle with children', () => {
    const b = parseMarkdown('> [>] Title\n    child one\n    child two');
    expect(b[0]).toMatchObject({ type: 'toggle', title: 'Title', children: 'child one\nchild two' });
  });

  it('falls back to paragraph for unknown syntax (table)', () => {
    const b = parseMarkdown('| a | b |');
    expect(b[0]).toMatchObject({ type: 'paragraph', text: '| a | b |' });
  });

  it('gives every block a stable unique id', () => {
    const b = parseMarkdown('one\ntwo');
    expect(b[0].id).not.toEqual(b[1].id);
  });
});

describe('serializeBlocks', () => {
  it('serializes each block type back to markdown', () => {
    expect(serializeBlocks([{ type: 'h2', text: 'Hi' }])).toBe('## Hi');
    expect(serializeBlocks([{ type: 'todo', checked: true, text: 'x' }])).toBe('- [x] x');
    expect(serializeBlocks([{ type: 'divider' }])).toBe('---');
    expect(serializeBlocks([{ type: 'callout', kind: 'info', text: 'a\nb' }]))
      .toBe('> [!info] a\n> b');
    expect(serializeBlocks([{ type: 'toggle', title: 'T', children: 'c1\nc2' }]))
      .toBe('> [>] T\n    c1\n    c2');
  });
});

describe('round-trip', () => {
  const samples = [
    'hello world',
    '# H1\n## H2\n### H3',
    '- [ ] a\n- [x] b',
    '- bullet\n> quote',
    '> [!danger] watch out\n> line two',
    '> [>] Toggle\n    child one\n    child two',
    '```js\nconst x = 1;\n```',
    '---',
    '![alt](http://img)\n[📎 file](http://f)',
  ];
  it.each(samples)('serialize(parse(md)) === md for: %s', (md) => {
    expect(serializeBlocks(parseMarkdown(md))).toBe(md);
  });
});
