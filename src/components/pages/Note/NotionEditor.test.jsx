import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotionEditor from './NotionEditor';

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
});
