import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import axiosInstance from '../../../axiosConfig';
import English from './English';
import { SYNCED_KEY } from './englishData';

vi.mock('../../../axiosConfig', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const DUE_CARD = { id: 'c1', front: 'resilient', back: 'kiên cường', example: '', interval: 0, ease: 2.5, due: 0, createdAt: 0 };

const renderWithCards = (cards) => {
  axiosInstance.get.mockResolvedValue({ data: { cards } });
  return render(<English />);
};

const press = (key) => fireEvent.keyDown(window, { key });

describe('English page', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(SYNCED_KEY, '1');
    vi.clearAllMocks();
    axiosInstance.put.mockResolvedValue({ data: {} });
  });

  it('switches to SENTENCES on key 2', async () => {
    renderWithCards([]);
    press('2');
    expect(await screen.findByText(/no sentences yet/)).toBeTruthy();
  });

  it('shows the meaning after space flips the card', async () => {
    renderWithCards([DUE_CARD]);
    await screen.findByText('resilient', { selector: '.eng-card-front' });
    press(' ');
    expect(screen.getByText('kiên cường')).toBeTruthy();
  });

  it('grades a flipped card with key 3 instead of switching tab', async () => {
    renderWithCards([DUE_CARD]);
    await screen.findByText('resilient', { selector: '.eng-card-front' });
    press(' ');
    press('3');
    expect(screen.getByText(/nothing due/)).toBeTruthy();
  });

  it('shows the card picked with j in the review panel', async () => {
    renderWithCards([DUE_CARD, { ...DUE_CARD, id: 'c2', front: 'prioritize', due: 1 }]);
    await screen.findByText('resilient', { selector: '.eng-card-front' });
    press('j');
    expect(screen.getByText('prioritize', { selector: '.eng-card-front' })).toBeTruthy();
  });

  it('saves a card from the n form to the server', async () => {
    renderWithCards([]);
    await screen.findByText(/no cards yet/);
    press('n');
    fireEvent.change(screen.getByPlaceholderText('resilient'), { target: { value: 'bottleneck' } });
    fireEvent.click(screen.getByText('Save'));
    expect(axiosInstance.put.mock.calls[0][1].front).toBe('bottleneck');
  });

  it('shows a sync error when the server is unreachable', async () => {
    axiosInstance.get.mockRejectedValue(new Error('Network Error'));
    render(<English />);
    expect(await screen.findByText(/could not reach the server/)).toBeTruthy();
  });
});
