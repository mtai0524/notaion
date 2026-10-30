// Color themes for the daily-note TUI (Options → APPEARANCE → theme).
// 'site' has no palette: the TUI keeps following the page theme tokens.

const THEMES = {
  gruvbox: { bg: '#282828', panel: '#3c3836', text: '#ebdbb2', muted: '#a89984', border: '#665c54', shadow: '#1d2021', accent: '#fe8019' },
  nord: { bg: '#2e3440', panel: '#3b4252', text: '#eceff4', muted: '#9aa5b8', border: '#4c566a', shadow: '#242933', accent: '#88c0d0' },
  dracula: { bg: '#282a36', panel: '#343746', text: '#f8f8f2', muted: '#a3a8c3', border: '#6272a4', shadow: '#1e1f29', accent: '#bd93f9' },
  solarized: { bg: '#fdf6e3', panel: '#eee8d5', text: '#073642', muted: '#657b83', border: '#93a1a1', shadow: '#586e75', accent: '#268bd2' },
  tokyo: { bg: '#1a1b26', panel: '#24283b', text: '#c0caf5', muted: '#9aa5ce', border: '#414868', shadow: '#13141c', accent: '#7aa2f7' },
  gameboy: { bg: '#0f380f', panel: '#173f17', text: '#9bbc0f', muted: '#8bac0f', border: '#8bac0f', shadow: '#052905', accent: '#9bbc0f' },
};

export const THEME_NAMES = ['site', ...Object.keys(THEMES)];

// Swatch colors for the picker chip; null for 'site'.
export const themeSwatch = (name) => {
  const theme = THEMES[name];
  return theme ? [theme.bg, theme.panel, theme.accent] : null;
};

// CSS variables that recolor the TUI root (and every popup inside it).
// The shadow shorthands are redefined because :root resolves them against
// its own --shadow-color.
export const themeStyle = (name) => {
  const theme = THEMES[name];
  if (!theme) return {};
  return {
    '--bg-color': theme.bg,
    '--container-bg': theme.panel,
    '--text-color': theme.text,
    '--text-muted': theme.muted,
    '--border-color': theme.border,
    '--shadow-color': theme.shadow,
    '--tui-accent': theme.accent,
    '--box-shadow': `var(--global-shadow-x, -4px) var(--global-shadow-y, 4px) 0px 0px ${theme.shadow}`,
    '--box-shadow-sm': `calc(var(--global-shadow-x, -4px) * 0.5) calc(var(--global-shadow-y, 4px) * 0.5) 0px 0px ${theme.shadow}`,
  };
};
