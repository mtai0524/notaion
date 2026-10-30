import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { checkTextAsync } from './englishApi';
import { listProps } from './fields';
import Panel, { EmptyRow } from './Panel';
import { stepIndex, useKeys } from './keys';
import { diffWords } from './text';

const formatDate = (time) => new Date(time).toISOString().slice(0, 10).replaceAll('-', '_');

const errorMessage = (err) => {
  if (err.response?.status === 401) return 'log in to use the AI check';
  if (err.response?.status === 429) return 'too many checks — wait a minute and try again';
  return err.response?.data?.error?.message || 'could not reach the server';
};

const Feedback = ({ result, stale }) => (
  <>
    <div className="eng-diff">
      {diffWords(result.checkedBody, result.corrected).map((part, index) => {
        if (part.type === 'del') return <del key={index}>{part.text} </del>;
        if (part.type === 'ins') return <ins key={index}>{part.text} </ins>;
        return <span key={index}>{part.text} </span>;
      })}
    </div>
    {result.notes.length > 0 ? (
      <ul className="eng-notes">{result.notes.map((note) => <li key={note}>{note}</li>)}</ul>
    ) : (
      <EmptyRow>no mistakes found</EmptyRow>
    )}
    <div className="eng-dim">score {result.score}/10{stale && ' · edited since this check (ctrl+enter to re-check)'}</div>
  </>
);

const WritingTab = ({ writings, add, update, remove }) => {
  const [index, setIndex] = useState(0);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const editorRef = useRef(null);
  const selected = writings[Math.min(index, writings.length - 1)];

  const startNew = () => {
    add('writings', { body: '', result: null });
    setIndex(0);
    setTimeout(() => editorRef.current?.focus());
  };

  const checkAsync = async () => {
    const body = selected?.body.trim();
    if (!body || checking) return;
    setChecking(true);
    setError('');
    try {
      const result = await checkTextAsync(body);
      update('writings', selected.id, { result: { ...result, checkedBody: body } });
    } catch (err) {
      console.error('[ENGLISH] Writing check failed:', err);
      setError(errorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  const removeSelected = () => {
    if (!selected || !window.confirm('Delete this writing?')) return;
    remove('writings', selected.id);
  };

  useKeys((e) => {
    if (e.key === 'n') {
      e.preventDefault();
      startNew();
      return;
    }
    if (e.key === 'i' && selected) {
      e.preventDefault();
      editorRef.current?.focus();
      return;
    }
    if (e.key === 'd') removeSelected();
    setIndex((current) => stepIndex(e.key, current, writings.length));
  }, { capture: true });

  const onEditorKeyDown = (e) => {
    if (e.key === 'Escape') e.currentTarget.blur();
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      checkAsync();
    }
  };

  return (
    <>
      <Panel title={`WRITINGS · ${writings.length}`} className="eng-side eng-narrow">
        {writings.map((writing, row) => (
          <div key={writing.id} className={`eng-row ${writing === selected ? 'cur' : ''}`} onClick={() => setIndex(row)}>
            <span>{formatDate(writing.createdAt)}</span>
            <span className="eng-dim">{writing.result ? `${writing.result.score}/10` : ''}</span>
          </div>
        ))}
        <div className="eng-row eng-dim" onClick={startNew}>+ new (n)</div>
      </Panel>
      <Panel title={selected ? `WRITE · ${formatDate(selected.createdAt)}` : 'WRITE'} focused className="eng-main">
        {selected?.prompt && (
          <div className="eng-prompt"><b>TODAY&apos;S TASK</b>{selected.prompt}</div>
        )}
        {selected ? (
          <textarea ref={editorRef} className="eng-editor" value={selected.body} onKeyDown={onEditorKeyDown}
                    placeholder="Write a few sentences in English, then press Ctrl+Enter"
                    onChange={(e) => update('writings', selected.id, { body: e.target.value })} />
        ) : (
          <EmptyRow>press n to start writing</EmptyRow>
        )}
      </Panel>
      <Panel title="FEEDBACK" className="eng-main">
        {checking && <EmptyRow>checking…</EmptyRow>}
        {error && <div className="eng-error">{error}</div>}
        {!checking && selected?.result && (
          <Feedback result={selected.result} stale={selected.result.checkedBody !== selected.body.trim()} />
        )}
        {!checking && selected && !selected.result && !error && <EmptyRow>ctrl+enter in the editor to check</EmptyRow>}
      </Panel>
    </>
  );
};

const resultShape = PropTypes.shape({
  corrected: PropTypes.string.isRequired,
  notes: PropTypes.arrayOf(PropTypes.string).isRequired,
  score: PropTypes.number.isRequired,
  checkedBody: PropTypes.string.isRequired,
});

Feedback.propTypes = { result: resultShape.isRequired, stale: PropTypes.bool.isRequired };

WritingTab.propTypes = {
  writings: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    body: PropTypes.string.isRequired,
    prompt: PropTypes.string,
    createdAt: PropTypes.number.isRequired,
    result: resultShape,
  })).isRequired,
  ...listProps,
};

export default WritingTab;
