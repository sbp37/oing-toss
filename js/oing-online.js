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
      const normalized = mode === 'all' ? 'all' : 'weekly';
      const result = await request('leaderboard', null, {
        query: `?action=leaderboard&mode=${normalized}`,
      });
      return result?.ok ? result : { ok: false, reason: result?.reason || 'offline', rows: [] };
    },

    getPlayer() {
      return player;
    },
  });
}

function rankMedal(rank) {
  return rank === 1 ? '1' : rank === 2 ? '2' : '3';
}

export class OingLeaderboardView {
  constructor(root) {
    this.root = root;
    this.mode = 'weekly';
    this.onModeChange = null;
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
    this.root?.querySelectorAll('[data-oing-rank-mode]').forEach((button) => {
      const active = button.dataset.oingRankMode === this.mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
  }

  setLoading() {
    if (!this.root) return;
    this.root.querySelector('#oing-rank-status').textContent = '기록을 불러오는 중이다냥…';
    this.root.querySelector('#oing-rank-list').replaceChildren();
    this.root.querySelector('#oing-rank-podium').replaceChildren();
    this.root.querySelector('#oing-my-rank').hidden = true;
  }

  render(result) {
    if (!this.root) return;
    const status = this.root.querySelector('#oing-rank-status');
    const list = this.root.querySelector('#oing-rank-list');
    const podium = this.root.querySelector('#oing-rank-podium');
    const myRank = this.root.querySelector('#oing-my-rank');
    list.replaceChildren();
    podium.replaceChildren();
    if (!result?.ok) {
      status.textContent = '새 랭킹 서버를 준비 중이다냥. 게임은 그대로 할 수 있어!';
      myRank.hidden = true;
      return;
    }
    const rows = Array.isArray(result.rows) ? result.rows : [];
    status.textContent = rows.length ? '' : '아직 기록이 없다냥. 첫 번째 자리를 차지해봐!';
    const top = rows.slice(0, 3);
    [top[1], top[0], top[2]].filter(Boolean).forEach((entry) => {
      const card = document.createElement('article');
      card.className = `oing-podium-card rank-${entry.rank}${entry.isMe ? ' is-me' : ''}`;
      const crown = document.createElement('img');
      crown.className = 'oing-podium-crown';
      crown.src = entry.rank === 1
        ? 'assets/icons/navigation/ranking-trophy-v1.webp'
        : 'assets/decor/star.webp';
      crown.alt = '';
      crown.decoding = 'async';
      const avatar = document.createElement('img');
      avatar.className = 'oing-podium-avatar';
      avatar.src = 'assets/characters/cat-idle.webp';
      avatar.alt = '';
      avatar.decoding = 'async';
      const name = document.createElement('strong');
      name.textContent = entry.nickname;
      const score = document.createElement('b');
      score.textContent = `${Number(entry.score).toLocaleString('ko-KR')}점`;
      const base = document.createElement('span');
      base.className = 'oing-podium-base';
      base.textContent = rankMedal(entry.rank);
      card.append(crown, avatar, name, score, base);
      podium.append(card);
    });
    rows.slice(3).forEach((entry) => {
      const row = document.createElement('div');
      row.className = `oing-rank-row${entry.isMe ? ' is-me' : ''}`;
      const rank = document.createElement('b');
      rank.className = 'oing-rank-number';
      rank.textContent = entry.rank;
      const avatar = document.createElement('img');
      avatar.className = 'oing-rank-avatar';
      avatar.src = entry.isMe ? 'assets/decor/paw.webp' : 'assets/characters/cat-idle.webp';
      avatar.alt = '';
      avatar.decoding = 'async';
      const name = document.createElement('span');
      name.className = 'oing-rank-name';
      name.textContent = entry.nickname;
      const score = document.createElement('strong');
      score.textContent = Number(entry.score).toLocaleString('ko-KR');
      row.append(rank, avatar, name, score);
      list.append(row);
    });
    if (result.me) {
      myRank.hidden = false;
      myRank.querySelector('b').textContent = `${result.me.rank}위`;
      myRank.querySelector('strong').textContent = `${Number(result.me.score).toLocaleString('ko-KR')}점`;
    } else {
      myRank.hidden = true;
    }
  }
}

export const oingOnlineAdapter = createOingOnlineAdapter();
