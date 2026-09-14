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
  const configured = scope?.document
    ?.querySelector?.('meta[name="oing-online-api-url"]')
    ?.getAttribute?.('content');
  if (configured && !configured.startsWith('__OING_')) return configured.replace(/\/$/, '');
  return String(location?.hostname || '').endsWith('.vercel.app')
    ? `${location.origin}/api/oing`
    : DEFAULT_API_URL;
}

function usesRankingPreviewData(scope) {
  const location = scope?.location;
  const hostname = String(location?.hostname || '');
  // A raw local file has no Toss identity and cannot call the production
  // API reliably. Treat it as the visual review surface so opening index.html
  // still shows the ten sample ranks and can retain a played preview score.
  if (String(location?.protocol || '') === 'file:') return true;
  if (hostname.endsWith('.vercel.app') && hostname !== 'oing-toss.vercel.app') return true;
  const firebasePreview = hostname.endsWith('.web.app') && hostname.includes('--ranking-mobile-');
  if (!firebasePreview && !['localhost', '127.0.0.1'].includes(hostname)) return false;
  try {
    return new URLSearchParams(String(location?.search || '')).get('rankingDemo') === '1';
  } catch {
    return false;
  }
}

function previewPlayerId(rank) {
  return `00000000-0000-4000-8000-${String(rank).padStart(12, '0')}`;
}

function previewLeaderboard(mode, friendIds, previewPlayer) {
  const rows = Array.from({ length: 10 }, (_, index) => {
    const rank = index + 1;
    return {
      playerId: previewPlayerId(rank),
      rank,
      nickname: `오잉냥${String(rank).padStart(2, '0')}`,
      score: 9000 - rank * 700,
      isMe: false,
      isFriend: friendIds.has(previewPlayerId(rank)),
      hot: [5, 8, 12].includes(rank),
      rankDelta: rank % 4 === 0 ? 2 : rank % 6 === 0 ? -2 : 0,
      isNew: rank === 13,
    };
  });
  if (mode === 'all' || mode === 'friends') {
    rows.forEach((row) => {
      row.score = Math.round(row.score * 1.65);
    });
  }
  const playerRow = previewPlayer && Number.isFinite(Number(previewPlayer.score))
    ? {
      playerId: previewPlayer.playerId,
      nickname: previewPlayer.nickname,
      score: Number(previewPlayer.score),
      isMe: true,
      isFriend: false,
      hot: true,
      rankDelta: Number(previewPlayer.rankDelta) || 0,
      isNew: Boolean(previewPlayer.isNew),
    }
    : null;
  const ranked = [...rows, ...(playerRow ? [playerRow] : [])]
    .sort((a, b) => Number(b.score) - Number(a.score))
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const visible = mode === 'friends'
    ? ranked
      .filter((row) => row.isMe || row.isFriend)
      .sort((a, b) => b.score - a.score)
      .map((row, index) => ({ ...row, rank: index + 1 }))
    : ranked;
  const me = visible.find((row) => row.isMe) || null;
  if (me) {
    me.previousRank = mode === 'weekly' ? 11 : null;
    me.scoreToNext = me.rank > 1
      ? Math.max(1, Number(visible[me.rank - 2]?.score || me.score) - Number(me.score) + 1)
      : 0;
  }
  return { ok: true, preview: true, rows: visible, me };
}

function previewRankOutcome(mode, friendIds, previewPlayer, nextScore) {
  const before = previewLeaderboard(mode, friendIds, previewPlayer);
  const candidate = { ...previewPlayer, score: Math.max(Number(previewPlayer?.score) || 0, Number(nextScore) || 0) };
  const after = previewLeaderboard(mode, friendIds, candidate);
  const rankBefore = Number(before.me?.rank) || null;
  const rankAfter = Number(after.me?.rank) || null;
  const displaced = rankAfter
    ? before.rows.find((row) => !row.isMe && Number(row.rank) === rankAfter)
    : null;
  return {
    rankBefore,
    rankAfter,
    rankDelta: rankBefore && rankAfter ? Math.max(0, rankBefore - rankAfter) : 0,
    isNew: !rankBefore && Boolean(rankAfter),
    beatenNickname: rankAfter && (!rankBefore || rankAfter < rankBefore) ? displaced?.nickname || null : null,
  };
}

async function responseJson(response) {
  if (!response) return null;
  try { return await response.json(); } catch { return null; }
}

