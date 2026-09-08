// 이번 판의 목표는 시작 때 고정한다. 서버 순위가 아니라 기록을 비교한다.
export function chooseRunGoal({ best = 0, challenge = 0, rows = [], now = Date.now(), fetchedAt = 0 } = {}) {
  const score = Math.max(0, Math.floor(Number(best) || 0));
  if (Number.isFinite(Number(challenge)) && Number(challenge) > 0) return Object.freeze({ kind: 'challenge', target: Math.floor(Number(challenge)), label: '친구', name: '친구' });
  const fresh = fetchedAt > 0 && now >= fetchedAt && now - fetchedAt < 300000;
  const candidates = fresh && Array.isArray(rows) ? rows.filter((row) => !row.isMe
    && typeof row.nickname === 'string' && row.nickname.trim()
    && Number.isFinite(Number(row.score)) && Number(row.score) >= score
    && Number(row.score) - score <= Math.max(500, score * 0.25)) : [];
  candidates.sort((a, b) => Number(a.score) - Number(b.score) || Number(b.isFriend) - Number(a.isFriend));
  const rival = candidates[0];
  if (rival) return Object.freeze({ kind: 'rival', target: Math.floor(Number(rival.score)) + 1, name: rival.nickname, label: '상대' });
  return Object.freeze(score > 0
    ? { kind: 'best', target: score + 1, name: '내 최고', label: '최고' }
    : { kind: 'first', target: 1000, name: '첫 목표', label: '목표' });
}

export function runGoalText(goal, score = null) {
  if (!goal) return '';
  const n = (value) => value.toLocaleString('ko-KR');
  if (score === null) return `${goal.name} · ${n(goal.target)}점 도전!`;
  const left = Math.max(0, goal.target - Math.floor(Number(score) || 0));
  if (!left) return goal.kind === 'rival' ? `${goal.name} 기록 돌파!`
    : goal.kind === 'challenge' ? '친구 도전 성공!' : `${goal.name} 달성!`;
  return `${goal.name}까지 ${n(left)}점!`;
}

export function runGrowthText({ maxCombo = 0, previousCombo = 0, boardsCleared = 0 } = {}) {
  const gain = Math.floor(maxCombo) - Math.floor(previousCombo);
  if (previousCombo > 0 && gain > 0) return `최고 콤보 +${gain}! 지난 기록을 넘었다냥!`;
  if (boardsCleared > 0) return `${boardsCleared}번 판 돌파! 다음 판도 도전해보라냥!`;
  return '';
}
