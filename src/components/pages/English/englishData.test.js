import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import axiosInstance from '../../../axiosConfig';
import { ENGLISH_KEY, SYNCED_KEY, todayKey, useEnglishData } from './englishData';

vi.mock('../../../axiosConfig', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const SERVER = { cards: [], sentences: [{ id: 's1', en: 'Hi there.', createdAt: 1 }], texts: [], writings: [] };
const BROWSER = { cards: [{ id: 'old', front: 'legacy', createdAt: 1 }], sentences: [], texts: [], writings: [] };

const LESSON_TEXT = { id: `daily-${todayKey()}-text`, title: 'Today', body: 'Read me.', createdAt: 2 };
const LESSON_CARD = { id: `daily-${todayKey()}-c1`, front: 'estimate', due: 0, interval: 0, ease: 2.5, createdAt: 2 };

const renderSynced = async () => {
  const hook = renderHook(() => useEnglishData());
  await waitFor(() => expect(hook.result.current.syncing || hook.result.current.preparing).toBe(false));
  return hook;
};

describe('useEnglishData', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    axiosInstance.get.mockResolvedValue({ data: SERVER });
    axiosInstance.put.mockResolvedValue({ data: {} });
    axiosInstance.post.mockImplementation(async (url) => ({ data: url.endsWith('/daily') ? { created: false } : { saved: 1 } }));
    axiosInstance.delete.mockResolvedValue({});
  });

  afterEach(() => vi.useRealTimers());

  it('loads the server data', async () => {
    const { result } = await renderSynced();
    expect(result.current.data.sentences[0].en).toBe('Hi there.');
  });

  it('uploads data saved in the browser before sync existed', async () => {
    localStorage.setItem(ENGLISH_KEY, JSON.stringify(BROWSER));
    await renderSynced();
    expect(axiosInstance.post).toHaveBeenCalledWith('/api/English/items/bulk', expect.objectContaining({ cards: BROWSER.cards }));
  });

  it('uploads browser data only once', async () => {
    localStorage.setItem(ENGLISH_KEY, JSON.stringify(BROWSER));
    localStorage.setItem(SYNCED_KEY, '1');
    await renderSynced();
    expect(axiosInstance.post).not.toHaveBeenCalledWith('/api/English/items/bulk', expect.anything());
  });

  it("asks for today's lesson when it is missing", async () => {
    await renderSynced();
    expect(axiosInstance.post).toHaveBeenCalledWith('/api/English/daily', { date: todayKey() });
  });

  it("does not ask again when today's lesson exists", async () => {
    axiosInstance.get.mockResolvedValue({ data: { ...SERVER, texts: [LESSON_TEXT] } });
    await renderSynced();
    expect(axiosInstance.post).not.toHaveBeenCalledWith('/api/English/daily', expect.anything());
  });

  it("adds the new lesson's cards", async () => {
    axiosInstance.post.mockResolvedValue({ data: { created: true } });
    axiosInstance.get
      .mockResolvedValueOnce({ data: SERVER })
      .mockResolvedValueOnce({ data: { ...SERVER, cards: [LESSON_CARD], texts: [LESSON_TEXT] } });
    const { result } = await renderSynced();
    await waitFor(() => expect(result.current.data.cards.map((card) => card.front)).toEqual(['estimate']));
  });

  it("explains when today's lesson could not be prepared", async () => {
    axiosInstance.post.mockRejectedValue(Object.assign(new Error('Bad Gateway'), { response: { status: 502 } }));
    const { result } = await renderSynced();
    await waitFor(() => expect(result.current.syncError).toMatch(/could not prepare today's lesson/));
  });

  it('saves an edit once typing pauses', async () => {
    localStorage.setItem(SYNCED_KEY, '1');
    const { result } = await renderSynced();
    vi.useFakeTimers();
    act(() => {
      result.current.update('sentences', 's1', { en: 'Hi' });
      result.current.update('sentences', 's1', { en: 'Hi again.' });
      vi.advanceTimersByTime(1000);
    });
    expect(axiosInstance.put.mock.calls.map((call) => call[1].en)).toEqual(['Hi again.']);
  });

  it('deletes on the server', async () => {
    localStorage.setItem(SYNCED_KEY, '1');
    const { result } = await renderSynced();
    act(() => result.current.remove('sentences', 's1'));
    expect(axiosInstance.delete).toHaveBeenCalledWith('/api/English/items/sentences/s1');
  });
});
