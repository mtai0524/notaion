import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import {
  parse, serialize, splitBlock, backspaceAtStart, insertAtCaret, insertAtGap, moveToGap,
  markdownShortcut, attachmentToBlock, isText, textOf, withText, paragraph, newId, MULTILINE_TYPES,
} from "../lib/blocks.js";
import { CALLOUT_KINDS } from "../lib/noteFormat.js";
import { applyEdit, insertTimeStamp } from "../lib/editing.js";
import { nameClipboardFile } from "../lib/attachments.js";
import { openExternal } from "../lib/native.js";
import { clampNormal, createHistory, cut, motion, operatorRange, vertical } from "../lib/vim.js";
import { lineEnd, lineStart } from "../lib/vimEditor.js";

const BLOCK_MIME = "application/x-notaion-block";
const FIELD_SIZING = typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content");

// Auto-growing single block textarea (CSS field-sizing where available).
function AutoText({ value, ...props }) {
  const ref = useRef();
  useLayoutEffect(() => {
    if (FIELD_SIZING) return;
    const el = ref.current;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} spellcheck={false} value={value} {...props} />;
}

const focusBlock = (root, id, pos) => {
  const el = root?.querySelector(`[data-bid="${CSS.escape(id)}"]`);
  if (!el) return false;
  el.focus();
  const p = pos === "end" ? el.value.length : Math.min(pos, el.value.length);
  el.setSelectionRange(p, p);
  return true;
};

/**
 * Notion-style block editor over the note's markdown `content` (same block
 * format as the web). Images/files are inline blocks placed at the caret or at
 * the drop line; blocks reorder by dragging the ⠿ handle.
 */
export function BlockEditor({ content, onChange, onCommit, onUpload, onUploadError, onOrphanUpload, apiRef, nvim = false, onVimMode }) {
  const [blocks, setBlocks] = useState(() => parse(content));
  const [dropGap, setDropGap] = useState(null);
  const blocksRef = useRef(blocks);
  const lastEmitted = useRef(content);
  // Recent markdown we emitted. The parent can re-render with an older one
  // of ours after we already emitted a newer one (fast typing) — that echo
  // must not count as an outside change.
  const emitted = useRef(new Set([content]));
  const pendingFocus = useRef(null);
  const caret = useRef(null); // last caret { id, pos } — target for 📎 attach
  const dragFrom = useRef(null); // index of the block being dragged
  const rootRef = useRef();
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);

  // ---- nvim mode ----------------------------------------------------------
  // NORMAL keeps focus in the block textarea but swallows every key (and
  // beforeinput/paste/cut), so nothing is ever typed; INSERT is the plain editor.
  const [vim, setVimState] = useState(nvim ? "normal" : "insert");
  const vimRef = useRef(vim);
  const nvimRef = useRef(nvim);
  nvimRef.current = nvim;
  const pend = useRef(""); // first key of a two-key command: g d y c r
  const cnt = useRef(""); // typed count, e.g. the 3 in 3dd
  const reg = useRef(null); // unnamed register: { text } or { blocks }
  const hist = useRef(createHistory());
  const setMode = (m) => {
    vimRef.current = m;
    setVimState(m);
    onVimMode?.(m);
  };
  useEffect(() => {
    pend.current = "";
    cnt.current = "";
    setMode(nvim ? "normal" : "insert");
  }, [nvim]);

  // Re-parse only when content changes from outside (server refresh), never
  // for our own emits — that would remint ids and lose the caret.
  useEffect(() => {
    if (emitted.current.has(content)) return;
    emitted.current = new Set([content]);
    lastEmitted.current = content;
    blocksRef.current = parse(content);
    setBlocks(blocksRef.current);
  }, [content]);

  useLayoutEffect(() => {
    const f = pendingFocus.current;
    if (!f) return;
    pendingFocus.current = null;
    focusBlock(rootRef.current, f.id, f.pos);
  });

  const commit = (next, focus) => {
    blocksRef.current = next;
    setBlocks(next);
    if (focus) pendingFocus.current = focus;
    const md = serialize(next);
    if (md !== lastEmitted.current) {
      lastEmitted.current = md;
      emitted.current.delete(md);
      emitted.current.add(md);
      if (emitted.current.size > 50) emitted.current.delete(emitted.current.values().next().value);
      onChange(md);
    }
  };
  const replaceAt = (i, b) => blocksRef.current.map((x, j) => (j === i ? b : x));
  const removeAt = (i) => {
    const next = blocksRef.current.filter((_, j) => j !== i);
    commit(next.length ? next : [paragraph()]);
  };

  const focusSibling = (i, dir, pos) => {
    const list = blocksRef.current;
    for (let j = i + dir; j >= 0 && j < list.length; j += dir) {
      if (isText(list[j])) return focusBlock(rootRef.current, list[j].id, pos);
    }
    return false;
  };

  // ---- uploads ------------------------------------------------------------
  const insertFiles = async (files, at) => {
    const list = files.map((f) => nameClipboardFile(f));
    const holders = list.map((f) => ({
      id: newId(),
      type: "uploading",
      name: f.name,
      preview: f.type?.startsWith("image/") ? URL.createObjectURL(f) : null,
    }));
    const cur = blocksRef.current;
    if (!at) {
      const ci = caret.current ? cur.findIndex((b) => b.id === caret.current.id) : -1;
      at = ci >= 0 ? { i: ci, pos: caret.current.pos } : { gap: cur.length };
    }
    if (at.gap !== undefined) commit(insertAtGap(cur, at.gap, holders));
    else {
      const r = insertAtCaret(cur, at.i, at.pos, holders);
      commit(r.blocks, r.focus);
    }
    const holderIds = new Set(holders.map((h) => h.id));
    try {
      const atts = await onUpload(list);
      if (!mounted.current) return onOrphanUpload(atts); // note closed meanwhile
      const made = atts.map(attachmentToBlock);
      const next = [];
      let placed = false;
      for (const b of blocksRef.current) {
        if (!holderIds.has(b.id)) next.push(b);
        else if (!placed) {
          next.push(...made);
          placed = true;
        }
      }
      if (!placed) next.push(...made);
      commit(next);
    } catch (err) {
      if (mounted.current) commit(blocksRef.current.filter((b) => !holderIds.has(b.id)));
      onUploadError(err);
    } finally {
      holders.forEach((h) => h.preview && URL.revokeObjectURL(h.preview));
    }
  };

  apiRef.current = {
    /** insert:true forces INSERT; otherwise nvim opens the note in NORMAL, like nvim opening a file. */
    focus({ insert = false } = {}) {
      const first = blocksRef.current.find(isText);
      if (!first) return;
      const normal = nvimRef.current && !insert;
      setMode(normal ? "normal" : "insert");
      focusBlock(rootRef.current, first.id, normal ? 0 : "end"); // nvim opens a file on its first line
    },
    insertFiles: (files) => insertFiles(files, null),
  };

  // ---- text editing -------------------------------------------------------
  const onText = (i, text) => {
    const b = blocksRef.current[i];
    const sc = b.type === "paragraph" || b.type === "bullet" ? markdownShortcut(text) : null;
    if (sc && (b.type === "paragraph" || sc.type === "todo")) {
      const nb = { id: b.id, ...sc };
      if (sc.type === "divider") {
        const p = paragraph();
        const next = [...blocksRef.current];
        next.splice(i, 1, nb, p);
        return commit(next, { id: p.id, pos: 0 });
      }
      return commit(replaceAt(i, nb), { id: b.id, pos: 0 });
    }
    commit(replaceAt(i, withText(b, text)));
  };

  const toggleTodo = (i) => {
    const b = blocksRef.current[i];
    if (b.type === "todo") commit(replaceAt(i, { ...b, checked: !b.checked }));
    else if (["paragraph", "bullet", "quote"].includes(b.type))
      commit(replaceAt(i, { id: b.id, type: "todo", checked: false, text: textOf(b) }), { id: b.id, pos: "end" });
  };

  // ---- nvim NORMAL mode ---------------------------------------------------
  const ARROWS = { ArrowLeft: "h", ArrowRight: "l", ArrowUp: "k", ArrowDown: "j", Enter: "j", Backspace: "h", Delete: "x" };
  const nextTextIdx = (i, dir) => {
    const l = blocksRef.current;
    for (let j = i + dir; j >= 0 && j < l.length; j += dir) if (isText(l[j])) return j;
    return -1;
  };
  const focusIdx = (j, pos) => {
    const t = textOf(blocksRef.current[j]);
    pendingFocus.current = null;
    focusBlock(rootRef.current, blocksRef.current[j].id, pos === "end" ? Math.max(0, t.length - 1) : clampNormal(t, pos));
  };
  const snap = (i, pos) => ({ md: serialize(blocksRef.current), i, pos });
  const restore = (sn) => {
    const next = parse(sn.md);
    const idx = Math.min(sn.i, next.length - 1);
    const target = isText(next[idx]) ? next[idx] : next.slice(idx).find(isText) || [...next].reverse().find(isText);
    commit(next, target ? { id: target.id, pos: clampNormal(textOf(target), sn.pos) } : null);
  };
  const doUndo = (i, pos) => {
    const sn = hist.current.undo(snap(i, pos));
    if (sn) restore(sn);
  };
  const doRedo = (i, pos) => {
    const sn = hist.current.redo(snap(i, pos));
    if (sn) restore(sn);
  };
  const leaveInsert = (el, i) => {
    const t = el.value;
    const pos = el.selectionStart;
    pendingFocus.current = { id: blocksRef.current[i].id, pos: clampNormal(t, pos > lineStart(t, pos) ? pos - 1 : pos) };
    pend.current = "";
    cnt.current = "";
    setMode("normal");
    onCommit?.();
  };

  const deleteBlocks = (i, n) => {
    const list = blocksRef.current;
    hist.current.push(snap(i, 0));
    reg.current = { blocks: list.slice(i, i + n) };
    let next = [...list.slice(0, i), ...list.slice(i + n)];
    if (!next.length) next = [paragraph()];
    const target = next.slice(Math.min(i, next.length - 1)).find(isText) || [...next].reverse().find(isText);
    commit(next, target ? { id: target.id, pos: 0 } : null);
  };

  const paste = (after, n, i, pos) => {
    const r = reg.current;
    if (!r) return;
    const b = blocksRef.current[i];
    const text = textOf(b);
    hist.current.push(snap(i, pos));
    if (r.blocks) {
      const copies = [];
      for (let c = 0; c < n; c++) copies.push(...r.blocks.map((x) => ({ ...x, id: newId() })));
      const at = after ? i + 1 : i;
      const next = [...blocksRef.current.slice(0, at), ...copies, ...blocksRef.current.slice(at)];
      const target = copies.find(isText);
      return commit(next, target ? { id: target.id, pos: 0 } : null);
    }
    const ins = r.text.repeat(n);
    const at = after && text.length ? pos + 1 : pos;
    const nt = text.slice(0, at) + ins + text.slice(at);
    commit(replaceAt(i, withText(b, nt)), { id: b.id, pos: clampNormal(nt, at + ins.length - 1) });
  };

  const openBlock = (below, i, pos) => {
    const b = blocksRef.current[i];
    hist.current.push(snap(i, pos));
    const type = b.type === "bullet" || b.type === "todo" ? b.type : "paragraph";
    const nb = { id: newId(), type, text: "", ...(type === "todo" ? { checked: false } : {}) };
    const at = below ? i + 1 : i;
    commit([...blocksRef.current.slice(0, at), nb, ...blocksRef.current.slice(at)], { id: nb.id, pos: 0 });
    setMode("insert");
  };

  const moveVert = (dir, n, i, pos) => {
    let bi = i;
    let p = pos;
    let t = textOf(blocksRef.current[bi]);
    for (let c = 0; c < n; c++) {
      const v = vertical(t, p, dir);
      if (v !== null) { p = v; continue; }
      const j = nextTextIdx(bi, dir);
      if (j < 0) break;
      const col = p - lineStart(t, p);
      bi = j;
      t = textOf(blocksRef.current[bi]);
      const ls = dir > 0 ? 0 : lineStart(t, t.length); // enter the first line going down, the last going up
      p = Math.min(ls + col, lineEnd(t, ls));
    }
    focusIdx(bi, p);
  };

  const normalKey = (e, i) => {
    const k = e.key;
    const el = e.currentTarget;
    if (e.ctrlKey || e.metaKey) {
      if (e.ctrlKey && (k === "l" || k === "L")) { e.preventDefault(); e.stopPropagation(); toggleTodo(i); }
      else if (e.ctrlKey && (k === "r" || k === "R")) { e.preventDefault(); e.stopPropagation(); doRedo(i, el.selectionStart); }
      return; // other chords (Ctrl+K, F1…) keep their app meaning
    }
    if (e.altKey || /^F\d+$/.test(k)) return;
    if (k === "Escape") {
      // Esc with nothing pending leaves the editor (DailyView handles it); with a pending command it only cancels that.
      if (pend.current || cnt.current) { e.preventDefault(); e.stopPropagation(); pend.current = ""; cnt.current = ""; }
      return;
    }
    e.preventDefault();
    e.stopPropagation(); // NORMAL never types, and the list-level keys must not fire
    const key = ARROWS[k] || k;
    if (key.length !== 1) return; // Shift, Tab, …
    if (/[0-9]/.test(key) && !(key === "0" && !cnt.current)) { cnt.current += key; return; }

    const b = blocksRef.current[i];
    const text = el.value;
    const pos = el.selectionStart;
    const n = Math.max(1, Number(cnt.current) || 1);
    const pending = pend.current;
    pend.current = "";
    if (!pending && !"dycgr".includes(key)) cnt.current = "";
    else if (pending) cnt.current = "";

    const setText = (nt, p, insert = false) => {
      commit(replaceAt(i, withText(b, nt)), { id: b.id, pos: insert ? p : clampNormal(nt, p) });
      if (insert) setMode("insert");
    };
    const remember = () => hist.current.push(snap(i, pos));
    const enterAt = (p) => {
      remember();
      pendingFocus.current = { id: b.id, pos: p };
      setMode("insert");
    };

    // ── second key of a two-key command
    if (pending === "g") {
      if (key === "g") { const j = blocksRef.current.findIndex(isText); if (j >= 0) focusIdx(j, 0); }
      return;
    }
    if (pending === "r") {
      const to = pos + n;
      if (to > lineEnd(text, pos)) return;
      remember();
      return setText(text.slice(0, pos) + key.repeat(n) + text.slice(to), pos + n - 1);
    }
    if (pending === "d" || pending === "y" || pending === "c") {
      if (key === pending) {
        if (pending === "d") return deleteBlocks(i, n);
        if (pending === "y") { reg.current = { blocks: blocksRef.current.slice(i, i + n) }; return; }
        remember();
        reg.current = { text };
        return setText("", 0, true); // cc
      }
      const r = operatorRange(text, pos, key, pending);
      if (!r || r.from === r.to) return;
      const { text: nt, removed } = cut(text, r.from, r.to);
      reg.current = { text: removed };
      if (pending === "y") return focusIdx(i, r.from);
      remember();
      return setText(nt, r.from, pending === "c");
    }

    switch (key) {
      case "h": case "l": case "0": case "^": case "$": case "w": case "b": case "e": {
        const r = motion(text, pos, key, n);
        if (r.cross) {
          const j = nextTextIdx(i, r.cross === "next" ? 1 : -1);
          if (j >= 0) return focusIdx(j, r.cross === "next" ? 0 : "end");
        }
        return focusIdx(i, r.pos);
      }
      case "j": return moveVert(1, n, i, pos);
      case "k": return moveVert(-1, n, i, pos);
      case "g": pend.current = "g"; return;
      case "G": { const l = blocksRef.current; for (let j = l.length - 1; j >= 0; j--) if (isText(l[j])) return focusIdx(j, 0); return; }
      case "i": return enterAt(pos);
      case "a": return enterAt(Math.min(pos + 1, text.length));
      case "I": return enterAt(lineStart(text, pos));
      case "A": return enterAt(lineEnd(text, pos));
      case "o": return openBlock(true, i, pos);
      case "O": return openBlock(false, i, pos);
      case "x": case "s": {
        const to = Math.min(pos + n, lineEnd(text, pos));
        if (pos >= to) return key === "s" ? enterAt(pos) : undefined;
        remember();
        const { text: nt, removed } = cut(text, pos, to);
        reg.current = { text: removed };
        return setText(nt, pos, key === "s");
      }
      case "X": {
        const from = Math.max(lineStart(text, pos), pos - n);
        if (from >= pos) return;
        remember();
        const { text: nt, removed } = cut(text, from, pos);
        reg.current = { text: removed };
        return setText(nt, from);
      }
      case "D": case "C": {
        const to = lineEnd(text, pos);
        if (pos >= to) return key === "C" ? enterAt(pos) : undefined;
        remember();
        const { text: nt, removed } = cut(text, pos, to);
        reg.current = { text: removed };
        return setText(nt, pos, key === "C");
      }
      case "S": remember(); reg.current = { text }; return setText("", 0, true);
      case "d": case "y": case "c": case "r": pend.current = key; return;
      case "p": return paste(true, n, i, pos);
      case "P": return paste(false, n, i, pos);
      case "u": return doUndo(i, pos);
      default: return; // unmapped keys are swallowed
    }
  };

  // Toggle-block body is a bare textarea outside the block model: in NORMAL it
  // only blocks typing; i/a switch to INSERT, Esc (INSERT) goes back to NORMAL.
  const bodyKey = (e) => {
    if (!nvimRef.current || e.isComposing) return;
    const k = e.key;
    if (vimRef.current === "insert") {
      if (k === "Escape") { e.preventDefault(); e.stopPropagation(); setMode("normal"); onCommit?.(); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || k === "Escape" || /^F\d+$/.test(k)) return;
    e.preventDefault();
    e.stopPropagation();
    if (k === "i" || k === "a") setMode("insert");
  };

  const onKeyDown = (e, i) => {
    const el = e.currentTarget;
    if (nvimRef.current && !e.isComposing) {
      if (vimRef.current === "normal") return normalKey(e, i);
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); return leaveInsert(el, i); }
    }
    const b = blocksRef.current[i];
    const pos = el.selectionStart;
    const collapsed = pos === el.selectionEnd;
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.isComposing) {
      if (MULTILINE_TYPES.has(b.type)) {
        // Enter on a trailing empty line leaves the code/callout block.
        if (collapsed && pos === el.value.length && el.value.endsWith("\n")) {
          e.preventDefault();
          const p = paragraph();
          const next = [...blocksRef.current];
          next.splice(i, 1, withText(b, el.value.slice(0, -1)), p);
          commit(next, { id: p.id, pos: 0 });
        }
        return;
      }
      e.preventDefault();
      const r = splitBlock(blocksRef.current, i, pos);
      commit(r.blocks, r.focus);
    } else if (e.key === "Backspace" && collapsed && pos === 0) {
      const r = backspaceAtStart(blocksRef.current, i);
      if (r) {
        e.preventDefault();
        commit(r.blocks, r.focus);
      }
    } else if (e.key === "ArrowUp" && collapsed && !el.value.slice(0, pos).includes("\n")) {
      if (focusSibling(i, -1, "end")) e.preventDefault();
    } else if (e.key === "ArrowDown" && collapsed && !el.value.slice(pos).includes("\n")) {
      if (focusSibling(i, 1, 0)) e.preventDefault();
    } else if (e.ctrlKey && (e.key === "l" || e.key === "L")) {
      e.preventDefault();
      toggleTodo(i);
    } else if (e.ctrlKey && e.key === ";") {
      e.preventDefault();
      applyEdit(el, insertTimeStamp(el.value, pos));
    } else if (e.key === "Tab" && b.type === "code" && collapsed) {
      e.preventDefault();
      applyEdit(el, { text: `${el.value.slice(0, pos)}  ${el.value.slice(pos)}`, caret: pos + 2 });
    }
  };

  const trackCaret = (b) => (e) => {
    caret.current = { id: b.id, pos: e.currentTarget.selectionStart };
  };

  // ---- paste / drag & drop ------------------------------------------------
  const onPaste = (e) => {
    const items = [...(e.clipboardData?.items || [])];
    if (items.some((it) => it.type === "text/plain")) return; // normal text paste
    const files = items.filter((it) => it.kind === "file").map((it) => it.getAsFile()).filter(Boolean);
    if (!files.length) return;
    e.preventDefault();
    const bid = e.target?.dataset?.bid;
    const i = bid ? blocksRef.current.findIndex((b) => b.id === bid) : -1;
    insertFiles(files, i >= 0 ? { i, pos: e.target.selectionStart } : null);
  };

  const accepts = (e) => {
    const types = [...(e.dataTransfer?.types || [])];
    return types.includes("Files") || types.includes(BLOCK_MIME);
  };
  // Gap index under the pointer: before the first row whose middle is below it.
  const gapAt = (y) => {
    const rows = rootRef.current.querySelectorAll(":scope > .blk-row");
    for (let k = 0; k < rows.length; k++) {
      const r = rows[k].getBoundingClientRect();
      if (y < r.top + r.height / 2) return k;
    }
    return rows.length;
  };
  const dropProps = {
    onDragOver: (e) => {
      if (!accepts(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = dragFrom.current != null ? "move" : "copy";
      const g = gapAt(e.clientY);
      if (g !== dropGap) setDropGap(g);
    },
    onDragLeave: (e) => {
      if (!rootRef.current.contains(e.relatedTarget)) setDropGap(null);
    },
    onDrop: (e) => {
      if (!accepts(e)) return;
      e.preventDefault();
      const g = gapAt(e.clientY);
      setDropGap(null);
      if (dragFrom.current != null) {
        commit(moveToGap(blocksRef.current, dragFrom.current, g));
        dragFrom.current = null;
      } else if (e.dataTransfer.files.length) {
        insertFiles([...e.dataTransfer.files], { gap: g });
      }
    },
  };
  // Hide the line when a dragged block would land where it already is.
  const from = dragFrom.current;
  const showGap = (g) => dropGap === g && !(from != null && (g === from || g === from + 1));

  // ---- render -------------------------------------------------------------
  const textProps = (b, i, extra = {}) => ({
    "data-bid": b.id,
    onInput: (e) => onText(i, e.currentTarget.value),
    onKeyDown: (e) => onKeyDown(e, i),
    "data-vim": nvim && vim === "normal" ? "normal" : undefined,
    // NORMAL never edits: block typing/IME, paste and cut at the source.
    onBeforeInput: (e) => { if (nvimRef.current && vimRef.current === "normal") e.preventDefault(); },
    onPaste: (e) => { if (nvimRef.current && vimRef.current === "normal") { e.preventDefault(); e.stopPropagation(); } },
    onCut: (e) => { if (nvimRef.current && vimRef.current === "normal") e.preventDefault(); },
    onSelect: trackCaret(b),
    onFocus: trackCaret(b),
    onKeyUp: trackCaret(b),
    onBlur: onCommit,
    ...extra,
  });

  const onlyEmpty = blocks.length === 1 && blocks[0].type === "paragraph" && !blocks[0].text;

  const renderBlock = (b, i) => {
    switch (b.type) {
      case "image":
        return (
          <div class="blk-media">
            <img src={b.url} alt={b.alt} title={`${b.alt || "ảnh"} — click để mở`} draggable={false} onClick={() => openExternal(b.url)} />
            <button class="blk-x" title="Xoá ảnh" onClick={() => removeAt(i)}>×</button>
          </div>
        );
      case "uploading":
        return (
          <div class="blk-media uploading">
            {b.preview ? <img src={b.preview} alt="" draggable={false} /> : <span class="blk-file-name">📄 {b.name}</span>}
            <span class="blk-uploading-label">Đang tải lên…</span>
          </div>
        );
      case "file":
        return (
          <div class="blk-file">
            <button class="link blk-file-name" title={`Mở ${b.label}`} onClick={() => openExternal(b.url)}>📄 {b.label}</button>
            <button class="blk-x inline" title="Xoá file" onClick={() => removeAt(i)}>×</button>
          </div>
        );
      case "divider":
        return (
          <div class="blk-divider">
            <hr />
            <button class="blk-x" title="Xoá" onClick={() => removeAt(i)}>×</button>
          </div>
        );
      case "toggle":
        return (
          <div class="blk-toggle">
            <div class="blk-line">
              <span class="blk-prefix">▸</span>
              <AutoText class="blk-text" value={b.title || ""} placeholder="Toggle" {...textProps(b, i)} />
            </div>
            <AutoText
              class="blk-text blk-toggle-body"
              value={b.children || ""}
              placeholder="Nội dung bên trong"
              data-bid={`${b.id}:c`}
              data-vim={nvim && vim === "normal" ? "normal" : undefined}
              onKeyDown={bodyKey}
              onBeforeInput={(e) => { if (nvimRef.current && vimRef.current === "normal") e.preventDefault(); }}
              onInput={(e) => commit(replaceAt(i, { ...blocksRef.current[i], children: e.currentTarget.value }))}
              onBlur={onCommit}
            />
          </div>
        );
      default: {
        let prefix = null;
        if (b.type === "bullet") prefix = <span class="blk-prefix">•</span>;
        else if (b.type === "todo")
          prefix = (
            <button
              class="blk-check"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault() /* keep the caret */}
              onClick={() => toggleTodo(i)}
            >
              {b.checked ? "[x]" : "[ ]"}
            </button>
          );
        else if (b.type === "callout") prefix = <span class="blk-prefix">{CALLOUT_KINDS[b.kind]?.icon || "💡"}</span>;
        return (
          <div class={`blk-line blk-${b.type}${b.type === "todo" && b.checked ? " checked" : ""}`}>
            {prefix}
            <AutoText
              class="blk-text"
              value={b.text || ""}
              placeholder={
                onlyEmpty
                  ? "Viết gì đó…  (# tiêu đề, - danh sách, [] việc cần làm, Ctrl+V dán ảnh)"
                  : b.type === "paragraph"
                    ? "Gõ để viết, Ctrl+V dán ảnh…"
                    : ""
              }
              {...textProps(b, i, onlyEmpty ? { class: "blk-text always-placeholder" } : {})}
            />
          </div>
        );
      }
    }
  };

  return (
    <div class={`blocks${nvim && vim === "normal" ? " vim-normal" : ""}`} ref={rootRef} onPaste={onPaste} {...dropProps}>
      {blocks.map((b, i) => (
        <div class="blk-row" key={b.id}>
          {showGap(i) && <div class="drop-line" />}
          <span
            class="blk-handle"
            draggable={b.type !== "uploading"}
            title="Kéo để di chuyển"
            onDragStart={(e) => {
              dragFrom.current = i;
              e.dataTransfer.setData(BLOCK_MIME, String(i));
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setDragImage(e.currentTarget.parentElement, 12, 12);
            }}
            onDragEnd={() => {
              dragFrom.current = null;
              setDropGap(null);
            }}
          >
            ⠿
          </span>
          <div class="blk-body">{renderBlock(b, i)}</div>
        </div>
      ))}
      {showGap(blocks.length) && <div class="drop-line end" />}
      <div
        class="blk-tail"
        onMouseDown={(e) => {
          e.preventDefault();
          const list = blocksRef.current;
          const last = list[list.length - 1];
          if (last && isText(last) && last.type !== "toggle") focusBlock(rootRef.current, last.id, "end");
          else {
            const p = paragraph();
            commit([...list, p], { id: p.id, pos: 0 });
          }
        }}
      />
    </div>
  );
}
