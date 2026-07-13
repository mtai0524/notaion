import { useRef, useLayoutEffect, useState } from 'react';
import PropTypes from 'prop-types';

// Line-number gutter that stays aligned with a word-WRAPPED textarea. A textarea
// can't tell us where wrap breaks happen, so we mirror its text into a hidden
// div with identical width/font/wrapping and measure each logical line's height.
// Every VISUAL row (including wrapped continuations) gets its own sequential
// number, so the gutter never drifts from the text.
const LineGutter = ({ text, textareaRef, gutterRef }) => {
  const mirrorRef = useRef(null);
  const [rows, setRows] = useState([]); // sequential numbers, one per visual row

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!ta || !mirror) { setRows(text.split('\n').map((_, i) => i + 1)); return; }
    const logical = text.split('\n');
    try {
      // Copy the metrics that affect wrapping from the textarea onto the mirror.
      const cs = window.getComputedStyle(ta);
      ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
        'paddingLeft', 'paddingRight', 'textIndent', 'whiteSpace', 'wordBreak',
        'overflowWrap', 'tabSize'].forEach((p) => { if (cs[p] != null) mirror.style[p] = cs[p]; });
      const w = ta.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      mirror.style.width = `${Math.max(1, w)}px`;
      mirror.style.paddingLeft = '0px';
      mirror.style.paddingRight = '0px';

      const fs = parseFloat(cs.fontSize) || 14;
      let lineH = parseFloat(cs.lineHeight);
      if (!Number.isFinite(lineH) || lineH <= 0) lineH = fs * 1.5;

      let n = 0;
      const out = [];
      logical.forEach((ln) => {
        mirror.textContent = ln.length ? ln : ' ';
        const visualRows = Math.max(1, Math.round(mirror.offsetHeight / lineH) || 1);
        for (let r = 0; r < visualRows; r++) out.push(++n);
      });
      setRows(out.length ? out : logical.map((_, i) => i + 1));
    } catch {
      // Measurement failed — degrade to plain per-line numbers so it's never blank.
      setRows(logical.map((_, i) => i + 1));
    }
  }, [text, textareaRef]);

  return (
    <div className="tui-lineno" ref={gutterRef} aria-hidden>
      <div ref={mirrorRef} className="tui-lineno-mirror" />
      {rows.length === 0
        ? text.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)
        : rows.map((num, i) => <div key={i}>{num}</div>)}
    </div>
  );
};

LineGutter.propTypes = {
  text: PropTypes.string.isRequired,
  textareaRef: PropTypes.object.isRequired,
  gutterRef: PropTypes.object,
};

export default LineGutter;
