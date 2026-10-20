import { describe, it, expect, beforeEach } from 'vitest';
import {
  APPEARANCE_KEY, DEFAULT_APPEARANCE, DEFAULT_TEXT, ACCENT_COLORS, LOOK_FIELDS,
  loadAppearance, saveAppearance, stepAppearance, appearanceStyle, textStyle, defaultsFor, nextTextPanel,
} from './appearance';

describe('appearance', () => {
  beforeEach(() => localStorage.clear());

  it('loads defaults when nothing is stored', () => {
    expect(loadAppearance()).toEqual(DEFAULT_APPEARANCE);
  });

  it('migrates the old accent-only key', () => {
    localStorage.setItem('daily-note-accent', JSON.stringify('#7c3aed'));
    expect(loadAppearance().accent).toBe('#7c3aed');
  });

  it('reloads what was saved', () => {
    saveAppearance({ ...DEFAULT_APPEARANCE, radius: 12 });
    expect(loadAppearance()).toEqual({ ...DEFAULT_APPEARANCE, radius: 12 });
  });

  it('drops the old accent key on save', () => {
    localStorage.setItem('daily-note-accent', JSON.stringify('#7c3aed'));
    saveAppearance(DEFAULT_APPEARANCE);
    expect(localStorage.getItem('daily-note-accent')).toBeNull();
  });

  it('ignores corrupt storage', () => {
    localStorage.setItem(APPEARANCE_KEY, '{oops');
    expect(loadAppearance()).toEqual(DEFAULT_APPEARANCE);
  });

  it('steps radius by 2px', () => {
    expect(stepAppearance(DEFAULT_APPEARANCE, 'radius', 1)).toEqual({ radius: 8 });
  });

  it('caps border width at its maximum', () => {
    expect(stepAppearance({ ...DEFAULT_APPEARANCE, borderWidth: 4 }, 'borderWidth', 1)).toEqual({ borderWidth: 4 });
  });

  it('floors opacity at its minimum', () => {
    expect(stepAppearance({ ...DEFAULT_APPEARANCE, opacity: 40 }, 'opacity', -1)).toEqual({ opacity: 40 });
  });

  it('moves accent from default to the first preset', () => {
    expect(stepAppearance(DEFAULT_APPEARANCE, 'accent', 1)).toEqual({ accent: ACCENT_COLORS[0] });
  });

  it('wraps accent from default back to the last preset', () => {
    expect(stepAppearance(DEFAULT_APPEARANCE, 'accent', -1)).toEqual({ accent: ACCENT_COLORS.at(-1) });
  });

  it('cycles border style', () => {
    expect(stepAppearance(DEFAULT_APPEARANCE, 'borderStyle', -1)).toEqual({ borderStyle: 'none' });
  });

  it('returns null for rows without a step', () => {
    expect(stepAppearance(DEFAULT_APPEARANCE, 'bgImage', 1)).toBeNull();
  });

  it('emits no variables for the default look', () => {
    expect(appearanceStyle(DEFAULT_APPEARANCE)).toEqual({});
  });

  it('emits variables only for changed values', () => {
    const style = appearanceStyle({ ...DEFAULT_APPEARANCE, borderWidth: 3, opacity: 80, bgImage: 'https://x/y.png' });
    expect(style).toEqual({
      '--tui-border-width': '3px',
      '--tui-border-width-focus': '4px',
      '--tui-panel-opacity': '80%',
      '--tui-bg-image': 'url("https://x/y.png")',
    });
  });

  it('steps line height by 0.1 without float drift', () => {
    expect(stepAppearance(DEFAULT_TEXT, 'lineHeight', 1)).toEqual({ lineHeight: 1.6 });
  });

  it('caps font size at 20px', () => {
    expect(stepAppearance({ ...DEFAULT_TEXT, fontSize: 20 }, 'fontSize', 1)).toEqual({ fontSize: 20 });
  });

  it('cycles the font forward from mono', () => {
    expect(stepAppearance(DEFAULT_TEXT, 'font', 1)).toEqual({ font: 'sans' });
  });

  it('cycles font weight forward from normal', () => {
    expect(stepAppearance(DEFAULT_TEXT, 'fontWeight', 1)).toEqual({ fontWeight: 'medium' });
  });

  it('emits no text variables for the default text style', () => {
    expect(textStyle(DEFAULT_TEXT)).toEqual({});
  });

  it('emits a font stack for non-mono fonts', () => {
    expect(textStyle({ ...DEFAULT_TEXT, font: 'serif' })['--tui-font']).toContain('Noto Serif');
  });

  it('emits the chosen text color', () => {
    expect(textStyle({ ...DEFAULT_TEXT, textColor: '#1e3a8a' })).toEqual({ '--tui-text-color': '#1e3a8a' });
  });

  it('emits the numeric weight for a non-default font weight', () => {
    expect(textStyle({ ...DEFAULT_TEXT, fontWeight: 'medium' })).toEqual({ '--tui-font-weight': '500' });
  });

  it('emits a text scale so rem-sized preview text follows font size', () => {
    expect(textStyle({ ...DEFAULT_TEXT, fontSize: 21 })['--tui-text-scale']).toBe('1.5');
  });

  it('gives every panel the default text style', () => {
    expect(loadAppearance().text.preview).toEqual(DEFAULT_TEXT);
  });

  it('copies the old flat text settings to every panel', () => {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ font: 'serif', fontSize: 16 }));
    expect(loadAppearance().text.folders).toEqual({ ...DEFAULT_TEXT, font: 'serif', fontSize: 16 });
  });

  it('keeps per-panel text styles apart', () => {
    saveAppearance({ ...DEFAULT_APPEARANCE, text: { ...DEFAULT_APPEARANCE.text, notes: { ...DEFAULT_TEXT, fontSize: 18 } } });
    expect(loadAppearance().text.folders.fontSize).toBe(14);
  });

  it('cycles the text panel picker', () => {
    expect(nextTextPanel('preview', 1)).toBe('folders');
  });

  it('builds look defaults without touching text', () => {
    expect(defaultsFor(LOOK_FIELDS)).toEqual({ accent: null, borderWidth: 2, borderStyle: 'solid', radius: 6, opacity: 100, bgImage: '' });
  });
});
