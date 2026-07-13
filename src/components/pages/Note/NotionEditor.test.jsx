import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotionEditor, { reorder } from './NotionEditor';
import { parseMarkdown, serializeBlocks } from './noteFormat';

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
