import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotionBlock from './NotionBlock';

describe('NotionBlock', () => {
  it('renders a heading with its text and level class', () => {
    render(<NotionBlock block={{ id: 'b0', type: 'h1', text: 'Title' }} onChange={() => {}} />);
    const el = screen.getByText('Title');
    expect(el.closest('.nb-h1')).toBeTruthy();
  });

  it('renders a callout with its icon', () => {
    render(<NotionBlock block={{ id: 'b0', type: 'callout', kind: 'danger', text: 'boom' }} onChange={() => {}} />);
    expect(screen.getByText('🔥')).toBeTruthy();
  });

  it('fires onToggleCheck when a todo checkbox is clicked', () => {
    const onToggleCheck = vi.fn();
    render(<NotionBlock block={{ id: 'b0', type: 'todo', checked: false, text: 'do' }}
                        onChange={() => {}} onToggleCheck={onToggleCheck} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggleCheck).toHaveBeenCalled();
  });

  it('renders a divider as <hr>', () => {
    const { container } = render(<NotionBlock block={{ id: 'b0', type: 'divider' }} onChange={() => {}} />);
    expect(container.querySelector('hr.nb-hr')).toBeTruthy();
  });

  it('fires onToggleCollapse when the toggle caret is clicked', () => {
    const onToggleCollapse = vi.fn();
    render(<NotionBlock block={{ id: 'b0', type: 'toggle', title: 'T', children: 'c' }}
                        onChange={() => {}} onToggleCollapse={onToggleCollapse} />);
    fireEvent.click(screen.getByText('▸'));
    expect(onToggleCollapse).toHaveBeenCalled();
  });
});
