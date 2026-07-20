/* Pure helpers for the TUI mobile (touch) experience. */

/* Which action set the mobile bottom bar shows. unsavedPrompt outranks
   everything: the user must answer it before doing anything else. */
export function mobileActionContext({ focus, mode, unsavedPrompt }) {
  if (unsavedPrompt) return 'unsaved';
  if (mode === 'body' || mode === 'title') return 'editor';
  if (focus === 'preview') return 'preview';
  return 'list';
}

const PANELS = ['folders', 'notes', 'preview'];

/* Horizontal swipe → adjacent panel. Requires a mostly-horizontal gesture
   (|dx| ≥ threshold and |dx| ≥ 2|dy|) so vertical scrolling never switches
   panels. Returns the new focus or null for "no switch". */
export function swipePanelTarget(focus, dx, dy, { threshold = 60 } = {}) {
  if (Math.abs(dx) < threshold || Math.abs(dx) < 2 * Math.abs(dy)) return null;
  const i = PANELS.indexOf(focus);
  if (i === -1) return null;
  const j = dx < 0 ? i + 1 : i - 1;
  if (j < 0 || j >= PANELS.length) return null;
  return PANELS[j];
}
