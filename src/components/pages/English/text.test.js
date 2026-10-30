import { describe, expect, it } from 'vitest';
import { diffWords, normalizeWord, sentenceAt, tokenize } from './text';

describe('text', () => {
  it('puts words at odd token indices', () => {
    expect(tokenize("It's a bottleneck, really.")).toEqual(['', "It's", ' ', 'a', ' ', 'bottleneck', ', ', 'really', '.']);
  });

  it('normalizes words for lookup', () => {
    expect(normalizeWord("Teams'")).toBe('teams');
  });

  it('finds the sentence around an offset', () => {
    const paragraph = 'Staff push back. The commute is a bottleneck! Fine.';
    expect(sentenceAt(paragraph, paragraph.indexOf('bottleneck'))).toBe('The commute is a bottleneck!');
  });

  it('diffs a corrected sentence word by word', () => {
    expect(diffWords('Yesterday I have a meeting', 'Yesterday I had a meeting')).toEqual([
      { type: 'same', text: 'Yesterday I' },
      { type: 'del', text: 'have' },
      { type: 'ins', text: 'had' },
      { type: 'same', text: 'a meeting' },
    ]);
  });

  it('diffs removed words', () => {
    expect(diffWords('We discuss about it', 'We discussed it')).toEqual([
      { type: 'same', text: 'We' },
      { type: 'del', text: 'discuss about' },
      { type: 'ins', text: 'discussed' },
      { type: 'same', text: 'it' },
    ]);
  });
});
