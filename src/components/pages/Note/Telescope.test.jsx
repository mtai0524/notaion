import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Telescope from './Telescope';

const makeSources = () => [
  { key: 'notes', label: 'Notes', items: [{ id: 1, t: 'alpha' }, { id: 2, t: 'beta' }],
    getKey: (x) => x.id, getLabel: (x) => x.t, getPreview: (x) => `preview ${x.t}`, onPick: vi.fn() },
  { key: 'cmd', label: 'Commands', items: [{ id: 'c1', t: 'export' }],
    getKey: (x) => x.id, getLabel: (x) => x.t, getPreview: (x) => x.t, onPick: vi.fn() },
];

describe('Telescope', () => {
  it('filters results by the prompt query', () => {
    render(<Telescope sources={makeSources()} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'alp' } });
    expect(screen.getByText('alpha')).toBeTruthy();
    expect(screen.queryByText('beta')).toBeNull();
  });

  it('picks the selected item on Enter', () => {
    const sources = makeSources();
    render(<Telescope sources={sources} onClose={() => {}} />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'beta' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(sources[0].onPick).toHaveBeenCalledWith(sources[0].items[1]);
  });

  it('cycles sources on Tab', () => {
    const { container } = render(<Telescope sources={makeSources()} onClose={() => {}} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/search/i), { key: 'Tab' });
    const items = [...container.querySelectorAll('.tele-item')].map((el) => el.textContent);
    expect(items).toContain('export');   // now showing the Commands source
    expect(items).not.toContain('alpha');
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Telescope sources={makeSources()} onClose={onClose} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/search/i), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
