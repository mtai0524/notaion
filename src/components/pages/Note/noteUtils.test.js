import { describe, it, expect } from 'vitest';
import { unsavedPromptAction } from './noteUtils';

describe('unsavedPromptAction', () => {
  it('saves on y', () => {
    expect(unsavedPromptAction({ key: 'y', code: 'KeyY' })).toBe('save');
  });

  it('saves on y while a Vietnamese IME reports Process', () => {
    expect(unsavedPromptAction({ key: 'Process', code: 'KeyY' })).toBe('save');
  });

  it('discards on n while composing', () => {
    expect(unsavedPromptAction({ key: 'Process', code: 'KeyN' })).toBe('discard');
  });

  it('keeps editing on Esc', () => {
    expect(unsavedPromptAction({ key: 'Escape', code: 'Escape' })).toBe('keep');
  });

  it('ignores other keys', () => {
    expect(unsavedPromptAction({ key: 'a', code: 'KeyA' })).toBeNull();
  });
});
