import { useState } from 'react';
import CardsTab from './CardsTab';
import ReadingTab from './ReadingTab';
import SentencesTab from './SentencesTab';
import WritingTab from './WritingTab';
import { useEnglishData } from './englishData';
import { useKeys } from './keys';
import { isDue } from './schedule';
import './English.scss';

const TABS = [
  { key: 'cards', label: 'CARDS', hint: 'j/k:move space:flip 1-4:grade n:new e:edit d:delete' },
  { key: 'sentences', label: 'SENTENCES', hint: 'j/k:move n:new e:edit c:to card d:delete /:search' },
  { key: 'reading', label: 'READING', hint: 'j/k:move n:paste text d:delete · click word: card · select text: sentence' },
  { key: 'writing', label: 'WRITING', hint: 'j/k:move n:new i:write ctrl+enter:check esc:leave editor d:delete' },
];
const TAB_KEY = 'english-tab';

const loadTab = () => {
  const saved = localStorage.getItem(TAB_KEY);
  return TABS.some((tab) => tab.key === saved) ? saved : 'cards';
};

const English = () => {
  const { data, syncing, preparing, syncError, add, update, remove } = useEnglishData();
  const [tab, setTab] = useState(loadTab);
  const dueCount = data.cards.filter((card) => isDue(card)).length;
  const lists = { add, update, remove };

  const switchTab = (key) => {
    setTab(key);
    localStorage.setItem(TAB_KEY, key);
  };

  useKeys((e) => {
    if (e.defaultPrevented) return;
    const next = TABS[Number(e.key) - 1];
    if (next) switchTab(next.key);
  });

  return (
    <div className="eng">
      <div className="eng-tabs">
        {TABS.map((item, index) => (
          <button key={item.key} type="button" className={`eng-chip ${tab === item.key ? 'on' : ''}`}
                  onClick={() => switchTab(item.key)}>
            {index + 1} {item.label}
          </button>
        ))}
        <span className="eng-dim eng-tabs-info">{dueCount} due · {data.cards.length} cards</span>
      </div>
      <div className="eng-body">
        {tab === 'cards' && <CardsTab cards={data.cards} {...lists} />}
        {tab === 'sentences' && <SentencesTab sentences={data.sentences} {...lists} />}
        {tab === 'reading' && <ReadingTab texts={data.texts} cards={data.cards} add={add} remove={remove} />}
        {tab === 'writing' && <WritingTab writings={data.writings} {...lists} />}
      </div>
      <div className="eng-status">
        <b>NORMAL</b>
        <span>1-4:tab {TABS.find((item) => item.key === tab).hint}</span>
        {syncing && <span className="eng-sync">syncing…</span>}
        {preparing && <span className="eng-sync">preparing today&apos;s lesson…</span>}
        {syncError && <span className="eng-sync eng-error">{syncError}</span>}
      </div>
    </div>
  );
};

export default English;
