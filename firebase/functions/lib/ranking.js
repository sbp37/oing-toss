// Shared ordering for cached leaders, lifetime friends and players outside
// the cached top list. The player ID makes equal-time ties deterministic.
export function compareRankRows(a, b) {
  return Number(b.score) - Number(a.score)
    || String(a.achievedAt || '').localeCompare(String(b.achievedAt || ''))
    || String(a.playerId).localeCompare(String(b.playerId));
}

// Recalculate movement for every visible row whenever the top list changes.
// Storing movement only on the player who submitted a score made everyone
// displaced by that score look unchanged, which made a live ranking feel dead.
export function decorateRankChanges(previousRows = [], nextRows = []) {
  const before = new Map(previousRows.map((row, index) => [row.playerId, index + 1]));
  return nextRows.map((row, index) => {
    const previousRank = before.get(row.playerId);
    return {
      ...row,
      rankDelta: previousRank ? previousRank - (index + 1) : 0,
      isNew: !previousRank,
    };
  });
}

export function lifetimeRow(player, cachedRows = []) {
  const cached = cachedRows.find((row) => row.playerId === player.playerId);
  return {
    playerId: player.playerId,
    nickname: player.nickname,
    score: Number(player.bestScore || 0),
    // Old out-of-cache records have no achievement timestamp. Keep their tie
    // position stable without guessing from a later nickname/profile update.
    achievedAt: player.bestAchievedAt || cached?.achievedAt || '',
    activeAt: player.lastPlayedAt || cached?.activeAt || player.bestAchievedAt || cached?.achievedAt || '',
    rankDelta: cached?.rankDelta ?? null,
    isNew: cached?.isNew === true,
  };
}

function decorate(row, rank, playerId, friendIds, ahead = null) {
  return {
    ...row, rank, isMe: row.playerId === playerId,
    isFriend: friendIds.has(row.playerId),
    scoreToNext: rank > 1 && ahead ? Math.max(1, Number(ahead.score) - row.score + 1) : 0,
  };
}

// Inject storage so the real ranking path can be tested without live writes.
export async function lifetimeLeaderboard({
  mode, playerId, friendIds = new Set(), cachedRows = [], limit = 100,
  loadPlayers, countHigher, loadTies, loadNextHigher,
}) {
  const friends = mode === 'friends';
  let source = cachedRows;
  if (friends) {
    if (!playerId) return { ok: true, mode, rows: [], me: null };
    const players = await loadPlayers([...new Set([playerId, ...friendIds])]);
    source = players.map((player) => lifetimeRow(player, cachedRows)).filter((row) => row.score > 0);
  }
  const sorted = [...source].sort(compareRankRows);
  const ranked = sorted.map((row, index) => decorate(row, index + 1, playerId, friendIds, sorted[index - 1]));
  let me = ranked.find((row) => row.isMe) || null;
  if (!friends && playerId && !me) {
    const [player] = await loadPlayers([playerId]);
    if (player && Number(player.bestScore) > 0) {
      const own = lifetimeRow(player, cachedRows);
      const [higher, tiedPlayers] = await Promise.all([countHigher(own.score), loadTies(own.score)]);
      const ties = tiedPlayers.map((item) => lifetimeRow(item, cachedRows)).sort(compareRankRows);
      const tiedBefore = ties.filter((row) => compareRankRows(row, own) < 0);
      const rank = higher + tiedBefore.length + 1;
      const ahead = tiedBefore.at(-1) || (higher > 0 ? await loadNextHigher(own.score) : null);
      me = decorate(own, rank, playerId, friendIds, ahead);
    }
  }
  return { ok: true, mode, rows: ranked.slice(0, limit), me };
}
