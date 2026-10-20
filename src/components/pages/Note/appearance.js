// Look-and-feel settings for the daily-note TUI (Options → APPEARANCE / TEXT).
// Stored as one JSON object; only values that differ from the defaults are
// turned into CSS variables, so the default look keeps following the site theme.

export const APPEARANCE_KEY = 'daily-note-appearance';
const LEGACY_ACCENT_KEY = 'daily-note-accent';

export const ACCENT_COLORS = ['#2563eb', '#16a34a', '#7c3aed', '#db2777', '#ea580c', '#0891b2'];
export const TEXT_COLORS = ['#374151', '#1e3a8a', '#14532d', '#7c2d12', '#581c87'];
export const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'none'];
export const MAX_BG_BYTES = 2 * 1024 * 1024;

// 'mono' keeps the TUI's own monospace stack, so it has no entry here.
// Every stack leads with a font that renders Vietnamese diacritics cleanly.
export const FONTS = ['mono', 'sans', 'serif', 'system'];
export const FONT_WEIGHTS = ['light', 'normal', 'medium', 'bold'];
const WEIGHT_VALUES = { light: 300, normal: 400, medium: 500, bold: 700 };
const FONT_STACKS = {
  sans: "'Inter', 'Segoe UI', 'Noto Sans', Arial, sans-serif",
  serif: "'Noto Serif', 'Times New Roman', serif",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

// Text style of one panel (Options → TEXT); each panel keeps its own.
export const TEXT_PANELS = ['folders', 'notes', 'preview'];
export const DEFAULT_TEXT = {
  font: 'mono',
  fontWeight: 'normal',
  fontSize: 14,
  lineHeight: 1.5,
  textColor: null,
};
const TEXT_KEYS = Object.keys(DEFAULT_TEXT);
const textForAllPanels = (style) => Object.fromEntries(TEXT_PANELS.map((panel) => [panel, { ...style }]));

export const DEFAULT_APPEARANCE = {
  accent: null,
  borderWidth: 2,
  borderStyle: 'solid',
  radius: 6,
  opacity: 100,
  bgImage: '',
  text: textForAllPanels(DEFAULT_TEXT),
};

export const OPTION_TABS = [
  { key: 'editor', label: 'EDITOR' },
  { key: 'view', label: 'VIEW' },
  { key: 'look', label: 'APPEARANCE' },
  { key: 'text', label: 'TEXT' },
];

// Rows of the APPEARANCE and TEXT tabs, in keyboard (j/k) order. The last
// row of each is its reset button; TEXT starts with the panel picker.
export const LOOK_FIELDS = ['accent', 'borderWidth', 'borderStyle', 'radius', 'opacity', 'bgImage', 'reset'];
export const TEXT_FIELDS = ['panel', 'font', 'fontWeight', 'fontSize', 'lineHeight', 'textColor', 'reset'];

const LIMITS = {
  borderWidth: { min: 0, max: 4, step: 1 },
  radius: { min: 0, max: 20, step: 2 },
  opacity: { min: 40, max: 100, step: 5 },
  fontSize: { min: 12, max: 20, step: 1 },
  lineHeight: { min: 1.2, max: 2, step: 0.1 },
};

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

// Text settings used to be one flat set for the whole TUI; copy them to
// every panel so an upgrade doesn't change what the user sees.
const loadText = (saved) => {
  const flat = Object.fromEntries(TEXT_KEYS.filter((key) => key in saved).map((key) => [key, saved[key]]));
  const fallback = { ...DEFAULT_TEXT, ...flat };
  const perPanel = saved.text && typeof saved.text === 'object' ? saved.text : {};
  return Object.fromEntries(TEXT_PANELS.map((panel) => [panel, { ...fallback, ...(perPanel[panel] || {}) }]));
};

export const loadAppearance = () => {
  const raw = readJson(APPEARANCE_KEY, {});
  const saved = raw && typeof raw === 'object' ? raw : {};
  const legacyAccent = readJson(LEGACY_ACCENT_KEY, null);
  const look = Object.fromEntries(
    Object.keys(DEFAULT_APPEARANCE).filter((key) => key !== 'text' && key in saved).map((key) => [key, saved[key]]),
  );
  return {
    ...DEFAULT_APPEARANCE,
    ...(legacyAccent ? { accent: legacyAccent } : {}),
    ...look,
    text: loadText(saved),
  };
};

// Returns false when storage is full (e.g. a large uploaded background).
export const saveAppearance = (appearance) => {
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
    localStorage.removeItem(LEGACY_ACCENT_KEY);
    return true;
  } catch (err) {
    console.error('[APPEARANCE] Could not save appearance:', err);
    return false;
  }
};

