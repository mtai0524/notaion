// TUI color themes — same names and palettes as the web TUI view
// (TuiView.scss data-tui-theme) plus the web's dark mode.
export const THEMES = ["default", "dark", "catppuccin", "gruvbox", "nord", "dracula"];
const KEY = "nd:theme";

export const loadTheme = () => {
  const saved = localStorage.getItem(KEY);
  if (THEMES.includes(saved)) return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "default";
};

export const applyTheme = (name) => {
  document.documentElement.dataset.theme = name;
  localStorage.setItem(KEY, name);
};

export const nextTheme = (name) => THEMES[(THEMES.indexOf(name) + 1) % THEMES.length];
