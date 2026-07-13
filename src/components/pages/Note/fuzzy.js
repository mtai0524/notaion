// Lightweight subsequence fuzzy matcher. score: higher is better, -1 = no match,
// empty query = 0. No DOM — pure and testable.
export const fuzzyScore = (text, query) => {
  if (!query) return 0;
  const t = String(text).toLowerCase();
  const q = query.toLowerCase();
  let ti = 0, score = 0, streak = 0, matched = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    let found = -1;
    for (let j = ti; j < t.length; j++) { if (t[j] === c) { found = j; break; } }
    if (found === -1) return -1;
    matched++;
    if (found === ti) { streak++; score += 5 + streak; } else { streak = 0; score += 1; }
    if (found === 0 || t[found - 1] === ' ') score += 3; // word-boundary bonus
    ti = found + 1;
  }
  score -= (t.length - matched) * 0.1; // prefer shorter targets
  return score;
};

export const fuzzyFilter = (items, query, keyFn) => {
  if (!query) return items;
  return items
    .map((it) => ({ it, s: fuzzyScore(keyFn(it), query) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.it);
};
