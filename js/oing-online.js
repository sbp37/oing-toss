import { isAppsInTossWebView } from './leaderboard.js';

const DEFAULT_API_URL = 'https://oing-toss.vercel.app/api/oing';
const TOKEN_KEY = 'oing_toss_online_token';
const PENDING_FINISH_KEY = 'oing_toss_pending_online_finish';

function readToken(storage) {
  try { return storage?.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

function saveToken(storage, token) {
  try { storage?.setItem(TOKEN_KEY, token); } catch {}
}

function readPendingFinish(storage) {
  try { return JSON.parse(storage?.getItem(PENDING_FINISH_KEY) || 'null'); } catch { return null; }
}

function savePendingFinish(storage, payload) {
  try { storage?.setItem(PENDING_FINISH_KEY, JSON.stringify(payload)); } catch {}
}

function clearPendingFinish(storage) {
  try { storage?.removeItem(PENDING_FINISH_KEY); } catch {}
}

function runtimeApiUrl(scope) {
  const location = scope?.location;
  return String(location?.hostname || '').endsWith('.vercel.app')
    ? `${location.origin}/api/oing`
    : DEFAULT_API_URL;
}

function usesRankingPreviewData(scope) {
  const location = scope?.location;
  const hostname = String(location?.hostname || '');
  if (hostname.endsWith('.vercel.app') && hostname !== 'oing-toss.vercel.app') return true;
  if (!['localhost', '127.0.0.1'].includes(hostname)) return false;
  try {
    return new URLSearchParams(String(location?.search || '')).get('rankingDemo') === '1';
  } catch {
    return false;
  }
}

function previewPlayerId(rank) {
  return `00000000-0000-4000-8000-${String(rank).padStart(12, '0')}`;
}

function previewLeaderboard(mode, friendIds) {
  const rows = Array.from({ length: 30 }, (_, index) => {
    const rank = index + 1;
    return {
      playerId: previewPlayerId(rank),
      rank,
      nickname: rank === 22 ? '내고양이' : `오잉냥${String(rank).padStart(2, '0')}`,
      score: 19060 - rank * 520,
      isMe: rank === 22,
      isFriend: friendIds.has(previewPlayerId(rank)),
      hot: [5, 8, 12].includes(rank),
      rankDelta: rank === 22 ? 43 : rank % 4 === 0 ? 2 : rank % 6 === 0 ? -2 : 0,
      isNew: rank === 13,
    };
  });
  if (mode === 'all') {
    rows.forEach((row) => {
      row.score = Math.round(row.score * 1.8);
      row.rankDelta = null;
      row.isNew = false;
    });
  }
  const visible = mode === 'friends'
    ? rows
      .filter((row) => row.isMe || row.isFriend)
      .sort((a, b) => b.score - a.score)
      .map((row, index) => ({ ...row, rank: index + 1 }))
    : rows;
  const me = visible.find((row) => row.isMe) || null;
  if (me) {
    me.previousRank = mode === 'all' ? null : mode === 'friends' ? me.rank + 1 : 65;
    me.scoreToNext = me.rank > 1
      ? Math.max(1, Number(visible[me.rank - 2]?.score || me.score) - Number(me.score) + 1)
      : 0;
  }
  return { ok: true, preview: true, rows: visible, me };
}

async function responseJson(response) {
  if (!response) return null;
  try { return await response.json(); } catch { return null; }
}

export function createOingOnlineAdapter({
  scope = globalThis,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  storage = globalThis.sessionStorage,
  apiUrl = globalThis.OING_ONLINE_API_URL || runtimeApiUrl(scope),
  loadTossProvider = () => import('./vendor/toss-game-center-v1.js'),
  requestTimeoutMs = 8000,
} = {}) {
  let token = readToken(storage);
  let player = null;
  let bootstrapPromise = null;
  let activeRun = null;
  const previewMode = usesRankingPreviewData(scope);
  const previewFriendIds = new Set([2, 4, 8, 12].map(previewPlayerId));

  const request = async (action, body = null, { query = '' } = {}) => {
    if (typeof fetchImpl !== 'function') return null;
    const headers = { accept: 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (body) headers['content-type'] = 'application/json';
    const Controller = scope?.AbortController || globalThis.AbortController;
    const controller = typeof Controller === 'function' ? new Controller() : null;
    const timeout = controller
      ? setTimeout(() => controller.abort(), requestTimeoutMs)
      : null;
    try {
      return await responseJson(await fetchImpl(
        `${apiUrl}${query}`,
        body
          ? { method: 'POST', headers, body: JSON.stringify({ action, ...body }), signal: controller?.signal }
          : { method: 'GET', headers, signal: controller?.signal },
      ));
    } catch {
      return null;
    } finally {
      if (timeout !== null) clearTimeout(timeout);
    }
  };

  const submitPendingFinish = async () => {
    const pending = readPendingFinish(storage);
    if (!pending?.ticket) return null;
    const result = await request('finish-run', pending);
    if (result?.ok || result?.reason === 'invalid-run-ticket') clearPendingFinish(storage);
    if (result?.ok && player) player = { ...player, jelly: result.jelly };
    return result;
  };

  const bootstrap = async () => {
    if (player && token) return { ok: true, player };
    if (bootstrapPromise) return bootstrapPromise;
    if (!isAppsInTossWebView(scope)) return { ok: false, reason: 'identity-unavailable' };
    bootstrapPromise = (async () => {
      try {
        const provider = await loadTossProvider();
        const identity = await provider.getTossGameIdentity?.();
        if (!identity) return { ok: false, reason: 'identity-unavailable' };
        const result = await request('bootstrap', identity);
        if (!result?.ok || !result.token) return { ok: false, reason: result?.reason || 'offline' };
        token = result.token;
        player = result.player || null;
        saveToken(storage, token);
        // If the response vanished after the server committed a score, the
        // signed run ticket makes this retry harmless: the server returns the
        // already-finished run instead of granting score or jelly twice.
        await submitPendingFinish();
        return { ok: true, player };
      } catch {
        return { ok: false, reason: 'offline' };
      } finally {
        bootstrapPromise = null;
      }
    })();
    return bootstrapPromise;
  };

  return Object.freeze({
    async bootstrap() {
      return bootstrap();
    },

    async startRun(clientRunId) {
      const provisional = {
        clientRunId: String(clientRunId),
        ticket: '',
        startedAt: Date.now(),
        successTimesMs: [],
      };
      activeRun = provisional;
      const identity = await bootstrap();
      if (!identity.ok) {
        if (activeRun === provisional) activeRun = null;
        return identity;
      }
      const result = await request('start-run', { clientRunId });
      if (!result?.ok || !result.ticket) {
        if (activeRun === provisional) activeRun = null;
        return { ok: false, reason: result?.reason || 'offline' };
      }
      // Keep opening moves recorded while bootstrap/start-run is in flight.
      if (activeRun === provisional) provisional.ticket = result.ticket;
      return { ok: true };
    },

    recordSuccess() {
      if (!activeRun) return;
      activeRun.successTimesMs.push(Math.max(0, Date.now() - activeRun.startedAt));
    },

    async finishRun({ clientRunId, score, successCount, boards, maxCombo }) {
      if (!activeRun || !activeRun.ticket || activeRun.clientRunId !== String(clientRunId)) {
        return { ok: false, reason: 'run-not-started' };
      }
      const run = activeRun;
      activeRun = null;
      const payload = {
        ticket: run.ticket,
        score,
        durationMs: Date.now() - run.startedAt,
        successCount,
        successTimesMs: run.successTimesMs,
        boards,
        maxCombo,
      };
      savePendingFinish(storage, payload);
      const result = await submitPendingFinish();
      return result?.ok ? result : { ok: false, reason: result?.reason || 'offline' };
    },

    async leaderboard(mode = 'weekly') {
      if (isAppsInTossWebView(scope) && !token) await bootstrap();
      const normalized = ['all', 'friends'].includes(mode) ? mode : 'weekly';
      const result = await request('leaderboard', null, {
        query: `?action=leaderboard&mode=${normalized}`,
      });
      if (result?.ok) return result;
      return previewMode
        ? previewLeaderboard(normalized, previewFriendIds)
        : { ok: false, reason: result?.reason || 'offline', rows: [] };
    },

    async setFriend(playerId, saved = true) {
      if (previewMode) {
        if (saved) previewFriendIds.add(playerId);
        else previewFriendIds.delete(playerId);
        return { ok: true, preview: true, friendship: { saved } };
      }
      const identity = await bootstrap();
      if (!identity.ok) return identity;
      const result = await request('friend', { playerId, saved });
      return result?.ok ? result : { ok: false, reason: result?.reason || 'offline' };
    },

    getPlayer() {
      return player;
    },
  });
}

function rankMedal(rank) {
  return rank === 1 ? '1' : rank === 2 ? '2' : '3';
}

function rankChange(entry) {
  if (entry?.isNew) return { text: 'NEW', className: 'is-new' };
  const delta = Number(entry?.rankDelta);
  if (!Number.isFinite(delta) || delta === 0) return { text: '－', className: 'same' };
  return delta > 0
    ? { text: `▲${delta}`, className: 'up' }
    : { text: `▼${Math.abs(delta)}`, className: 'down' };
}

function tierBadge(rank) {
  const value = Number(rank);
  if (value > 30) return null;
  const badge = document.createElement('span');
  badge.className = `oing-rank-tier tier-${value <= 3 ? '3' : value <= 10 ? '10' : '30'}`;
  badge.textContent = value <= 3 ? '👑 TOP3' : value <= 10 ? '🔥 Top10' : '✨ Top30';
  return badge;
}

function podiumCrownAsset(rank) {
  const medal = rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze';
  return `assets/ui/ranking/podium-crown-${medal}-original-v1.webp`;
}

function podiumRankLabel(rank) {
  return rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd';
}

export class OingLeaderboardView {
  constructor(root) {
    this.root = root;
    this.mode = 'weekly';
    this.onModeChange = null;
    this.onFriendToggle = null;
    if (this.root) this.root.dataset.mode = this.mode;
    this.root?.querySelectorAll('[data-oing-rank-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        const mode = button.dataset.oingRankMode;
        if (mode === this.mode) return;
        this.mode = mode;
        this.setActiveMode();
        this.onModeChange?.(mode);
      });
    });
  }

  setActiveMode() {
    // 탭이 어느 쪽인지 CSS가 알아야 한다. 전체(all) 탭은 "지난주 대비 등락"이
    // 없는 누적 최고점이라, 주간용 등락 칸(▲▼－)을 그대로 두면 모든 줄에
    // '－'만 찍힌다. 그 칸을 접고 이름·점수에 자리를 준다.
    if (this.root) this.root.dataset.mode = this.mode;
    this.root?.querySelectorAll('[data-oing-rank-mode]').forEach((button) => {
      const active = button.dataset.oingRankMode === this.mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    const title = this.root?.querySelector('#oing-rank-period-title');
    const note = this.root?.querySelector('#oing-rank-period-note');
    if (title) title.textContent = this.mode === 'weekly'
      ? '이번 주 랭킹'
      : this.mode === 'friends' ? '친구 랭킹' : '전체 랭킹';
    if (note) note.textContent = this.mode === 'weekly'
      ? '매주 월요일 0시에 새로 시작한다냥!'
      : this.mode === 'friends'
        ? '저장한 친구들과 이번 주 기록을 겨룬다냥!'
        : '지금까지 가장 높은 기록을 모았다냥!';
  }

  setLoading() {
    if (!this.root) return;
    this.root.querySelector('#oing-rank-status').textContent = '기록을 불러오는 중이다냥…';
    this.root.querySelector('#oing-rank-list').replaceChildren();
    this.root.querySelector('#oing-rank-podium').replaceChildren();
    this.root.querySelector('#oing-my-rank-summary').hidden = true;
  }

  bindFriendPress(node, entry) {
    if (!node || !entry?.playerId || entry.isMe) return;
    node.classList.add('can-save-friend');
    node.setAttribute('aria-label', `${entry.nickname}, 길게 눌러 친구 ${entry.isFriend ? '해제' : '저장'}`);
    let timer = null;
    let startX = 0;
    let startY = 0;
    let fired = false;
    const clear = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      node.classList.remove('is-pressing');
    };
    node.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      clear();
      fired = false;
      startX = event.clientX;
      startY = event.clientY;
      node.classList.add('is-pressing');
      timer = setTimeout(() => {
        timer = null;
        fired = true;
        node.classList.remove('is-pressing');
        this.onFriendToggle?.(entry);
      }, 600);
    });
    node.addEventListener('pointermove', (event) => {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) clear();
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => {
      node.addEventListener(type, clear);
    });
    node.addEventListener('contextmenu', (event) => {
      if (fired || timer !== null) event.preventDefault();
      clear();
    });
  }

  render(result) {
    if (!this.root) return;
    const status = this.root.querySelector('#oing-rank-status');
    const list = this.root.querySelector('#oing-rank-list');
    const podium = this.root.querySelector('#oing-rank-podium');
    const myRank = this.root.querySelector('#oing-my-rank-summary');
    list.replaceChildren();
    podium.replaceChildren();
    if (!result?.ok) {
      status.textContent = '새 랭킹 서버를 준비 중이다냥. 게임은 그대로 할 수 있어!';
      myRank.hidden = true;
      return;
    }
    const rows = Array.isArray(result.rows) ? result.rows : [];
    status.textContent = result.preview
      ? '미리보기용 샘플 랭킹이다냥'
      : rows.length
      ? ''
      : this.mode === 'friends'
        ? '친구를 저장하면 여기서 함께 겨룰 수 있다냥!'
        : '아직 기록이 없다냥. 첫 번째 자리를 차지해봐!';
    const top = rows.slice(0, 3);
    [top[1], top[0], top[2]].filter(Boolean).forEach((entry) => {
      const card = document.createElement('article');
      card.className = `oing-podium-card rank-${entry.rank}${entry.isMe ? ' is-me' : ''}`;
      const crown = document.createElement('img');
      crown.className = 'oing-podium-crown';
      crown.src = podiumCrownAsset(entry.rank);
      crown.alt = '';
      crown.decoding = 'async';
      const avatar = document.createElement('img');
      avatar.className = 'oing-podium-avatar';
      avatar.src = 'assets/characters/cat-idle.webp';
      avatar.alt = '';
      avatar.decoding = 'async';
      const identity = document.createElement('div');
      identity.className = 'oing-podium-identity';
      const name = document.createElement('strong');
      name.textContent = entry.nickname;
      identity.append(name);
      const changeData = rankChange(entry);
      const rankBadge = document.createElement('span');
      rankBadge.className = `oing-podium-rank-badge ${changeData.className}`;
      // 전체 탭은 누적 최고점이라 등락이 없다. '1st －'의 '－'는 정보가 아니라
      // 빈칸이므로 순위 글자만 남긴다.
      rankBadge.textContent = this.mode === 'all'
        ? podiumRankLabel(entry.rank)
        : `${podiumRankLabel(entry.rank)}  ${changeData.text}`;
      const scoreLine = document.createElement('div');
      scoreLine.className = 'oing-podium-score-line';
      if (entry.isFriend) {
        const friend = document.createElement('span');
        friend.className = 'oing-rank-friend is-saved';
        friend.textContent = '♥';
        friend.title = '저장한 친구';
        friend.setAttribute('aria-hidden', 'true');
        scoreLine.append(friend);
      }
      const score = document.createElement('b');
      score.textContent = `${Number(entry.score).toLocaleString('ko-KR')}점`;
      scoreLine.append(score);
      const base = document.createElement('span');
      base.className = 'oing-podium-base';
      base.textContent = rankMedal(entry.rank);
      card.append(crown, avatar, rankBadge, identity, scoreLine, base);
      this.bindFriendPress(card, entry);
      podium.append(card);
    });
    rows.slice(3).forEach((entry) => {
      const row = document.createElement('div');
      const tier = Number(entry.rank) <= 10 ? ' top10' : Number(entry.rank) <= 30 ? ' top30' : '';
      row.className = `oing-rank-row${tier}${entry.isMe ? ' is-me' : ''}`;
      const rank = document.createElement('b');
      rank.className = 'oing-rank-number';
      rank.textContent = entry.rank;
      const changeData = rankChange(entry);
      const change = document.createElement('span');
      change.className = `oing-rank-change ${changeData.className}`;
      change.textContent = changeData.text;
      const identity = document.createElement('div');
      identity.className = 'oing-rank-identity';
      const nameLine = document.createElement('div');
      nameLine.className = 'oing-rank-name-line';
      const name = document.createElement('span');
      name.className = 'oing-rank-name';
      name.textContent = entry.nickname;
      nameLine.append(name);
      if (entry.hot) {
        const hot = document.createElement('span');
        hot.className = 'oing-rank-hot';
        hot.textContent = '🔥';
        hot.title = '최근 기록 갱신';
        nameLine.append(hot);
      }
      identity.append(nameLine);
      const tail = document.createElement('div');
      tail.className = 'oing-rank-tail';
      if (entry.isFriend) {
        const friend = document.createElement('span');
        friend.className = 'oing-rank-friend is-saved';
        friend.textContent = '♥';
        friend.title = '저장한 친구';
        friend.setAttribute('aria-hidden', 'true');
        tail.append(friend);
      }
      const badge = tierBadge(entry.rank);
      if (badge) tail.append(badge);
      const score = document.createElement('strong');
      score.textContent = Number(entry.score).toLocaleString('ko-KR');
      tail.append(score);
      row.append(rank, change, identity, tail);
      this.bindFriendPress(row, entry);
      list.append(row);
    });
    if (result.me) {
      myRank.hidden = false;
      const place = myRank.querySelector('#oing-my-rank-place');
      const points = myRank.querySelector('#oing-my-rank-points');
      const change = myRank.querySelector('#oing-my-rank-change');
      const gap = myRank.querySelector('#oing-my-rank-gap');
      const previous = myRank.querySelector('#oing-my-rank-previous');
      const changeData = rankChange(result.me);
      place.textContent = `${result.me.rank}위`;
      points.textContent = `${Number(result.me.score).toLocaleString('ko-KR')}점`;
      change.className = changeData.className;
      change.textContent = this.mode === 'all'
        ? '전체 최고 기록'
        : changeData.text === '－' ? '지난 순위와 같아요' : changeData.text;
      const computedGap = Number(result.me.scoreToNext);
      if (result.me.rank === 1) gap.textContent = '지금 내가 1등!';
      else if (Number.isFinite(computedGap) && computedGap > 0) gap.textContent = `${computedGap.toLocaleString('ko-KR')}점 남았다냥!`;
      else {
        const ahead = rows.find((entry) => Number(entry.rank) === Number(result.me.rank) - 1);
        const difference = ahead ? Math.max(0, Number(ahead.score) - Number(result.me.score) + 1) : 0;
        gap.textContent = difference ? `${difference.toLocaleString('ko-KR')}점 남았다냥!` : '조금만 더 달려보자냥!';
      }
      const previousRank = Number(result.me.previousRank);
      previous.textContent = this.mode === 'all'
        ? '🏅 내 오잉 기록 보기'
        : Number.isFinite(previousRank) && previousRank > 0
          ? `🏅 지난주 ${previousRank}위 · 내 기록 보기`
          : '✨ 이번 주 첫 기록을 세웠다냥!';
    } else {
      myRank.hidden = true;
    }
  }
}

export const oingOnlineAdapter = createOingOnlineAdapter();
