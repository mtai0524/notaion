import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotionEditor from './NotionEditor';
import { parseMarkdown, serializeBlocks, reorder } from './noteFormat';

describe('NotionEditor', () => {
  it('renders one block per markdown line', () => {
    render(<NotionEditor content={'# A\nbody'} onChange={() => {}} />);
    expect(screen.getByText('A').closest('.nb-h1')).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('re-serializes to markdown on a checkbox toggle', () => {
    const onChange = vi.fn();
    render(<NotionEditor content={'- [ ] task'} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith('- [x] task');
  });

  it('shows a single empty paragraph for empty content', () => {
    const { container } = render(<NotionEditor content={''} onChange={() => {}} />);
    expect(container.querySelectorAll('.nb-text').length).toBe(1);
  });

  it('updates the correct block and keeps its node when typing among blank lines', () => {
    // Mirrors the screenshot: content lines separated by blank paragraphs.
    let content = 'a\n\nb\n\nc';
    const onChange = (md) => { content = md; };
    const { container, rerender } = render(<NotionEditor content={content} onChange={onChange} />);
    const nodes = () => [...container.querySelectorAll('.nb-text')];
    const before = nodes();
    // type into the 3rd text block ("b")
    const target = before[2];
    fireEvent.input(target, { target: { textContent: 'bb' } });
    rerender(<NotionEditor content={content} onChange={onChange} />);
    const after = nodes();
    expect(content).toBe('a\n\nbb\n\nc');       // only block "b" changed
    expect(after[2]).toBe(target);              // same node → caret survives
    expect(after.length).toBe(before.length);   // no phantom blocks added/removed
  });

  it('keeps the same DOM node while typing (caret must survive edits)', () => {
    // Simulate the controlled loop: onChange feeds the new markdown back as the
    // content prop, exactly like TuiView's setDraft does. The editable node must
    // NOT be remounted, or the caret is lost on every keystroke.
    let content = 'ab';
    const { container, rerender } = render(
      <NotionEditor content={content} onChange={(md) => { content = md; }} />,
    );
    const before = container.querySelector('.nb-text');
    fireEvent.input(before, { target: { textContent: 'abc' } });
    rerender(<NotionEditor content={content} onChange={(md) => { content = md; }} />);
    const after = container.querySelector('.nb-text');
    expect(after).toBe(before); // same node → caret preserved
  });

  it('turns a block into a heading via the slash menu', () => {
    const onChange = vi.fn();
    render(<NotionEditor content={'hi'} onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Insert / turn into block'));
    fireEvent.click(screen.getByText('Heading 1'));
    expect(onChange).toHaveBeenCalledWith('# hi');
  });

  it('turns a block into a warning callout via the slash menu', () => {
    const onChange = vi.fn();
    render(<NotionEditor content={'careful'} onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Insert / turn into block'));
    fireEvent.click(screen.getByText('Callout · warning'));
    expect(onChange).toHaveBeenCalledWith('> [!warning] careful');
  });
});

describe('reorder', () => {
  it('moves a block and preserves the rest, round-tripping to markdown', () => {
    const blocks = parseMarkdown('one\ntwo\nthree');
    expect(serializeBlocks(reorder(blocks, 0, 2))).toBe('two\nthree\none');
  });

  it('returns a new array without mutating the original', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const out = reorder(list, 2, 0);
    expect(out.map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(list.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});
