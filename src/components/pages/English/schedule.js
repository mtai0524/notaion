// Spaced repetition for flashcards: a light SM-2. Grades are
// 1 again · 2 hard · 3 good · 4 easy; intervals are whole days.

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3;
export const GRADES = [
  { grade: 1, label: 'again' },
  { grade: 2, label: 'hard' },
  { grade: 3, label: 'good' },
  { grade: 4, label: 'easy' },
];

export const newCardSchedule = (now = Date.now()) => ({ interval: 0, ease: 2.5, due: now });

const nextEase = (ease, grade) => {
  const change = { 1: -0.2, 2: -0.15, 3: 0, 4: 0.15 }[grade];
  return Math.max(MIN_EASE, Math.round((ease + change) * 100) / 100);
};

export const nextInterval = (card, grade) => {
  if (grade === 1) return 0;
  if (grade === 2) return Math.max(1, Math.round(card.interval * 1.2));
  if (grade === 3) return card.interval === 0 ? 1 : Math.round(card.interval * card.ease);
  return card.interval === 0 ? 4 : Math.round(card.interval * card.ease * 1.3);
};

// The schedule patch for a card after it was graded.
export const gradeCard = (card, grade, now = Date.now()) => {
  const interval = nextInterval(card, grade);
  return { interval, ease: nextEase(card.ease, grade), due: now + interval * DAY_MS };
};

export const isDue = (card, now = Date.now()) => card.due <= now;

// Due cards first (oldest due first), then the rest by due date.
export const sortByDue = (cards) => [...cards].sort((a, b) => a.due - b.due);

export const formatInterval = (days) => (days === 0 ? 'now' : `${days}d`);

// "due" or how many days until the card is due.
export const formatDue = (card, now = Date.now()) => {
  if (isDue(card, now)) return 'due';
  return `${Math.ceil((card.due - now) / DAY_MS)}d`;
};
