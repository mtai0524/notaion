import { describe, it, expect } from 'vitest';
import { mobileActionContext, swipePanelTarget } from './tuiMobile';

describe('mobileActionContext', () => {
  it('unsavedPrompt thắng mọi thứ', () => {
    expect(mobileActionContext({ focus: 'preview', mode: 'body', unsavedPrompt: true })).toBe('unsaved');
  });
  it('mode body/title → editor', () => {
    expect(mobileActionContext({ focus: 'preview', mode: 'body', unsavedPrompt: false })).toBe('editor');
    expect(mobileActionContext({ focus: 'notes', mode: 'title', unsavedPrompt: false })).toBe('editor');
  });
  it('focus preview (không soạn) → preview', () => {
    expect(mobileActionContext({ focus: 'preview', mode: 'normal', unsavedPrompt: false })).toBe('preview');
  });
  it('mặc định → list', () => {
    expect(mobileActionContext({ focus: 'notes', mode: 'normal', unsavedPrompt: false })).toBe('list');
    expect(mobileActionContext({ focus: 'folders', mode: 'delete', unsavedPrompt: false })).toBe('list');
  });
});

describe('swipePanelTarget', () => {
  it('vuốt trái (dx âm) → panel kế tiếp', () => {
    expect(swipePanelTarget('folders', -80, 0)).toBe('notes');
    expect(swipePanelTarget('notes', -80, 10)).toBe('preview');
  });
  it('vuốt phải (dx dương) → panel trước', () => {
    expect(swipePanelTarget('preview', 80, 0)).toBe('notes');
    expect(swipePanelTarget('notes', 80, 0)).toBe('folders');
  });
  it('ở mép thì đứng yên (null)', () => {
    expect(swipePanelTarget('folders', 80, 0)).toBe(null);
    expect(swipePanelTarget('preview', -80, 0)).toBe(null);
  });
  it('dưới ngưỡng 60px hoặc chéo dọc quá → null', () => {
    expect(swipePanelTarget('notes', -40, 0)).toBe(null);
    expect(swipePanelTarget('notes', -80, 50)).toBe(null); // |dx| < 2|dy|
  });
  it('focus lạ → null', () => {
    expect(swipePanelTarget('editor', -80, 0)).toBe(null);
  });
});
