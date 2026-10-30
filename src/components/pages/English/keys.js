import { useEffect, useRef } from 'react';

const isTyping = (target) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

// Page-level single-key shortcuts; ignored while typing or with modifiers.
// Tabs listen in the capture phase so they see a key before the page shell,
// and call preventDefault() to keep it (e.g. 1-4 grade a card, not switch tab).
export const useKeys = (handler, { enabled = true, capture = false } = {}) => {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (e) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      handlerRef.current(e);
    };
    window.addEventListener('keydown', onKeyDown, capture);
    return () => window.removeEventListener('keydown', onKeyDown, capture);
  }, [enabled, capture]);
};

// j/k (and arrows) step through a list of `count` rows.
export const stepIndex = (key, index, count) => {
  if (count === 0) return index;
  if (key === 'j' || key === 'ArrowDown') return Math.min(count - 1, index + 1);
  if (key === 'k' || key === 'ArrowUp') return Math.max(0, index - 1);
  return index;
};
