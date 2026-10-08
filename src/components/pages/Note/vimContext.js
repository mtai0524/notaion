import { createContext } from 'react';

/* True while the nvim block editor is in NORMAL mode. Blocks read this from
   context instead of receiving it as a prop: a NORMAL↔INSERT switch then
   re-renders only the editable text, not every draggable row (each Draggable
   scans all drag handles when it renders, so re-rendering N rows cost O(N²)). */
export const VimNormalContext = createContext(false);