// Default values for the given rows (the 'reset' row itself is skipped).
export const defaultsFor = (fields) => Object.fromEntries(
  fields.filter((field) => field !== 'reset').map((field) => [field, DEFAULT_APPEARANCE[field]]),
);

const cycle = (list, current, dir) => list[(list.indexOf(current) + dir + list.length) % list.length];
const CYCLES = {
  accent: [null, ...ACCENT_COLORS],
  textColor: [null, ...TEXT_COLORS],
  borderStyle: BORDER_STYLES,
  font: FONTS,
  fontWeight: FONT_WEIGHTS,
};

// One ←/→ step on an APPEARANCE row (values = appearance) or a TEXT row
// (values = one panel's text style). Returns the patch to apply, or null.
export const stepAppearance = (values, field, dir) => {
  if (CYCLES[field]) return { [field]: cycle(CYCLES[field], values[field], dir) };
  const limit = LIMITS[field];
  if (!limit) return null;
  const next = Math.min(limit.max, Math.max(limit.min, values[field] + dir * limit.step));
  return { [field]: Math.round(next * 10) / 10 };
};

export const nextTextPanel = (panel, dir) => cycle(TEXT_PANELS, panel, dir);

// CSS variables for the TUI root; only non-default values are emitted.
export const appearanceStyle = (appearance) => {
  const style = {};
  const isDefault = (field) => appearance[field] === DEFAULT_APPEARANCE[field];
  if (appearance.accent) style['--tui-accent'] = appearance.accent;
  if (!isDefault('borderWidth')) {
    style['--tui-border-width'] = `${appearance.borderWidth}px`;
    style['--tui-border-width-focus'] = `${appearance.borderWidth + 1}px`;
  }
  if (!isDefault('borderStyle')) style['--tui-border-style'] = appearance.borderStyle;
  if (!isDefault('radius')) style['--tui-radius'] = `${appearance.radius}px`;
  if (!isDefault('opacity')) style['--tui-panel-opacity'] = `${appearance.opacity}%`;
  if (appearance.bgImage) style['--tui-bg-image'] = `url(${JSON.stringify(appearance.bgImage)})`;
  return style;
};

// CSS variables for one panel's text; only non-default values are emitted.
export const textStyle = (text) => {
  const style = {};
  const isDefault = (field) => text[field] === DEFAULT_TEXT[field];
  if (FONT_STACKS[text.font]) style['--tui-font'] = FONT_STACKS[text.font];
  if (!isDefault('fontWeight')) style['--tui-font-weight'] = String(WEIGHT_VALUES[text.fontWeight]);
  if (!isDefault('fontSize')) {
    style['--tui-font-size'] = `${text.fontSize}px`;
    // Content sized in rem (preview title, body, headings…) multiplies by this.
    style['--tui-text-scale'] = String(text.fontSize / DEFAULT_TEXT.fontSize);
  }
  if (!isDefault('lineHeight')) style['--tui-line-height'] = String(text.lineHeight);
  if (text.textColor) style['--tui-text-color'] = text.textColor;
  return style;
};
