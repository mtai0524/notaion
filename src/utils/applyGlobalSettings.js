const MODE_CLASS_MAP = {
  eyeProtection: 'eye-protection-active',
  darkMode: 'dark-mode-active',
  focusMode: 'focus-mode-active',
  hackerMode: 'hacker-mode-active',
  partyMode: 'party-mode-active',
  horrorMode: 'horror-mode-active'
};

const BG_THEMES = [
  'theme-dots', 'theme-grid', 'theme-paper', 'theme-blueprint',
  'theme-cross', 'theme-waves', 'theme-notebook', 'theme-none'
];

const BG_SCOPES = ['bg-scope-all', 'bg-scope-base'];

const CSS_VAR_MAP = {
  globalBorderColor: { var: '--global-border-color', fallback: '#111827' },
  globalBorderStyle: { var: '--global-border-style', fallback: 'solid' },
  globalBorderWidth: { var: '--global-border-width', fallback: '2px' },
  globalBorderRadius: { var: '--global-border-radius', fallback: '0px' },
  globalShadowX: { var: '--global-shadow-x', fallback: '-4px' },
  globalShadowY: { var: '--global-shadow-y', fallback: '4px' }
};

const DEFAULT_MODE_VALUES = {
  eyeProtection: true,
};

const readBool = (key) => {
  const v = localStorage.getItem(key);
  if (v === null) return DEFAULT_MODE_VALUES[key] ?? false;
  return v === 'true';
};

export const applyGlobalSettings = () => {
  if (typeof document === 'undefined') return;

  const body = document.body;
  const root = document.documentElement;

  Object.entries(MODE_CLASS_MAP).forEach(([storageKey, className]) => {
    body.classList.toggle(className, readBool(storageKey));
  });

  Object.entries(CSS_VAR_MAP).forEach(([storageKey, { var: cssVar, fallback }]) => {
    const value = localStorage.getItem(storageKey) || fallback;
    root.style.setProperty(cssVar, value);
  });

  BG_THEMES.forEach((cls) => body.classList.remove(cls));
  BG_SCOPES.forEach((cls) => body.classList.remove(cls));

  const bgTheme = localStorage.getItem('globalBgTheme') || 'theme-none';
  const bgScope = localStorage.getItem('globalBgScope') || 'all';
  if (bgTheme && bgTheme !== 'theme-none') {
    body.classList.add(bgTheme);
    body.classList.add(`bg-scope-${bgScope}`);
  }
};

export const SETTING_KEYS = {
  modes: Object.keys(MODE_CLASS_MAP),
  cssVars: Object.keys(CSS_VAR_MAP),
  bg: ['globalBgTheme', 'globalBgScope'],
  flags: ['isBubbleMenuVisible', 'isControlsMenuVisible', 'forceDelete']
};
