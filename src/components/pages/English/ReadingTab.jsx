import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import EntryForm from './EntryForm';
import { CARD_FIELDS, SENTENCE_FIELDS, TEXT_FIELDS, listProps } from './fields';
import Panel, { EmptyRow } from './Panel';
import { stepIndex, useKeys } from './keys';
import { newCardSchedule } from './schedule';
import { normalizeWord, sentenceAt, tokenize } from './text';

const FORMS = {
  text: { title: 'NEW TEXT', fields: TEXT_FIELDS, list: 'texts' },
  card: { title: 'NEW CARD', fields: CARD_FIELDS, list: 'cards' },
  sentence: { title: 'NEW SENTENCE', fields: SENTENCE_FIELDS, list: 'sentences' },
};

const titleOf = (text) => text.title || text.body.slice(0, 24);
const countWords = (body) => body.split(/\s+/).filter(Boolean).length;
const selectedText = () => window.getSelection()?.toString().trim() || '';

// One paragraph; words are clickable and the ones already in the deck are marked.
const Paragraph = ({ paragraph, knownWords, onWord }) => {
  let offset = 0;
  return (
    <p>
      {tokenize(paragraph).map((token, index) => {
        const start = offset;
        offset += token.length;
        if (index % 2 === 0) return token;
        const known = knownWords.has(normalizeWord(token));
        return (
          <span key={start} className={`eng-word ${known ? 'known' : ''}`}
                onClick={() => onWord(token, sentenceAt(paragraph, start))}>
            {token}
          </span>
        );
      })}
    </p>
  );
};

const ReadingTab = ({ texts, cards, add, remove }) => {
  const [index, setIndex] = useState(0);
  const [form, setForm] = useState(null);
  const selected = texts[Math.min(index, texts.length - 1)];
  const knownWords = useMemo(() => new Set(cards.map((card) => normalizeWord(card.front))), [cards]);

  const save = (fields) => {
    add(FORMS[form.kind].list, form.kind === 'card' ? { ...fields, ...newCardSchedule() } : fields);
    if (form.kind === 'text') setIndex(0);
    setForm(null);
  };

  const onWord = (word, sentence) => {
    if (selectedText().includes(' ')) return;
    setForm({ kind: 'card', initial: { front: normalizeWord(word), example: sentence } });
  };

  const onMouseUp = () => {
    const text = selectedText();
    if (!text.includes(' ')) return;
    setForm({ kind: 'sentence', initial: { en: text } });
  };

  const removeSelected = () => {
    if (!selected || !window.confirm(`Delete text "${titleOf(selected)}"?`)) return;
    remove('texts', selected.id);
  };

  useKeys((e) => {
    if (e.key === 'n') {
      e.preventDefault();
      setForm({ kind: 'text', initial: {} });
      return;
    }
    if (e.key === 'd') removeSelected();
    setIndex((current) => stepIndex(e.key, current, texts.length));
  }, { enabled: !form, capture: true });

  return (
    <>
      <Panel title={`TEXTS · ${texts.length}`} className="eng-side">
        {texts.map((text, row) => (
          <div key={text.id} className={`eng-row ${text === selected ? 'cur' : ''}`} onClick={() => setIndex(row)}>
            <span>{titleOf(text)}</span>
          </div>
        ))}
        <div className="eng-row eng-dim" onClick={() => setForm({ kind: 'text', initial: {} })}>+ paste text (n)</div>
      </Panel>
      <Panel title={selected ? `${titleOf(selected).toUpperCase()} · ${countWords(selected.body)} words` : 'READING'}
             focused className="eng-main">
        {selected ? (
          <div className="eng-reading" onMouseUp={onMouseUp}>
            {selected.body.split(/\n+/).filter((paragraph) => paragraph.trim()).map((paragraph, row) => (
              <Paragraph key={row} paragraph={paragraph} knownWords={knownWords} onWord={onWord} />
            ))}
          </div>
        ) : (
          <EmptyRow>no texts yet — press n and paste an article</EmptyRow>
        )}
      </Panel>
      {form && (
        <EntryForm title={FORMS[form.kind].title} fields={FORMS[form.kind].fields} initial={form.initial}
                   onSave={save} onCancel={() => setForm(null)} />
      )}
    </>
  );
};

Paragraph.propTypes = {
  paragraph: PropTypes.string.isRequired,
  knownWords: PropTypes.instanceOf(Set).isRequired,
  onWord: PropTypes.func.isRequired,
};

ReadingTab.propTypes = {
  texts: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string,
    body: PropTypes.string.isRequired,
  })).isRequired,
  cards: PropTypes.arrayOf(PropTypes.shape({ front: PropTypes.string.isRequired })).isRequired,
  add: listProps.add,
  remove: listProps.remove,
};

export default ReadingTab;
