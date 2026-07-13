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
    if (!ta || !mirror) return;
    // Copy the metrics that affect wrapping from the textarea onto the mirror.
    const cs = window.getComputedStyle(ta);
    ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
      'paddingLeft', 'paddingRight', 'textIndent', 'whiteSpace', 'wordBreak',
      'overflowWrap', 'tabSize'].forEach((p) => { mirror.style[p] = cs[p]; });
    mirror.style.width = `${ta.clientWidth}px`;

    const lineH = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * 1.5);
    const logical = text.split('\n');
    const heights = [];
    logical.forEach((ln) => {
      mirror.textContent = ln.length ? ln : ' ';
      const h = mirror.offsetHeight;
      heights.push(Math.max(1, Math.round(h / lineH)));
    });
    // One sequential number per visual row.
    let n = 0;
    const out = [];
    heights.forEach((visualRows) => {
      for (let r = 0; r < visualRows; r++) out.push(++n);
    });
    setRows(out);
  }, [text, textareaRef]);

  return (
    <div className="tui-lineno" ref={gutterRef} aria-hidden>
      <div ref={mirrorRef} className="tui-lineno-mirror" />
      {rows.map((num, i) => <div key={i}>{num}</div>)}
    </div>
  );
};

LineGutter.propTypes = {
  text: PropTypes.string.isRequired,
  textareaRef: PropTypes.object.isRequired,
  gutterRef: PropTypes.object,
};

export default LineGutter;