export function nicknameRegistrationCopy({ customized = false, status = '', bestScore = 0 } = {}) {
  if (customized) return '별명을 바꿔도 내 점수와 친구 기록은 그대로예요.';
  if (status === 'saving') return '랭킹에 기록을 등록 중이에요. 별명은 지금 정할 수 있어요.';
  if (status === 'pending') return '이번 기록은 확인 중이에요. 별명을 정하면 확인 후 함께 반영돼요.';
  if (status === 'failed') return '이번 랭킹 등록을 완료하지 못했어요. 별명을 정해도 점수 등록 상태는 그대로예요.';
  if (status === 'accepted' || Number(bestScore) > 0) return '랭킹에 기록이 저장됐어요. 별명을 정하면 기존 기록에도 반영된다냥!';
  return '나만의 별명을 정해보라냥! 게임을 마치면 이 이름으로 랭킹에 등록돼요.';
}

export function createOingOnlineAdapter({
  scope = globalThis,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  storage = globalThis.sessionStorage,
  apiUrl = scope?.OING_ONLINE_API_URL || globalThis.OING_ONLINE_API_URL || runtimeApiUrl(scope),
  loadTossProvider = () => import('./vendor/toss-game-center-v1.js'),
  requestTimeoutMs = 8000,
} = {}) {
  let token = readToken(storage);
  let player = null;
  let bootstrapPromise = null;
  let activeRun = null;
  const previewMode = usesRankingPreviewData(scope);
  const previewFriendIds = new Set([2, 4, 8, 12].map(previewPlayerId));
  const previewPlayerIdValue = previewPlayerId(0);
  let previewWeeklyScore = 1000;
  let previewAllScore = 1000;

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
    if (result?.ok && player) player = { ...player, jelly: result.jelly, bestScore: result.bestScore };
    return result;
  };

  const bootstrap = async () => {
    if (player && token) return { ok: true, player };
    if (previewMode) {
      player = player || { nickname: '햇살젤리', nicknameCustomized: false, jelly: 0 };
      return { ok: true, preview: true, player };
    }
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
        const recoveredFinish = await submitPendingFinish();
        return { ok: true, player, recoveredFinish };
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
      if (previewMode) {
        provisional.ticket = `preview-${String(clientRunId)}`;
        return { ok: true, preview: true };
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

    async finishRun({ clientRunId, score, successCount, boards, maxCombo, scoreRulesVersion = 1 }) {
      if (!activeRun || !activeRun.ticket || activeRun.clientRunId !== String(clientRunId)) {
        return { ok: false, reason: 'run-not-started' };
      }
      const run = activeRun;
      activeRun = null;
      if (previewMode) {
        const previewIdentity = {
          playerId: previewPlayerIdValue,
          nickname: player?.nickname || '내고양이',
        };
        const ranking = {
          weekly: previewRankOutcome('weekly', previewFriendIds, {
            ...previewIdentity,
            score: previewWeeklyScore,
          }, score),
          all: previewRankOutcome('all', previewFriendIds, {
            ...previewIdentity,
            score: previewAllScore,
          }, score),
        };
        previewWeeklyScore = Math.max(previewWeeklyScore, Number(score) || 0);
        previewAllScore = Math.max(previewAllScore, Number(score) || 0);
        player = { ...player, bestScore: previewAllScore };
        return {
          ok: true,
          preview: true,
          status: 'accepted',
          bestScore: previewAllScore,
          jelly: Number(player?.jelly) || 0,
          jellyEarned: 0,
          ranking,
        };
      }
      const payload = {
        ticket: run.ticket,
        score,
        durationMs: Date.now() - run.startedAt,
        successCount,
        successTimesMs: run.successTimesMs,
        boards,
        maxCombo,
        scoreRulesVersion,
      };
      savePendingFinish(storage, payload);
      const result = await submitPendingFinish();
      return result?.ok ? result : { ok: false, reason: result?.reason || 'offline' };
    },

    async leaderboard(mode = 'weekly') {
      if (isAppsInTossWebView(scope) && !token) await bootstrap();
      const normalized = ['all', 'friends'].includes(mode) ? mode : 'weekly';
      if (previewMode) {
        return previewLeaderboard(normalized, previewFriendIds, {
          playerId: previewPlayerIdValue,
          nickname: player?.nickname || '내고양이',
          score: normalized === 'weekly' ? previewWeeklyScore : previewAllScore,
        });
      }
      const result = await request('leaderboard', null, {
        query: `?action=leaderboard&mode=${normalized}`,
      });
      if (result?.ok) return result;
      return { ok: false, reason: result?.reason || 'offline', rows: [] };
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

    async setNickname(nickname) {
      if (previewMode) {
        player = { ...player, nickname: String(nickname || '').trim(), nicknameCustomized: true };
        return { ok: true, preview: true, player };
      }
      const identity = await bootstrap();
      if (!identity.ok) return identity;
      const result = await request('nickname', { nickname: String(nickname || '').trim() });
      if (result?.ok && result.player) player = { ...player, ...result.player };
      return result?.ok ? result : {
        ok: false,
        reason: result?.reason || 'offline',
        nicknameChangeAvailableAt: result?.nicknameChangeAvailableAt || null,
      };
    },

    getPlayer() {
      return player;
    },
    hasPendingFinish() {
      return Boolean(readPendingFinish(storage)?.ticket);
    },
    async retryPendingFinish() {
      return submitPendingFinish();
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

function activeBadge(entry) {
  if (!entry?.hot) return null;
  const badge = document.createElement('span');
  badge.className = 'oing-rank-hot';
  badge.textContent = '🔥';
  badge.title = '최근에도 활발히 플레이했어요';
  badge.setAttribute('aria-label', '최근 활발히 플레이 중');
  return badge;
}

function podiumCrownAsset(rank) {
  const medal = rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze';
  return `assets/ui/ranking/podium-crown-${medal}-original-v1.webp`;
}

function podiumCatAsset(rank) {
  if (rank === 2) return 'assets/ui/ranking/podium-cat-silver-v1.webp';
  if (rank === 3) return 'assets/ui/ranking/podium-cat-bronze-v1.webp';
  return 'assets/ui/ranking/podium-cat-gold-v2.webp';
}

function podiumRankLabel(rank) {
  return rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd';
}

export class OingLeaderboardView {
  constructor(root) {
    this.root = root;
    this.mode = 'all';
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
    this.setActiveMode();
  }

  setActiveMode() {
    // 탭이 어느 쪽인지 CSS가 알아야 제목과 친구 안내를 알맞게 접을 수 있다.
    if (this.root) this.root.dataset.mode = this.mode;
    this.root?.querySelectorAll('[data-oing-rank-mode]').forEach((button) => {
      const active = button.dataset.oingRankMode === this.mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    const title = this.root?.querySelector('#oing-rank-period-title');
    const note = this.root?.querySelector('#oing-rank-period-note');
    if (title) {
      title.hidden = this.mode === 'all';
      title.textContent = this.mode === 'weekly'
        ? '이번 주 랭킹'
        : this.mode === 'friends' ? '친구 랭킹' : '전체 랭킹';
    }
    if (note) note.textContent = this.mode === 'weekly'
      ? '매주 월요일 0시에 새로 시작한다냥!'
      : this.mode === 'friends'
        ? '친구들과 최고기록을 겨룬다냥!'
        : '지금까지 가장 높은 기록을 모았다냥!';
  }

  setLoading() {
    if (!this.root) return;
    this.root.querySelector('#oing-rank-status').textContent = '기록을 불러오는 중이다냥…';
    this.root.querySelector('#oing-rank-list').replaceChildren();
    this.root.querySelector('#oing-rank-podium').replaceChildren();
    this.root.querySelector('#oing-my-rank-summary').hidden = true;
    this.root.querySelector('#oing-my-rank-previous').hidden = true;
  }

  bindFriendPress(node, entry) {
    if (!node || !entry?.playerId || entry.isMe) return;
    node.classList.add('can-save-friend');
    node.setAttribute('aria-label', `${entry.nickname}, 길게 눌러 친구 ${entry.isFriend ? '해제' : '저장'}`);
    let timer = null;
    let startX = 0;
    let startY = 0;
    let fired = false;
    let pointerId = null;
    const clear = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      node.classList.remove('is-pressing');
      const capturedPointerId = pointerId;
      pointerId = null;
      if (capturedPointerId !== null && node.hasPointerCapture?.(capturedPointerId)) {
        try { node.releasePointerCapture(capturedPointerId); } catch {}
      }
    };
    node.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      clear();
      fired = false;
      startX = event.clientX;
      startY = event.clientY;
      pointerId = event.pointerId;
      try { node.setPointerCapture?.(pointerId); } catch {}
      node.classList.add('is-pressing');
      timer = setTimeout(() => {
        timer = null;
        fired = true;
        node.classList.remove('is-pressing');
        this.onFriendToggle?.(entry);
      }, 450);
    });
    node.addEventListener('pointermove', (event) => {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 18) clear();
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => {
      node.addEventListener(type, clear);
    });
    node.addEventListener('contextmenu', (event) => {
      if (fired || timer !== null) event.preventDefault();
      clear();
    });
  }

  celebrateRankUp(outcome) {
    if (!this.root || !outcome) return;
    const from = Number(outcome.rankBefore) || null;
    const to = Number(outcome.rankAfter) || null;
    const delta = Number(outcome.rankDelta) || 0;
    if (!to || (!outcome.isNew && delta <= 0)) return;
    this.root.querySelectorAll('.oing-rank-rise-toast, .oing-rank-confetti').forEach((node) => node.remove());
    const panel = this.root.querySelector('.oing-online-ranking-panel');
    if (!panel) return;
    const toast = document.createElement('div');
    toast.className = 'oing-rank-rise-toast';
    toast.setAttribute('role', 'status');
    toast.textContent = outcome.isNew
      ? `첫 랭킹 ${to}위다냥!!`
      : `${from}위 → ${to}위 · ${delta}등 올랐다냥!!`;
    const confetti = document.createElement('div');
    confetti.className = 'oing-rank-confetti';
    confetti.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 14; index += 1) {
      const piece = document.createElement('i');
      piece.style.setProperty('--confetti-index', String(index));
      piece.style.setProperty('--confetti-left', `${8 + index * 6.4}%`);
      confetti.append(piece);
    }
    panel.append(confetti, toast);
    [
      this.root.querySelector('#oing-my-rank-summary'),
      this.root.querySelector('.oing-podium-card.is-me, .oing-rank-row.is-me'),
    ].filter(Boolean).forEach((node) => {
      node.classList.remove('is-rank-jump');
      void node.offsetWidth;
      node.classList.add('is-rank-jump');
      setTimeout(() => node.classList.remove('is-rank-jump'), 1200);
    });
    setTimeout(() => {
      toast.remove();
      confetti.remove();
    }, 2500);
  }

  render(result) {
    if (!this.root) return;
    const status = this.root.querySelector('#oing-rank-status');
    const list = this.root.querySelector('#oing-rank-list');
    const podium = this.root.querySelector('#oing-rank-podium');
    const myRank = this.root.querySelector('#oing-my-rank-summary');
    const previous = this.root.querySelector('#oing-my-rank-previous');
    list.replaceChildren();
    podium.replaceChildren();
    if (!result?.ok) {
      status.textContent = '새 랭킹 서버를 준비 중이다냥. 게임은 그대로 할 수 있어!';
      myRank.hidden = true;
      previous.hidden = true;
      return;
    }
    const rows = Array.isArray(result.rows) ? result.rows : [];
    status.textContent = result.preview
      ? '미리보기용 샘플 랭킹이다냥'
      : rows.length
      ? ''
      : this.mode === 'friends'
        ? '친구를 저장하면 여기서 함께 겨룰 수 있다냥!'
        : '지금이 1등할 기회! 도전해보라냥~';
    const top = rows.slice(0, 3);
    const emptyPodium = rows.length === 0 && this.mode !== 'friends';
    const podiumEntries = emptyPodium
      ? [1, 2, 3].map((rank) => ({ rank, nickname: '첫 주인공을 기다려요', score: null, placeholder: true }))
      : top;
    const podiumFragment = document.createDocumentFragment();
    [podiumEntries[1], podiumEntries[0], podiumEntries[2]].filter(Boolean).forEach((entry) => {
      const card = document.createElement('article');
      card.className = `oing-podium-card rank-${entry.rank}${entry.isMe ? ' is-me' : ''}${entry.placeholder ? ' is-placeholder' : ''}`;
      const crown = document.createElement('img');
      crown.className = 'oing-podium-crown';
      crown.src = podiumCrownAsset(entry.rank);
      crown.alt = '';
      crown.decoding = 'async';
      const avatar = document.createElement('img');
      avatar.className = 'oing-podium-avatar';
      avatar.src = podiumCatAsset(entry.rank);
      avatar.alt = '';
      avatar.decoding = 'async';
      const avatarFrame = document.createElement('div');
      avatarFrame.className = 'oing-podium-avatar-frame';
      avatarFrame.append(avatar);
      const identity = document.createElement('div');
      identity.className = 'oing-podium-identity';
      const name = document.createElement('strong');
      const nameLength = Array.from(String(entry.nickname || '')).length;
      name.className = `oing-podium-name${nameLength >= 6 ? ' is-six-char' : nameLength === 5 ? ' is-five-char' : ''}`;
      name.textContent = entry.nickname;
      identity.append(name);
      const podiumHot = activeBadge(entry);
      if (podiumHot) identity.append(podiumHot);
      if (entry.isMe) {
        const me = document.createElement('span');
        me.className = 'oing-rank-me-badge';
        me.textContent = '나';
        identity.append(me);
      }
      const changeData = rankChange(entry);
      const rankBadge = document.createElement('span');
      rankBadge.className = `oing-podium-rank-badge ${changeData.className}`;
      rankBadge.textContent = `${podiumRankLabel(entry.rank)}  ${changeData.text}`;
      const rankLine = document.createElement('div');
      rankLine.className = 'oing-podium-rank-line';
      rankLine.append(rankBadge);
      if (entry.isFriend) {
        const friend = document.createElement('span');
        friend.className = 'oing-rank-friend is-saved';
        friend.textContent = '친구';
        friend.title = '저장한 친구';
        rankLine.append(friend);
      }
      const scoreLine = document.createElement('div');
      scoreLine.className = 'oing-podium-score-line';
      const score = document.createElement('b');
      score.textContent = entry.placeholder ? '—' : `${Number(entry.score).toLocaleString('ko-KR')}점`;
      scoreLine.append(score);
      const base = document.createElement('span');
      base.className = 'oing-podium-base';
      base.textContent = rankMedal(entry.rank);
      card.append(crown, avatarFrame, rankLine, identity, scoreLine, base);
      this.bindFriendPress(card, entry);
      podiumFragment.append(card);
    });
    podium.append(podiumFragment);
    const listFragment = document.createDocumentFragment();
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
      const hot = activeBadge(entry);
      if (hot) nameLine.append(hot);
      if (entry.isMe) {
        const me = document.createElement('span');
        me.className = 'oing-rank-me-badge';
        me.textContent = '나';
        nameLine.append(me);
      }
      if (entry.isFriend) {
        const friend = document.createElement('span');
        friend.className = 'oing-rank-friend is-saved';
        friend.textContent = '친구';
        friend.title = '저장한 친구';
        nameLine.append(friend);
      }
      identity.append(nameLine);
      const tail = document.createElement('div');
      tail.className = 'oing-rank-tail';
      const badge = tierBadge(entry.rank);
      if (badge) tail.append(badge);
      const score = document.createElement('strong');
      score.textContent = Number(entry.score).toLocaleString('ko-KR');
      tail.append(score);
      row.append(rank, change, identity, tail);
      this.bindFriendPress(row, entry);
      listFragment.append(row);
    });
    list.append(listFragment);
    if (result.me) {
      myRank.hidden = false;
      previous.hidden = false;
      const place = myRank.querySelector('#oing-my-rank-place');
      const points = myRank.querySelector('#oing-my-rank-points');
      const change = myRank.querySelector('#oing-my-rank-change');
      const gap = myRank.querySelector('#oing-my-rank-gap');
      const changeData = rankChange(result.me);
      place.textContent = `${result.me.rank}위`;
      points.textContent = `${Number(result.me.score).toLocaleString('ko-KR')}점`;
      change.className = changeData.className;
      change.textContent = changeData.text === '－' ? '순위 변동 없음' : changeData.text;
      const computedGap = Number(result.me.scoreToNext);
      const showGap = (amount, message) => {
        gap.replaceChildren();
        if (!amount) {
          gap.textContent = message;
          return;
        }
        const value = document.createElement('em');
        value.textContent = amount.toLocaleString('ko-KR');
        const suffix = document.createElement('span');
        suffix.textContent = '점 남았다냥!';
        gap.append(value, suffix);
      };
      if (result.me.rank === 1) showGap(0, '지금 내가 1등!');
      else if (Number.isFinite(computedGap) && computedGap > 0) showGap(computedGap, '');
      else {
        const ahead = rows.find((entry) => Number(entry.rank) === Number(result.me.rank) - 1);
        const difference = ahead ? Math.max(0, Number(ahead.score) - Number(result.me.score) + 1) : 0;
        showGap(difference, '조금만 더 달려보자냥!');
      }
      const previousRank = Number(result.me.previousRank);
      previous.textContent = this.mode !== 'weekly'
        ? '🏅 내 기록 보기'
        : Number.isFinite(previousRank) && previousRank > 0
          ? `🏅 지난주 ${previousRank}위 · 내 기록 보기`
          : '✨ 이번 주 첫 기록을 세웠다냥!';
    } else {
      myRank.hidden = true;
      previous.hidden = true;
    }
  }
}

export const oingOnlineAdapter = createOingOnlineAdapter();
