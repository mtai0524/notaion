import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import EntryForm from './EntryForm';
import { CARD_FIELDS, SENTENCE_FIELDS, listProps } from './fields';
import Panel, { EmptyRow } from './Panel';
import { stepIndex, useKeys } from './keys';
import { newCardSchedule } from './schedule';

const matches = (sentence, query) => {
  const needle = query.toLowerCase();
  return [sentence.en, sentence.vi, sentence.tag].some((value) => (value || '').toLowerCase().includes(needle));
};

const SentencesTab = ({ sentences, add, update, remove }) => {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [form, setForm] = useState(null);
  const searchRef = useRef(null);

  const shown = query ? sentences.filter((sentence) => matches(sentence, query)) : sentences;
  const selected = shown[Math.min(index, shown.length - 1)];

  const save = (fields) => {
    if (form.kind === 'card') add('cards', { ...fields, ...newCardSchedule() });
    else if (form.id) update('sentences', form.id, fields);
    else add('sentences', fields);
    setForm(null);
  };

  const openForm = (e, nextForm) => {
    e.preventDefault();
    setForm(nextForm);
  };

  const removeSelected = () => {
    if (!selected || !window.confirm('Delete this sentence?')) return;
    remove('sentences', selected.id);
  };

  useKeys((e) => {
    if (e.key === 'n') return openForm(e, { kind: 'sentence', initial: {} });
    if (e.key === 'e' && selected) return openForm(e, { kind: 'sentence', id: selected.id, initial: selected });
    if (e.key === 'c' && selected) {
      return openForm(e, { kind: 'card', initial: { front: selected.en, back: selected.vi, example: selected.en } });
    }
    if (e.key === '/') {
      e.preventDefault();
      searchRef.current?.focus();
      return undefined;
    }
    if (e.key === 'd') removeSelected();
    setIndex((current) => stepIndex(e.key, current, shown.length));
    return undefined;
  }, { enabled: !form, capture: true });

  const onSearchKeyDown = (e) => {
    if (e.key !== 'Escape' && e.key !== 'Enter') return;
    if (e.key === 'Escape') setQuery('');
    e.currentTarget.blur();
  };

  return (
    <>
      <Panel title={`SENTENCES · ${sentences.length}`} focused className="eng-main">
        <input ref={searchRef} className="eng-search" placeholder="/ search english, meaning or tag" value={query}
               onChange={(e) => { setQuery(e.target.value); setIndex(0); }} onKeyDown={onSearchKeyDown} />
        {shown.map((sentence, row) => (
          <div key={sentence.id} className={`eng-sentence ${sentence === selected ? 'cur' : ''}`} onClick={() => setIndex(row)}>
            <div className="eng-sentence-en">{sentence.en}</div>
            <div className="eng-dim">
              {sentence.vi} {sentence.tag && <span className="eng-tag">{sentence.tag}</span>}
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <EmptyRow>{query ? 'no matches' : 'no sentences yet — press n, or select text in READING'}</EmptyRow>
        )}
      </Panel>
      {form && (
        <EntryForm title={form.kind === 'card' ? 'NEW CARD' : (form.id ? 'EDIT SENTENCE' : 'NEW SENTENCE')}
                   fields={form.kind === 'card' ? CARD_FIELDS : SENTENCE_FIELDS} initial={form.initial}
                   onSave={save} onCancel={() => setForm(null)} />
      )}
    </>
  );
};

SentencesTab.propTypes = {
  sentences: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    en: PropTypes.string.isRequired,
    vi: PropTypes.string,
    tag: PropTypes.string,
  })).isRequired,
  ...listProps,
};

export default SentencesTab;
