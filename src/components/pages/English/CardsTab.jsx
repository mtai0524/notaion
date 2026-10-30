import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import EntryForm from './EntryForm';
import { CARD_FIELDS, listProps } from './fields';
import Panel, { EmptyRow } from './Panel';
import { stepIndex, useKeys } from './keys';
import { GRADES, formatDue, formatInterval, gradeCard, isDue, newCardSchedule, nextInterval, sortByDue } from './schedule';

const CardFace = ({ card, flipped, onFlip, onGrade }) => (
  <div className="eng-card">
    <div className="eng-card-front">{card.front}</div>
    {!flipped && <button type="button" className="eng-btn" onClick={onFlip}>space: show answer</button>}
    {flipped && (
      <>
        <div className="eng-card-back">{card.back || <span className="eng-dim">(no meaning)</span>}</div>
        {card.example && <div className="eng-card-example">&ldquo;{card.example}&rdquo;</div>}
        {onGrade && (
          <div className="eng-grades">
            {GRADES.map(({ grade, label }) => (
              <button key={grade} type="button" className="eng-btn" onClick={() => onGrade(grade)}>
                {grade} {label} · {formatInterval(nextInterval(card, grade))}
              </button>
            ))}
          </div>
        )}
      </>
    )}
  </div>
);

const CardsTab = ({ cards, add, update, remove }) => {
  const deck = useMemo(() => sortByDue(cards), [cards]);
  const queue = deck.filter((card) => isDue(card));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [form, setForm] = useState(null);

  // The deck is sorted by due date, so row 0 is the next card to review; after
  // grading, the card moves down and the next one slides into the same row.
  const selected = deck[Math.min(index, deck.length - 1)];

  const select = (row) => {
    setIndex(row);
    setFlipped(false);
  };

  const grade = (value) => {
    update('cards', selected.id, gradeCard(selected, value));
    setFlipped(false);
  };

  const save = (fields) => {
    if (form.id) update('cards', form.id, fields);
    else add('cards', { ...fields, ...newCardSchedule() });
    setForm(null);
  };

  const removeSelected = () => {
    if (!selected || !window.confirm(`Delete card "${selected.front}"?`)) return;
    remove('cards', selected.id);
  };

  useKeys((e) => {
    const gradeKey = GRADES.find(({ grade: value }) => String(value) === e.key);
    if (gradeKey && selected && flipped) {
      e.preventDefault();
      grade(gradeKey.grade);
      return;
    }
    if (e.key === ' ' && selected) {
      e.preventDefault();
      setFlipped((current) => !current);
      return;
    }
    if (e.key === 'n') {
      e.preventDefault();
      setForm({ initial: {} });
      return;
    }
    if (e.key === 'e' && selected) {
      e.preventDefault();
      setForm({ id: selected.id, initial: selected });
      return;
    }
    if (e.key === 'd') removeSelected();
    const next = stepIndex(e.key, Math.min(index, deck.length - 1), deck.length);
    if (next !== index) select(next);
  }, { enabled: !form, capture: true });

  return (
    <>
      <Panel title={`DECK · ${cards.length}`} className="eng-side">
        {deck.map((card, row) => (
          <div key={card.id} className={`eng-row ${card === selected ? 'cur' : ''}`} onClick={() => select(row)}>
            <span>{card.front}</span><span className="eng-dim">{formatDue(card)}</span>
          </div>
        ))}
        <div className="eng-row eng-dim" onClick={() => setForm({ initial: {} })}>+ new card (n)</div>
      </Panel>
      <Panel title={selected && isDue(selected) ? `REVIEW · ${queue.length} due` : 'CARD'} focused className="eng-main">
        {selected && queue.length === 0 && <EmptyRow>nothing due — nice work. Browsing the deck:</EmptyRow>}
        {selected && <CardFace card={selected} flipped={flipped} onFlip={() => setFlipped(true)} onGrade={grade} />}
        {!selected && <EmptyRow>no cards yet — press n, or click a word in READING</EmptyRow>}
      </Panel>
      {form && (
        <EntryForm title={form.id ? 'EDIT CARD' : 'NEW CARD'} fields={CARD_FIELDS} initial={form.initial}
                   onSave={save} onCancel={() => setForm(null)} />
      )}
    </>
  );
};

const cardShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  front: PropTypes.string.isRequired,
  back: PropTypes.string,
  example: PropTypes.string,
  interval: PropTypes.number.isRequired,
  ease: PropTypes.number.isRequired,
  due: PropTypes.number.isRequired,
});

CardFace.propTypes = {
  card: cardShape.isRequired,
  flipped: PropTypes.bool.isRequired,
  onFlip: PropTypes.func.isRequired,
  onGrade: PropTypes.func,
};

CardsTab.propTypes = { cards: PropTypes.arrayOf(cardShape).isRequired, ...listProps };

export default CardsTab;
