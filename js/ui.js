import { cellsInRect } from './board.js';
import {
  BOARD_DROP_ITEMS,
  buildScoreComparisons,
  comboMultiplier,
  pickMessage,
  resultRetryLabel,
  resultToneForScore,
} from './data.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const TILE_TONE_BY_VALUE = Object.freeze({
  1: 2,
  2: 3,
  3: 2,
  4: 4,
  5: 5,
  6: 6,
  7: 3,
  8: 1,
  9: 3,
});

const CHARACTER_ASSETS = Object.freeze({
  idle: 'assets/characters/cat-idle.webp',
  wave: 'assets/characters/cat-wave.webp',
  cheer: 'assets/characters/cat-cheer.webp',
  success: 'assets/characters/cat-success.webp',
  peek: 'assets/characters/cat-peek.webp',
  fail: 'assets/characters/cat-fail.webp',
});

const CHARACTER_ALT = Object.freeze({
  idle: '앉아 있는 블루 고양이',
  wave: '손을 흔드는 블루 고양이',
  cheer: '응원하는 블루 고양이',
  success: '크게 기뻐하는 블루 고양이',
  peek: '보드 아래에서 빼꼼 보는 블루 고양이',
  fail: '살짝 아쉬워하는 블루 고양이',
});

const ITEM_DROP_COPY = Object.freeze({
  bomb: '톡 누르면 바로 펑!',
  megabomb: '톡 누르면 크게 펑!',
  clock: '톡 누르면 +5초!',
  freeze: '톡 누르면 10초 정지!',
  clover: '톡 누르면 정답 발견!',
});

export class GameUI {
  constructor() {
    this.screens = [...document.querySelectorAll('[data-screen]')];
    this.board = document.querySelector('#board');
    this.boardFrame = document.querySelector('#board-frame');
    this.messageTimer = null;
    this.messageToken = 0;
    this.characterTimer = null;
    this.selectionSnapTimer = null;
    this.selectionSnapAnimation = null;
    this.comboCelebrationTimer = null;
    this.hintTimer = null;
    this.roundReadyTimer = null;
    this.countdownPulseTimer = null;
    this.goalPulseTimer = null;
    this.itemRewardPreviewTimer = null;
    this.comboRewardTimer = null;
    this.comboLossTimer = null;
    this.scoreBurstTimer = null;
    this.lastCountdownSecond = null;
    this.lastSelectionKey = '';
    this.lastSelectionBounds = null;
    this.lastSelectionPerfect = false;
    this.characterToken = 0;
    this.resultCharacterToken = 0;
    this.lastResultMessage = '';
    this.finalScoreAnimationFrame = 0;
    this.startCountdownToken = 0;
    this.elements = {
      round: document.querySelector('#round-value'),
      score: document.querySelector('#score-value'),
      scoreReadout: document.querySelector('.score-readout'),
      time: document.querySelector('#time-value'),
      timePill: document.querySelector('#time-pill'),
      playScreen: document.querySelector('#play-screen'),
      startCountdown: document.querySelector('#start-countdown'),
      startCountdownKicker: document.querySelector('#start-countdown-kicker'),
      startCountdownValue: document.querySelector('#start-countdown-value'),
      combo: document.querySelector('#combo-value'),
      comboChip: document.querySelector('#combo-chip'),
      comboTimerFill: document.querySelector('#combo-timer-fill'),
      goal: document.querySelector('#goal-value'),
      goalLabel: document.querySelector('#goal-label'),
      goalFill: document.querySelector('#goal-fill'),
      goalTrack: document.querySelector('#goal-track'),
      roundMini: document.querySelector('.round-mini'),
      sumBubble: document.querySelector('#sum-bubble'),
      sum: document.querySelector('#sum-value'),
      marquee: document.querySelector('#selection-marquee'),
      tutorial: document.querySelector('#tutorial-guide'),
      tutorialCallout: document.querySelector('#tutorial-callout'),
      catMessage: document.querySelector('#cat-message'),
      playCat: document.querySelector('#play-cat'),
      resultCat: document.querySelector('#result-cat'),
      resultDecor: document.querySelector('#result-decor'),
      roundClear: document.querySelector('#round-clear'),
      timeUp: document.querySelector('#time-up'),
      comboCelebration: document.querySelector('#combo-celebration'),
      comboCelebrationKicker: document.querySelector('#combo-celebration-kicker'),
      comboCelebrationValue: document.querySelector('#combo-celebration-value'),
      scoreBurst: document.querySelector('#score-burst'),
      hintCount: document.querySelector('#hint-count'),
      shuffleCount: document.querySelector('#shuffle-count'),
      bombCount: document.querySelector('#bomb-count'),
      clockCount: document.querySelector('#clock-count'),
      hintButton: document.querySelector('#hint-button'),
      shuffleButton: document.querySelector('#shuffle-button'),
      bombButton: document.querySelector('#bomb-button'),
      clockButton: document.querySelector('#clock-button'),
      homeBest: document.querySelector('#home-best-score'),
      homeBestStage: document.querySelector('#home-best-stage'),
      rankingBest: document.querySelector('#ranking-best-score'),
      rankingLast: document.querySelector('#ranking-last-score'),
      rankingAverage: document.querySelector('#ranking-average-score'),
      rankingCount: document.querySelector('#ranking-run-count'),
      rankingTrend: document.querySelector('#ranking-trend'),
      rankingBars: document.querySelector('#ranking-bars'),
      rankingEmpty: document.querySelector('#ranking-empty'),
      finalScore: document.querySelector('#final-score'),
      finalCombo: document.querySelector('#final-combo'),
      finalRound: document.querySelector('#final-round'),
      finalCats: document.querySelector('#final-cats'),
      newRecord: document.querySelector('#new-record'),
      resultBestCompare: document.querySelector('#result-best-compare'),
      resultPreviousCompare: document.querySelector('#result-previous-compare'),
      resultRecordMeter: document.querySelector('#result-record-meter'),
      resultRecordMeterLabel: document.querySelector('#result-record-meter-label'),
      resultMessage: document.querySelector('#result-message'),
      resultKicker: document.querySelector('#result-kicker'),
      resultStageProgress: document.querySelector('#result-stage-progress'),
      retryButton: document.querySelector('#retry-button'),
      toast: document.querySelector('#toast'),
    };
  }

  showScreen(name) {
    this.screens.forEach((screen) => {
      const active = screen.dataset.screen === name;
      screen.classList.toggle('is-active', active);
      screen.setAttribute('aria-hidden', String(!active));
    });
  }

  async animateStartCountdown(steps, onStep = () => {}) {
    const token = ++this.startCountdownToken;
    const overlay = this.elements.startCountdown;
    overlay.classList.remove('is-visible', 'is-go', 'is-leaving');
    overlay.setAttribute('aria-hidden', 'false');
    void overlay.offsetWidth;
    overlay.classList.add('is-visible');

    for (const step of steps) {
      if (token !== this.startCountdownToken) return false;
      const isGo = step === 'GO!';
      this.elements.startCountdownKicker.textContent = isGo ? '합10을 찾아라냥!' : 'READY?';
      this.elements.startCountdownValue.textContent = String(step);
      overlay.classList.toggle('is-go', isGo);
      overlay.dataset.step = String(step);
      this.elements.startCountdownValue.classList.remove('is-popping');
      void this.elements.startCountdownValue.offsetWidth;
      this.elements.startCountdownValue.classList.add('is-popping');
      onStep(step);
      await delay(isGo ? 560 : 640);
    }

    if (token !== this.startCountdownToken) return false;
    overlay.classList.add('is-leaving');
    await delay(170);
    overlay.classList.remove('is-visible', 'is-go', 'is-leaving');
    overlay.setAttribute('aria-hidden', 'true');
    return true;
  }

  cancelStartCountdown() {
    this.startCountdownToken += 1;
    const overlay = this.elements.startCountdown;
    overlay.classList.remove('is-visible', 'is-go', 'is-leaving');
    overlay.setAttribute('aria-hidden', 'true');
  }

  renderBoard(model, boardItems = new Map(), { preserveScoreBurst = false } = {}) {
    if (!preserveScoreBurst) {
      clearTimeout(this.scoreBurstTimer);
      this.elements.scoreBurst.classList.remove('is-visible');
    }
    this.boardFrame.querySelectorAll('.cat-bonus-pop, .item-tease').forEach((element) => element.remove());
    const cols = model.cols || model.size;
    const rows = model.rows || model.size;
    this.board.dataset.size = String(cols);
    this.board.dataset.cols = String(cols);
    this.board.dataset.rows = String(rows);
    this.boardFrame.dataset.size = String(cols);
    this.boardFrame.dataset.rows = String(rows);
    this.elements.playScreen.classList.toggle('is-tall-board', rows > cols);
    this.board.style.setProperty('--board-cols', cols);
    this.board.style.setProperty('--board-rows', rows);
    const fragment = document.createDocumentFragment();
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const value = model.valueAt(r, c);
        const boardItem = boardItems.get(`${r}:${c}`);
        const bonusCat = model.hasBonusCat?.(r, c) || false;
        const special = model.specialAt?.(r, c) || null;
        const tone = value ? TILE_TONE_BY_VALUE[value] : 0;
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.tabIndex = -1;
        tile.className = boardItem
          ? `tile is-empty is-board-item board-item-${boardItem.type}${boardItem.showcase ? ' is-showcase-item' : ''}`
          : bonusCat
            ? 'tile is-bonus-cat'
            : `tile tone-${tone}${value ? ` value-${value}` : ' is-empty'}${special ? ` is-special-tile special-${special}` : ''}`;
        tile.dataset.row = String(r);
        tile.dataset.col = String(c);
        tile.dataset.value = String(value || 0);
        tile.style.setProperty('--row', String(r));
        tile.style.setProperty('--col', String(c));
        tile.style.setProperty('--round-delay', `${Math.min(90, r * 12 + c * 7)}ms`);
        tile.setAttribute('role', 'gridcell');
        if (boardItem) {
          const itemDefinition = BOARD_DROP_ITEMS[boardItem.type];
          tile.dataset.item = boardItem.type;
          tile.tabIndex = 0;
          tile.setAttribute('aria-label', `${itemDefinition?.label || '아이템'} 즉시 발동`);
          const icon = document.createElement('img');
          icon.className = 'board-item-icon';
          icon.src = itemDefinition?.asset || '';
          icon.alt = '';
          const sparkle = document.createElement('i');
          sparkle.className = 'board-item-sparkle';
          const action = document.createElement('small');
          action.className = 'board-item-action';
          action.textContent = '터치';
          tile.append(icon, sparkle, action);
        } else if (bonusCat) {
          tile.dataset.bonusCat = 'true';
          tile.setAttribute('aria-label', '고양이 보너스 칸, 합계에는 0으로 계산');
          const cat = document.createElement('img');
          cat.className = 'bonus-cat-art';
          cat.src = CHARACTER_ASSETS.peek;
          cat.width = 359;
          cat.height = 306;
          cat.loading = 'eager';
          cat.decoding = 'async';
          cat.alt = '';
          const badge = document.createElement('i');
          badge.className = 'bonus-cat-mark';
          badge.setAttribute('aria-hidden', 'true');
          tile.append(cat, badge);
        } else {
          const specialLabel = special === 'clock' ? ', 시계 타일 +5초' : special === 'bomb' ? ', 폭탄 타일' : '';
          tile.setAttribute('aria-label', value ? `${value}${specialLabel}` : '빈칸');
          if (value) {
            const number = document.createElement('span');
            number.textContent = String(value);
            tile.appendChild(number);
            if (special) {
              tile.dataset.special = special;
              const badge = document.createElement('img');
              badge.className = 'special-tile-badge';
              badge.src = special === 'clock'
                ? 'assets/icons/hud/time.webp'
                : 'assets/icons/items/bomb.webp';
              badge.alt = '';
              const actionLabel = document.createElement('small');
              actionLabel.className = 'special-tile-label';
              actionLabel.textContent = special === 'clock' ? '+5초' : '펑!';
              tile.append(badge, actionLabel);
            }
          }
        }
        fragment.appendChild(tile);
      }
    }
    this.board.replaceChildren(fragment);
    this.clearSelection();
  }

  tileAt(r, c) {
    return this.board.querySelector(`.tile[data-row="${r}"][data-col="${c}"]`);
  }

  selectionBounds(rect) {
    const first = this.tileAt(rect.r1, rect.c1)?.getBoundingClientRect();
    const last = this.tileAt(rect.r2, rect.c2)?.getBoundingClientRect();
    const frame = this.boardFrame.getBoundingClientRect();
    if (!first || !last || !frame.width) return null;
    return {
      left: first.left - frame.left,
      top: first.top - frame.top,
      right: last.right - frame.left,
      bottom: last.bottom - frame.top,
      frameWidth: frame.width,
      frameHeight: frame.height,
      frame,
    };
  }

  previewSelection(rect, stats, pointer) {
    const selectionKey = `${rect.r1}:${rect.c1}:${rect.r2}:${rect.c2}`;
    const selectionChanged = selectionKey !== this.lastSelectionKey || !this.lastSelectionBounds;
    const marquee = this.elements.marquee;
    let bounds = this.lastSelectionBounds;
    if (selectionChanged) {
      const selected = new Set(cellsInRect(rect).map(({ r, c }) => `${r}:${c}`));
      this.board.querySelectorAll('.tile').forEach((tile) => {
        tile.classList.toggle(
          'is-selected',
          !tile.dataset.item && selected.has(`${tile.dataset.row}:${tile.dataset.col}`),
        );
      });
      bounds = this.selectionBounds(rect);
      this.lastSelectionKey = selectionKey;
      this.lastSelectionBounds = bounds;
      if (bounds) {
        const openingSelection = !marquee.classList.contains('is-visible');
        if (openingSelection) marquee.classList.add('is-repositioning');
        const pad = 3;
        marquee.style.left = `${bounds.left - pad}px`;
        marquee.style.top = `${bounds.top - pad}px`;
        marquee.style.width = `${bounds.right - bounds.left + pad * 2}px`;
        marquee.style.height = `${bounds.bottom - bounds.top + pad * 2}px`;
        if (openingSelection) {
          void marquee.offsetWidth;
          marquee.classList.remove('is-repositioning');
        }
        marquee.classList.add('is-visible');
      }
      marquee.classList.toggle('is-ten', stats.sum === 10);
      this.elements.sum.textContent = stats.sum === 10 ? '10!' : String(stats.sum);
      this.elements.sumBubble.classList.toggle('is-ten', stats.sum === 10);
      this.board.classList.toggle('is-perfect', stats.sum === 10);
    }

    let pullX = 0;
    let pullY = 0;
    if (bounds) {
      const bubble = this.elements.sumBubble;
      const pointerX = Number.isFinite(pointer?.x)
        ? pointer.x - bounds.frame.left
        : (bounds.left + bounds.right) / 2;
      const pointerY = Number.isFinite(pointer?.y)
        ? pointer.y - bounds.frame.top
        : bounds.top;
      pullX = 0;
      pullY = 0;
      const selectionWidth = Math.max(1, bounds.right - bounds.left);
      const selectionHeight = Math.max(1, bounds.bottom - bounds.top);
      const syrupX = clamp(((pointerX - bounds.left) / selectionWidth) * 100, 10, 90);
      const syrupY = clamp(((pointerY - bounds.top) / selectionHeight) * 100, 10, 90);
      marquee.style.setProperty('--syrup-x', `${syrupX}%`);
      marquee.style.setProperty('--syrup-y', `${syrupY}%`);
      marquee.style.setProperty('--syrup-pull-x', `${pullX}px`);
      marquee.style.setProperty('--syrup-pull-y', `${pullY}px`);
      const sideOffset = pointerX > bounds.frameWidth / 2 ? -48 : 48;
      const bubbleX = clamp(pointerX + sideOffset, 49, bounds.frameWidth - 49);
      const bubbleY = clamp(Math.min(bounds.top - 39, pointerY - 52), -31, bounds.frameHeight - 44);
      bubble.style.left = `${bubbleX}px`;
      bubble.style.top = `${bubbleY}px`;
    }

    this.elements.sumBubble.classList.add('is-visible');
    this.boardFrame.style.setProperty('--drag-pull-x', '0px');
    this.boardFrame.style.setProperty('--drag-pull-y', '0px');
  }

  selectionSnap(isPerfect = false) {
    const marquee = this.elements.marquee;
    if (isPerfect === this.lastSelectionPerfect) return;
    this.lastSelectionPerfect = isPerfect;
    if (!isPerfect) {
      this.selectionSnapAnimation?.cancel();
      this.selectionSnapAnimation = null;
      clearTimeout(this.selectionSnapTimer);
      marquee.classList.remove('is-snapping', 'is-perfect-snap');
      return;
    }
    // onSelectionStep fires immediately before previewSelection. On a fresh
    // gesture the marquee still carries its previous geometry, so animating it
    // here can expose a one-frame outline at the old position.
    if (!this.lastSelectionBounds || !marquee.classList.contains('is-visible')) return;
    this.selectionSnapAnimation?.cancel();
    clearTimeout(this.selectionSnapTimer);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && typeof marquee.animate === 'function') {
      const frames = [
        { scale: '0.978', filter: 'brightness(1)' },
        { scale: '1.022', filter: 'brightness(1.08) saturate(1.06)', offset: 0.52 },
        { scale: '1', filter: 'brightness(1.025)' },
      ];
      this.selectionSnapAnimation = marquee.animate(frames, {
        duration: isPerfect ? 102 : 86,
        easing: 'cubic-bezier(.18,.82,.25,1.18)',
      });
      return;
    }
    marquee.classList.remove('is-snapping', 'is-perfect-snap');
    void marquee.offsetWidth;
    marquee.classList.toggle('is-perfect-snap', isPerfect);
    marquee.classList.add('is-snapping');
    this.selectionSnapTimer = window.setTimeout(() => {
      marquee.classList.remove('is-snapping', 'is-perfect-snap');
    }, 125);
  }

  clearSelection() {
    clearTimeout(this.selectionSnapTimer);
    this.selectionSnapAnimation?.cancel();
    this.selectionSnapAnimation = null;
    this.lastSelectionPerfect = false;
    this.lastSelectionKey = '';
    this.lastSelectionBounds = null;
    this.board.querySelectorAll('.tile.is-selected').forEach((tile) => tile.classList.remove('is-selected'));
    this.board.querySelectorAll('.tile.is-tap-anchor').forEach((tile) => tile.classList.remove('is-tap-anchor'));
    this.elements.marquee.classList.remove('is-visible', 'is-ten', 'is-snapping', 'is-perfect-snap');
    this.elements.marquee.classList.remove('is-repositioning');
    this.elements.marquee.style.setProperty('--syrup-pull-x', '0px');
    this.elements.marquee.style.setProperty('--syrup-pull-y', '0px');
    this.elements.marquee.style.width = '0px';
    this.elements.marquee.style.height = '0px';
    this.elements.sumBubble.classList.remove('is-visible', 'is-ten');
    this.board.classList.remove('is-perfect');
    this.elements.sum.textContent = '0';
    this.boardFrame.style.setProperty('--drag-pull-x', '0px');
    this.boardFrame.style.setProperty('--drag-pull-y', '0px');
  }

  showTapAnchor(cell) {
    this.board.querySelectorAll('.tile.is-tap-anchor').forEach((tile) => tile.classList.remove('is-tap-anchor'));
    this.tileAt(cell.r, cell.c)?.classList.add('is-tap-anchor');
  }

  spawnParticles(rect, combo = 1) {
    const bounds = this.selectionBounds(rect);
    if (!bounds) return;
    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;
    const sources = ['assets/decor/sparkle.webp', 'assets/decor/star.webp', 'assets/decor/heart.webp'];
    const imageCount = combo >= 8 ? 3 : combo >= 5 ? 2 : 1;
    sources.slice(0, imageCount).forEach((source, index) => {
      const particle = document.createElement('img');
      particle.className = `success-particle particle-${index + 1}`;
      particle.src = source;
      particle.alt = '';
      particle.style.left = `${centerX}px`;
      particle.style.top = `${centerY}px`;
      this.boardFrame.appendChild(particle);
      setTimeout(() => particle.remove(), 520);
    });

    const glintCount = combo >= 8 ? 9 : combo >= 5 ? 7 : combo >= 3 ? 6 : 5;
    const glintColors = ['#ff9ab4', '#8cddca', '#ffd985', '#ffffff'];
    for (let index = 0; index < glintCount; index += 1) {
      const angle = (Math.PI * 2 * index) / glintCount - Math.PI / 2;
      const distance = 34 + (index % 3) * 11 + Math.min(combo, 8) * 1.5;
      const glint = document.createElement('i');
      glint.className = 'success-glint';
      glint.style.left = `${centerX}px`;
      glint.style.top = `${centerY}px`;
      const glintX = Math.cos(angle) * distance;
      const glintY = Math.sin(angle) * distance;
      glint.style.setProperty('--glint-x', `${glintX}px`);
      glint.style.setProperty('--glint-y', `${glintY}px`);
      glint.style.setProperty('--glint-mid-x', `${glintX * 0.76}px`);
      glint.style.setProperty('--glint-mid-y', `${glintY * 0.76}px`);
      glint.style.setProperty('--glint-delay', `${(index % 4) * 13}ms`);
      glint.style.setProperty('--glint-color', glintColors[index % glintColors.length]);
      this.boardFrame.appendChild(glint);
      setTimeout(() => glint.remove(), 500);
    }

    const dropVectors = [[-28, -18], [27, -16], [-20, 24], [23, 22]];
    dropVectors.slice(0, combo >= 5 ? 4 : 3).forEach(([x, y], index) => {
      const drop = document.createElement('i');
      drop.className = 'success-drop';
      drop.style.left = `${centerX}px`;
      drop.style.top = `${centerY}px`;
      drop.style.setProperty('--drop-x', `${x}px`);
      drop.style.setProperty('--drop-y', `${y}px`);
      drop.style.setProperty('--drop-delay', `${index * 16}ms`);
      this.boardFrame.appendChild(drop);
      setTimeout(() => drop.remove(), 460);
    });
  }

  showScoreFlight(rect, combo = 1) {
    const bounds = this.selectionBounds(rect);
    const target = this.elements.scoreReadout?.getBoundingClientRect();
    const screen = this.elements.playScreen?.getBoundingClientRect();
    if (!bounds || !target || !screen?.width) return;

    const sourceX = bounds.frame.left + (bounds.left + bounds.right) / 2 - screen.left;
    const sourceY = bounds.frame.top + (bounds.top + bounds.bottom) / 2 - screen.top;
    const targetX = target.left + Math.min(28, target.width * 0.16) - screen.left;
    const targetY = target.top + target.height / 2 - screen.top;
    const offsetX = targetX - sourceX;
    const offsetY = targetY - sourceY;
    const flight = document.createElement('div');
    flight.className = 'score-flight';
    flight.dataset.level = combo >= 8 ? '8' : combo >= 5 ? '5' : combo >= 3 ? '3' : '1';
    flight.style.left = `${sourceX}px`;
    flight.style.top = `${sourceY}px`;
    flight.style.setProperty('--score-flight-x', `${offsetX}px`);
    flight.style.setProperty('--score-flight-y', `${offsetY}px`);
    flight.style.setProperty('--score-flight-mid-x', `${offsetX * 0.48}px`);
    flight.style.setProperty('--score-flight-mid-y', `${offsetY * 0.42 - 24}px`);
    const icon = document.createElement('img');
    icon.src = 'assets/icons/hud/score.webp';
    icon.alt = '';
    flight.append(icon, document.createElement('i'), document.createElement('i'));
    this.elements.playScreen.appendChild(flight);
    setTimeout(() => flight.remove(), 590);
  }

  pulseGoal(combo = 1) {
    const track = this.elements.goalTrack;
    clearTimeout(this.goalPulseTimer);
    track.dataset.level = combo >= 8 ? '8' : combo >= 5 ? '5' : combo >= 3 ? '3' : '1';
    track.classList.remove('is-rewarded');
    void track.offsetWidth;
    track.classList.add('is-rewarded');
    this.goalPulseTimer = window.setTimeout(() => {
      track.classList.remove('is-rewarded');
    }, 520);
  }

  previewItemReward() {
    clearTimeout(this.itemRewardPreviewTimer);
    this.boardFrame.classList.remove('is-item-reward-near');
    void this.boardFrame.offsetWidth;
    this.boardFrame.classList.add('is-item-reward-near');
    this.itemRewardPreviewTimer = window.setTimeout(() => {
      this.boardFrame.classList.remove('is-item-reward-near');
    }, 760);
  }

  showComboReward(item, delayMs = 0) {
    clearTimeout(this.comboRewardTimer);
    this.elements.playScreen.querySelector('.combo-reward-pop')?.remove();
    this.comboRewardTimer = window.setTimeout(() => {
      const pop = document.createElement('div');
      pop.className = `combo-reward-pop combo-reward-${item.id}`;
      const icon = document.createElement('img');
      icon.src = item.asset;
      icon.alt = '';
      const copy = document.createElement('span');
      copy.textContent = `7 COMBO · ${item.label} GET!`;
      pop.append(icon, copy, document.createElement('i'), document.createElement('i'));
      const chip = this.elements.comboChip.getBoundingClientRect();
      const screen = this.elements.playScreen.getBoundingClientRect();
      pop.style.left = `${chip.right - screen.left - 4}px`;
      pop.style.top = `${chip.top - screen.top - 2}px`;
      this.elements.playScreen.appendChild(pop);
      this.elements.comboChip.classList.remove('is-reward-earned');
      void this.elements.comboChip.offsetWidth;
      this.elements.comboChip.classList.add('is-reward-earned');
      window.setTimeout(() => {
        pop.remove();
        this.elements.comboChip.classList.remove('is-reward-earned');
      }, 1050);
    }, Math.max(0, delayMs));
  }

  showComboLoss(amount) {
    const loss = Math.max(1, Math.round(Number(amount) || 1));
    clearTimeout(this.comboLossTimer);
    this.elements.playScreen.querySelector('.combo-loss-pop')?.remove();
    const pop = document.createElement('div');
    pop.className = 'combo-loss-pop';
    pop.textContent = `COMBO -${loss}`;
    const chip = this.elements.comboChip.getBoundingClientRect();
    const screen = this.elements.playScreen.getBoundingClientRect();
    pop.style.left = `${chip.right - screen.left - 4}px`;
    pop.style.top = `${chip.top - screen.top}px`;
    this.elements.playScreen.appendChild(pop);
    this.comboLossTimer = window.setTimeout(() => pop.remove(), 720);
  }

  async animateSuccess(rect, combo = 1) {
    const tiles = cellsInRect(rect)
      .map(({ r, c }) => this.tileAt(r, c))
      .filter((tile) => tile && !tile.dataset.item);
    tiles.forEach((tile, index) => {
      tile.style.setProperty('--pop-delay', `${Math.min(index * 7, 42)}ms`);
      tile.classList.add('is-success');
    });
    this.elements.marquee.classList.add('is-ten');
    this.elements.marquee.classList.add('is-bursting');
    this.boardFrame.classList.add('is-success-resolving');
    this.boardFrame.dataset.comboImpact = combo >= 8 ? '8' : combo >= 5 ? '5' : combo >= 3 ? '3' : '1';
    this.spawnParticles(rect, combo);
    this.showScoreFlight(rect, combo);
    await delay(270);
    this.elements.marquee.classList.remove('is-bursting', 'is-visible');
    this.boardFrame.classList.remove('is-success-resolving');
    delete this.boardFrame.dataset.comboImpact;
  }

  showMatchConfirmation(rect, combo = 1) {
    const bounds = this.selectionBounds(rect);
    if (!bounds) return;
    this.boardFrame.querySelector('.match-confirmation')?.remove();
    const confirmation = document.createElement('div');
    confirmation.className = 'match-confirmation';
    confirmation.dataset.level = combo >= 8 ? '8' : combo >= 5 ? '5' : combo >= 3 ? '3' : '1';
    confirmation.textContent = '딱 10!';
    confirmation.style.left = `${clamp((bounds.left + bounds.right) / 2, 52, bounds.frameWidth - 52)}px`;
    confirmation.style.top = `${Math.max(22, bounds.top - 8)}px`;
    this.boardFrame.appendChild(confirmation);
    window.setTimeout(() => confirmation.remove(), 520);
  }

  async animateSpecialTiles(specials = [], blastCells = []) {
    if (!specials.length) return;
    const specialTiles = specials
      .map(({ r, c, type }) => ({ tile: this.tileAt(r, c), type }))
      .filter(({ tile }) => tile);
    specialTiles.forEach(({ tile, type }) => tile.classList.add('is-special-triggered', `is-${type}-triggered`));
    blastCells
      .map(({ r, c }) => this.tileAt(r, c))
      .filter(Boolean)
      .forEach((tile, index) => {
        tile.style.setProperty('--blast-delay', `${index * 24}ms`);
        tile.classList.add('is-special-blast');
      });
    const source = specialTiles[0]?.tile?.getBoundingClientRect();
    const frame = this.boardFrame.getBoundingClientRect();
    if (source) {
      const pop = document.createElement('div');
      pop.className = `special-trigger-pop special-trigger-${specialTiles[0].type}`;
      pop.style.left = `${source.left + source.width / 2 - frame.left}px`;
      pop.style.top = `${source.top + source.height / 2 - frame.top}px`;
      pop.textContent = specialTiles.some(({ type }) => type === 'clock') ? '+5초' : 'POP!';
      this.boardFrame.appendChild(pop);
      setTimeout(() => pop.remove(), 520);
    }
    await delay(300);
  }

  async animateFailure(rect) {
    const tiles = cellsInRect(rect)
      .map(({ r, c }) => this.tileAt(r, c))
      .filter((tile) => tile && !tile.dataset.item);
    tiles.forEach((tile) => tile.classList.add('is-fail'));
    this.elements.marquee.classList.add('is-fail');
    await delay(175);
    tiles.forEach((tile) => tile.classList.remove('is-fail'));
    this.elements.marquee.classList.remove('is-fail');
    this.clearSelection();
  }

  showHint(rect) {
    clearTimeout(this.hintTimer);
    this.board.classList.remove('is-hinting');
    const tiles = cellsInRect(rect)
      .map(({ r, c }) => this.tileAt(r, c))
      .filter((tile) => tile && !tile.dataset.item);
    tiles.forEach((tile, index) => {
      tile.style.setProperty('--hint-index', index);
      tile.classList.add('is-hint');
    });
    this.board.classList.add('is-hinting');
    const bounds = this.selectionBounds(rect);
    if (bounds) {
      this.boardFrame.querySelector('.hint-region')?.remove();
      const region = document.createElement('div');
      region.className = 'hint-region';
      const pad = 4;
      region.style.left = `${bounds.left - pad}px`;
      region.style.top = `${bounds.top - pad}px`;
      region.style.width = `${bounds.right - bounds.left + pad * 2}px`;
      region.style.height = `${bounds.bottom - bounds.top + pad * 2}px`;
      const label = document.createElement('span');
      const icon = document.createElement('img');
      icon.src = 'assets/icons/items/hint.webp';
      icon.alt = '';
      const labelText = document.createElement('strong');
      labelText.textContent = '합10 여기!';
      label.append(icon, labelText);
      region.append(label);
      for (let index = 0; index < 4; index += 1) region.appendChild(document.createElement('i'));
      this.boardFrame.appendChild(region);
      window.setTimeout(() => region.remove(), 2200);
    }
    this.hintTimer = setTimeout(() => {
      tiles.forEach((tile) => {
        tile.classList.remove('is-hint');
        tile.style.removeProperty('--hint-index');
      });
      this.board.classList.remove('is-hinting');
    }, 2200);
  }

  previewBombTarget(rect) {
    const bounds = this.selectionBounds(rect);
    if (!bounds) return;
    this.boardFrame.querySelector('.bomb-target-region')?.remove();
    cellsInRect(rect)
      .map(({ r, c }) => this.tileAt(r, c))
      .filter((tile) => tile && !tile.dataset.item)
      .forEach((tile, index) => {
        tile.style.setProperty('--bomb-preview-delay', `${index * 18}ms`);
        tile.classList.add('is-bomb-target');
      });
    const region = document.createElement('div');
    region.className = 'bomb-target-region';
    region.style.left = `${bounds.left - 3}px`;
    region.style.top = `${bounds.top - 3}px`;
    region.style.width = `${bounds.right - bounds.left + 6}px`;
    region.style.height = `${bounds.bottom - bounds.top + 6}px`;
    region.textContent = 'POP!';
    this.boardFrame.appendChild(region);
  }

  hasBombTargetPreview() {
    return Boolean(this.boardFrame.querySelector('.bomb-target-region'));
  }

  showTutorial(rect) {
    const bounds = this.selectionBounds(rect);
    if (!bounds) return;
    const first = this.tileAt(rect.r1, rect.c1).getBoundingClientRect();
    const last = this.tileAt(rect.r2, rect.c2).getBoundingClientRect();
    const startX = first.left + first.width / 2 - bounds.frame.left;
    const startY = first.top + first.height / 2 - bounds.frame.top;
    const endX = last.left + last.width / 2 - bounds.frame.left;
    const endY = last.top + last.height / 2 - bounds.frame.top;
    const distance = Math.max(34, Math.hypot(endX - startX, endY - startY));
    const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
    const sparkleTrail = this.elements.tutorial.querySelector('.tutorial-sparkle-trail');
    const focus = this.elements.tutorial.querySelector('.tutorial-focus');
    sparkleTrail.style.left = `${startX}px`;
    sparkleTrail.style.top = `${startY}px`;
    sparkleTrail.style.width = `${distance}px`;
    sparkleTrail.style.transform = `rotate(${angle}deg)`;
    focus.style.left = `${bounds.left - 5}px`;
    focus.style.top = `${bounds.top - 5}px`;
    focus.style.width = `${bounds.right - bounds.left + 10}px`;
    focus.style.height = `${bounds.bottom - bounds.top + 10}px`;
    cellsInRect(rect).forEach(({ r, c }) => this.tileAt(r, c)?.classList.add('is-tutorial'));
    this.board.classList.add('is-tutorial-active');
    this.elements.tutorial.classList.add('is-visible');
    this.elements.tutorialCallout?.classList.add('is-visible');
  }

  hideTutorial() {
    this.elements.tutorial.classList.remove('is-visible');
    this.elements.tutorialCallout?.classList.remove('is-visible');
    this.board.classList.remove('is-tutorial-active');
    this.board.querySelectorAll('.tile.is-tutorial').forEach((tile) => tile.classList.remove('is-tutorial'));
  }

  clearTransientBoardFeedback() {
    clearTimeout(this.hintTimer);
    this.hintTimer = null;
    this.clearSelection();
    this.hideTutorial();
    this.board.classList.remove('is-hinting', 'is-shuffling-out', 'is-shuffling-in');
    this.board.querySelectorAll('.tile.is-bomb-target').forEach((tile) => {
      tile.classList.remove('is-bomb-target');
      tile.style.removeProperty('--bomb-preview-delay');
    });
    clearTimeout(this.scoreBurstTimer);
    this.scoreBurstTimer = null;
    this.elements.scoreBurst.classList.remove('is-visible');
    this.elements.roundClear.classList.remove('is-visible');
    this.boardFrame.classList.remove('is-success-resolving');
    this.boardFrame.querySelectorAll([
      '.success-particle',
      '.success-glint',
      '.success-number-fragment',
      '.success-drop',
      '.hint-region',
      '.shuffle-fx',
      '.bomb-fx',
      '.bomb-target-region',
      '.megabomb-fx',
      '.item-impact-fx',
      '.game-end-sweep',
      '.end-score-summary',
      '.item-drop-fx',
      '.item-tease',
      '.cat-bonus-pop',
      '.combo-confetti',
      '.match-confirmation',
      '.final-second-pop',
      '.stage-entry',
      '.stage-growth-confetti',
    ].join(',')).forEach((element) => element.remove());
    this.clearEndAnswers();
    this.elements.playScreen.querySelectorAll('.score-flight').forEach((element) => element.remove());
    this.elements.playScreen.querySelector('.final-second-pop')?.remove();
    this.elements.playScreen.querySelector('.time-rescue-label')?.remove();
    this.elements.playScreen.querySelector('.low-time-alert')?.remove();
    this.elements.playScreen.querySelectorAll('.combo-reward-pop, .combo-loss-pop').forEach((element) => element.remove());
    this.elements.playScreen.classList.remove('is-board-growth-clear', 'is-time-rescued', 'is-low-time-alerting');
  }

  setShuffleVectors() {
    const size = Number(this.board.dataset.size) || 4;
    const center = (size - 1) / 2;
    this.board.querySelectorAll('.tile').forEach((tile, index) => {
      const row = Number(tile.dataset.row);
      const col = Number(tile.dataset.col);
      const angle = Math.atan2(row - center, col - center) + (index % 2 ? 0.48 : -0.48);
      const distance = 18 + ((index * 7) % 19);
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      const curveX = -Math.sin(angle) * (12 + (index % 4) * 3);
      const curveY = Math.cos(angle) * (12 + (index % 4) * 3);
      tile.style.setProperty('--shuffle-x', `${x}px`);
      tile.style.setProperty('--shuffle-y', `${y}px`);
      const rotate = ((index % 5) - 2) * 5;
      tile.style.setProperty('--shuffle-mid-x', `${x * 0.46 + curveX}px`);
      tile.style.setProperty('--shuffle-mid-y', `${y * 0.46 + curveY}px`);
      tile.style.setProperty('--shuffle-rotate', `${rotate}deg`);
      tile.style.setProperty('--shuffle-mid-rotate', `${rotate * 0.45}deg`);
      tile.style.setProperty('--shuffle-delay', `${(index % 5) * 16}ms`);
    });
  }

  async animateShuffleOut() {
    this.setShuffleVectors();
    this.boardFrame.querySelector('.shuffle-fx')?.remove();
    const effect = document.createElement('div');
    effect.className = 'shuffle-fx';
    const icon = document.createElement('img');
    icon.className = 'shuffle-core-icon';
    icon.src = 'assets/icons/items/shuffle.webp';
    icon.alt = '';
    effect.appendChild(icon);
    for (let index = 0; index < 5; index += 1) effect.appendChild(document.createElement('b'));
    for (let index = 0; index < 2; index += 1) {
      const paw = document.createElement('em');
      paw.className = 'shuffle-paw';
      effect.appendChild(paw);
    }
    this.boardFrame.appendChild(effect);
    this.board.classList.add('is-shuffling-out');
    await delay(360);
    this.board.classList.remove('is-shuffling-out');
  }

  async animateShuffleIn() {
    this.setShuffleVectors();
    this.board.classList.add('is-shuffling-in');
    await delay(380);
    this.board.classList.remove('is-shuffling-in');
    this.boardFrame.classList.remove('is-shuffle-settled');
    void this.boardFrame.offsetWidth;
    this.boardFrame.classList.add('is-shuffle-settled');
    this.board.querySelectorAll('.tile').forEach((tile) => {
      tile.style.removeProperty('--shuffle-x');
      tile.style.removeProperty('--shuffle-y');
      tile.style.removeProperty('--shuffle-mid-x');
      tile.style.removeProperty('--shuffle-mid-y');
      tile.style.removeProperty('--shuffle-rotate');
      tile.style.removeProperty('--shuffle-mid-rotate');
      tile.style.removeProperty('--shuffle-delay');
    });
    this.boardFrame.querySelector('.shuffle-fx')?.remove();
    window.setTimeout(() => this.boardFrame.classList.remove('is-shuffle-settled'), 240);
  }

  async animateBomb(rect) {
    const bounds = this.selectionBounds(rect);
    const tiles = cellsInRect(rect)
      .map(({ r, c }) => this.tileAt(r, c))
      .filter((tile) => tile && !tile.dataset.item);
    this.boardFrame.querySelector('.bomb-target-region')?.remove();
    tiles.forEach((tile, index) => {
      tile.classList.remove('is-bomb-target');
      tile.style.removeProperty('--bomb-preview-delay');
      tile.style.setProperty('--blast-delay', `${Math.min(index * 22, 120)}ms`);
      tile.classList.add('is-bombed');
    });
    if (bounds) {
      const effect = document.createElement('div');
      effect.className = 'bomb-fx';
      effect.style.left = `${(bounds.left + bounds.right) / 2}px`;
      effect.style.top = `${(bounds.top + bounds.bottom) / 2}px`;
      const icon = document.createElement('img');
      icon.src = 'assets/icons/items/bomb.webp';
      icon.alt = '';
      const label = document.createElement('strong');
      label.textContent = 'POP!';
      effect.append(icon, label, document.createElement('i'), document.createElement('i'), document.createElement('i'));
      for (let index = 0; index < 5; index += 1) {
        const drop = document.createElement('b');
        drop.style.setProperty('--bomb-drop-index', String(index));
        effect.appendChild(drop);
      }
      this.boardFrame.appendChild(effect);
      setTimeout(() => effect.remove(), 720);
    }
    await delay(470);
  }

  async animateMegaBomb(cells, origin) {
    const tiles = cells
      .map(({ r, c }) => this.tileAt(r, c))
      .filter((tile) => tile && !tile.dataset.item);
    tiles.forEach((tile, index) => {
      tile.style.setProperty('--mega-delay', `${Math.min(index * 18, 126)}ms`);
      tile.classList.add('is-megabombed');
    });
    const source = this.tileAt(origin.row, origin.col)?.getBoundingClientRect();
    const frame = this.boardFrame.getBoundingClientRect();
    if (source) {
      const effect = document.createElement('div');
      effect.className = 'megabomb-fx';
      effect.style.left = `${source.left + source.width / 2 - frame.left}px`;
      effect.style.top = `${source.top + source.height / 2 - frame.top}px`;
      const icon = document.createElement('img');
      icon.src = 'assets/icons/items/megabomb.webp';
      icon.alt = '';
      effect.append(icon);
      for (let index = 0; index < 5; index += 1) effect.appendChild(document.createElement('i'));
      this.boardFrame.appendChild(effect);
      setTimeout(() => effect.remove(), 900);
    }
    this.boardFrame.classList.add('megabomb-kick');
    await delay(610);
    this.boardFrame.classList.remove('megabomb-kick');
  }

  showBoardItemDrops(items) {
    this.boardFrame.querySelector('.item-tease')?.remove();
    items.forEach(({ row, col, type, showcase = false }, index) => {
      const tile = this.tileAt(row, col);
      if (!tile) return;
      const landingDelay = 300 + index * 80;
      tile.style.setProperty('--item-drop-delay', `${landingDelay}ms`);
      tile.classList.add('is-item-spawning');
      const tileRect = tile.getBoundingClientRect();
      const frameRect = this.boardFrame.getBoundingClientRect();
      const screenRect = this.elements.playScreen.getBoundingClientRect();
      const comboRect = this.elements.comboChip.getBoundingClientRect();
      const definition = BOARD_DROP_ITEMS[type];
      const flight = document.createElement('div');
      flight.className = `item-reward-flight item-reward-${type}`;
      flight.style.left = `${comboRect.left + comboRect.width / 2 - screenRect.left}px`;
      flight.style.top = `${comboRect.top + comboRect.height / 2 - screenRect.top}px`;
      const flightX = tileRect.left + tileRect.width / 2 - comboRect.left - comboRect.width / 2;
      const flightY = tileRect.top + tileRect.height / 2 - comboRect.top - comboRect.height / 2;
      flight.style.setProperty('--reward-x', `${flightX}px`);
      flight.style.setProperty('--reward-y', `${flightY}px`);
      flight.style.setProperty('--reward-mid-x', `${flightX * 0.48}px`);
      flight.style.setProperty('--reward-mid-y', `${flightY * 0.38 - 24}px`);
      flight.style.setProperty('--reward-delay', `${index * 80}ms`);
      const flightIcon = document.createElement('img');
      flightIcon.src = definition?.asset || '';
      flightIcon.alt = '';
      flight.append(flightIcon, document.createElement('i'), document.createElement('i'), document.createElement('i'));
      this.elements.playScreen.appendChild(flight);
      const effect = document.createElement('div');
      effect.className = `item-drop-fx item-drop-${type}`;
      effect.style.left = `${tileRect.left + tileRect.width / 2 - frameRect.left}px`;
      effect.style.top = `${tileRect.top + tileRect.height / 2 - frameRect.top}px`;
      effect.style.setProperty('--item-landing-delay', `${landingDelay}ms`);
      const icon = document.createElement('img');
      icon.src = definition?.asset || '';
      icon.alt = '';
      const label = document.createElement('span');
      label.textContent = showcase
        ? `첫 등장! ${definition?.label || '희귀 아이템'}`
        : ITEM_DROP_COPY[type] || `${definition?.label || '아이템'} 등장!`;
      effect.append(icon, label);
      for (let sparkle = 0; sparkle < 4; sparkle += 1) effect.appendChild(document.createElement('i'));
      for (let pawIndex = 0; pawIndex < 2; pawIndex += 1) {
        const paw = document.createElement('b');
        paw.className = 'item-drop-paw';
        effect.appendChild(paw);
      }
      this.boardFrame.appendChild(effect);
      setTimeout(() => {
        tile.classList.remove('is-item-spawning');
        effect.remove();
        flight.remove();
      }, 1420 + index * 80);
    });
  }

  showItemTease(type = 'bomb') {
    this.boardFrame.querySelector('.item-tease')?.remove();
    const definition = BOARD_DROP_ITEMS[type] || BOARD_DROP_ITEMS.bomb;
    const tease = document.createElement('div');
    tease.className = `item-tease item-tease-${definition.id}`;
    const icon = document.createElement('img');
    icon.src = definition.asset || '';
    icon.width = 286;
    icon.height = 312;
    icon.alt = '';
    const copy = document.createElement('div');
    const kicker = document.createElement('span');
    kicker.textContent = 'NEXT BONUS';
    const title = document.createElement('strong');
    title.textContent = `다음 합10에 ${definition.label}!`;
    copy.append(kicker, title);
    tease.append(icon, copy, document.createElement('i'), document.createElement('i'));
    this.boardFrame.appendChild(tease);
    setTimeout(() => tease.remove(), 1150);
  }

  pressBoardItem(row, col, pressed) {
    this.tileAt(row, col)?.classList.toggle('is-item-pressed', pressed);
  }

  itemButton(type) {
    return ({
      hint: this.elements.hintButton,
      shuffle: this.elements.shuffleButton,
      bomb: this.elements.bombButton,
      clock: this.elements.clockButton,
    })[type] || null;
  }

  async animateItemCollect(item, sourceElement, targetElement = this.itemButton(item.type)) {
    if (!sourceElement || !targetElement) return;
    const screen = this.elements.playScreen;
    const screenRect = screen.getBoundingClientRect();
    const start = sourceElement.getBoundingClientRect();
    const target = targetElement.getBoundingClientRect();
    const definition = BOARD_DROP_ITEMS[item.type];
    const flight = document.createElement('div');
    flight.className = `item-collect-flight item-collect-${item.type}`;
    flight.style.left = `${start.left + start.width / 2 - screenRect.left}px`;
    flight.style.top = `${start.top + start.height / 2 - screenRect.top}px`;
    const collectX = target.left + target.width / 2 - start.left - start.width / 2;
    const collectY = target.top + target.height / 2 - start.top - start.height / 2;
    flight.style.setProperty('--collect-x', `${collectX}px`);
    flight.style.setProperty('--collect-y', `${collectY}px`);
    flight.style.setProperty('--collect-mid-x', `${collectX * 0.48}px`);
    flight.style.setProperty('--collect-mid-y', `${collectY * 0.42 - 24}px`);
    const icon = document.createElement('img');
    icon.src = definition?.asset || '';
    icon.alt = '';
    const label = document.createElement('strong');
    label.textContent = '+1';
    flight.append(icon, label, document.createElement('i'), document.createElement('i'), document.createElement('i'));
    sourceElement.classList.add('is-collecting');
    screen.appendChild(flight);
    await delay(510);
    sourceElement.classList.remove('is-collecting');
    flight.remove();
    targetElement.classList.remove('is-stocked');
    void targetElement.offsetWidth;
    targetElement.classList.add('is-stocked');
    setTimeout(() => targetElement.classList.remove('is-stocked'), 520);
  }

  async animateItemCast(type, targetElement = this.boardFrame) {
    const sourceElement = this.itemButton(type);
    if (!sourceElement || !targetElement) return;
    const screen = this.elements.playScreen;
    const screenRect = screen.getBoundingClientRect();
    const start = sourceElement.getBoundingClientRect();
    const target = targetElement.getBoundingClientRect();
    const asset = type === 'clock'
      ? BOARD_DROP_ITEMS.clock.asset
      : type === 'bomb'
        ? BOARD_DROP_ITEMS.bomb.asset
        : `assets/icons/items/${type}.webp`;
    const flight = document.createElement('div');
    flight.className = `item-cast-flight item-cast-${type}`;
    flight.style.left = `${start.left + start.width / 2 - screenRect.left}px`;
    flight.style.top = `${start.top + start.height / 2 - screenRect.top}px`;
    const castX = target.left + target.width / 2 - start.left - start.width / 2;
    const castY = target.top + target.height / 2 - start.top - start.height / 2;
    flight.style.setProperty('--cast-x', `${castX}px`);
    flight.style.setProperty('--cast-y', `${castY}px`);
    flight.style.setProperty('--cast-mid-x', `${castX * 0.52}px`);
    flight.style.setProperty('--cast-mid-y', `${castY * 0.44 - 22}px`);
    const icon = document.createElement('img');
    icon.src = asset;
    icon.alt = '';
    flight.append(icon, document.createElement('i'), document.createElement('i'));
    sourceElement.classList.add('is-casting');
    screen.appendChild(flight);
    await delay(310);
    flight.remove();
    sourceElement.classList.remove('is-casting');
  }

  async animateClock(seconds = 8, sourceElement = this.elements.clockButton, { urgent = false } = {}) {
    const screen = this.elements.playScreen;
    const start = sourceElement.getBoundingClientRect();
    const target = this.elements.timePill.getBoundingClientRect();
    const frame = screen.getBoundingClientRect();
    const flight = document.createElement('div');
    flight.className = `clock-flight${urgent ? ' is-urgent' : ''}`;
    flight.style.left = `${start.left + start.width / 2 - frame.left}px`;
    flight.style.top = `${start.top + start.height / 2 - frame.top}px`;
    flight.style.setProperty('--clock-x', `${target.left + target.width / 2 - start.left - start.width / 2}px`);
    flight.style.setProperty('--clock-y', `${target.top + target.height / 2 - start.top - start.height / 2}px`);
    const icon = document.createElement('img');
    icon.src = 'assets/icons/hud/time.webp';
    icon.alt = '';
    const label = document.createElement('strong');
    label.textContent = `+${seconds} SEC`;
    flight.append(icon, label);
    sourceElement?.classList.add('is-casting');
    this.elements.playScreen.classList.toggle('is-time-rescued', urgent);
    screen.appendChild(flight);
    const impact = document.createElement('div');
    impact.className = 'item-impact-fx item-impact-clock';
    impact.style.left = `${target.left + target.width / 2 - frame.left}px`;
    impact.style.top = `${target.top + target.height / 2 - frame.top}px`;
    for (let index = 0; index < 6; index += 1) impact.appendChild(document.createElement('i'));
    await delay(350);
    screen.appendChild(impact);
    if (urgent) {
      const rescue = document.createElement('div');
      rescue.className = 'time-rescue-label';
      rescue.textContent = '시간 살렸다!';
      rescue.style.left = `${target.left + target.width / 2 - frame.left}px`;
      rescue.style.top = `${target.bottom - frame.top + 5}px`;
      screen.appendChild(rescue);
      window.setTimeout(() => rescue.remove(), 760);
    }
    this.elements.timePill.classList.remove('is-time-added');
    void this.elements.timePill.offsetWidth;
    this.elements.timePill.classList.add('is-time-added');
    await delay(270);
    flight.remove();
    impact.remove();
    sourceElement?.classList.remove('is-casting');
    this.elements.timePill.classList.remove('is-time-added');
    this.elements.playScreen.classList.remove('is-time-rescued');
  }

  async animateFreeze(seconds = 15, sourceElement) {
    if (!sourceElement) return;
    const screen = this.elements.playScreen;
    const start = sourceElement.getBoundingClientRect();
    const target = this.elements.timePill.getBoundingClientRect();
    const frame = screen.getBoundingClientRect();
    const flight = document.createElement('div');
    flight.className = 'freeze-flight';
    flight.style.left = `${start.left + start.width / 2 - frame.left}px`;
    flight.style.top = `${start.top + start.height / 2 - frame.top}px`;
    flight.style.setProperty('--freeze-x', `${target.left + target.width / 2 - start.left - start.width / 2}px`);
    flight.style.setProperty('--freeze-y', `${target.top + target.height / 2 - start.top - start.height / 2}px`);
    const icon = document.createElement('img');
    icon.src = BOARD_DROP_ITEMS.freeze.asset;
    icon.alt = '';
    const label = document.createElement('strong');
    label.textContent = `${seconds}초 정지`;
    flight.append(icon, label, document.createElement('i'), document.createElement('i'), document.createElement('i'));
    screen.appendChild(flight);
    const impact = document.createElement('div');
    impact.className = 'item-impact-fx item-impact-freeze';
    for (let index = 0; index < 7; index += 1) impact.appendChild(document.createElement('i'));
    await delay(315);
    this.boardFrame.appendChild(impact);
    await delay(255);
    flight.remove();
    window.setTimeout(() => impact.remove(), 560);
  }

  setFreezeActive(active) {
    const enabled = Boolean(active);
    this.elements.playScreen.classList.toggle('is-time-frozen', enabled);
    this.elements.timePill.classList.toggle('is-frozen', enabled);
    this.elements.timePill.setAttribute('aria-label', enabled ? '남은 시간이 15초 동안 정지됨' : '남은 시간');
  }

  async animateClover(sourceElement) {
    if (!sourceElement) return;
    const screen = this.elements.playScreen;
    const start = sourceElement.getBoundingClientRect();
    const target = this.boardFrame.getBoundingClientRect();
    const frame = screen.getBoundingClientRect();
    const flight = document.createElement('div');
    flight.className = 'clover-flight';
    flight.style.left = `${start.left + start.width / 2 - frame.left}px`;
    flight.style.top = `${start.top + start.height / 2 - frame.top}px`;
    flight.style.setProperty('--clover-x', `${target.left + target.width / 2 - start.left - start.width / 2}px`);
    flight.style.setProperty('--clover-y', `${target.top + target.height / 2 - start.top - start.height / 2}px`);
    const icon = document.createElement('img');
    icon.src = BOARD_DROP_ITEMS.clover.asset;
    icon.alt = '';
    const label = document.createElement('strong');
    label.textContent = '정답 발견';
    flight.append(icon, label, document.createElement('i'), document.createElement('i'), document.createElement('i'));
    screen.appendChild(flight);
    const impact = document.createElement('div');
    impact.className = 'item-impact-fx item-impact-clover';
    impact.append(document.createElement('i'), document.createElement('i'), document.createElement('i'), document.createElement('i'));
    await delay(345);
    this.boardFrame.appendChild(impact);
    await delay(275);
    flight.remove();
    window.setTimeout(() => impact.remove(), 620);
  }

  showCloverHint(rect) {
    const tiles = cellsInRect(rect)
      .map(({ r, c }) => this.tileAt(r, c))
      .filter((tile) => tile && !tile.dataset.item);
    tiles.forEach((tile) => tile.classList.add('is-clover-hint'));
    setTimeout(() => tiles.forEach((tile) => tile.classList.remove('is-clover-hint')), 4500);
  }

  showItemScoreBurst(points, rect, kind) {
    const bounds = this.selectionBounds(rect);
    const burst = this.elements.scoreBurst;
    const primary = document.createElement('strong');
    primary.textContent = `+${points}`;
    const detail = document.createElement('span');
    detail.textContent = kind === 'megabomb'
      ? '메가폭탄 보너스'
      : kind === 'bomb' ? '폭탄 보너스' : '아이템 보너스';
    burst.replaceChildren(primary, detail);
    burst.dataset.level = '1';
    burst.dataset.item = kind;
    if (bounds) {
      burst.style.left = `${(bounds.left + bounds.right) / 2}px`;
      burst.style.top = `${(bounds.top + bounds.bottom) / 2}px`;
    }
    clearTimeout(this.scoreBurstTimer);
    burst.classList.remove('is-visible');
    void burst.offsetWidth;
    burst.classList.add('is-visible');
    this.scoreBurstTimer = window.setTimeout(() => {
      burst.classList.remove('is-visible');
      delete burst.dataset.item;
    }, 660);
  }

  showScoreBurst(points, rect, dimensions, combo, cellCount, bonus = {}) {
    const bounds = this.selectionBounds(rect);
    const burst = this.elements.scoreBurst;
    const primary = document.createElement('strong');
    const isWide = bonus.comboGain > 1;
    primary.textContent = isWide ? `WOW! +${points}` : `+${points}`;
    const detail = document.createElement('span');
    const labels = [];
    if (isWide) labels.push(`${cellCount}칸 · 콤보 +2`);
    else if (cellCount >= 3) labels.push(`${cellCount}칸 클리어`);
    if (bonus.wideBonusPoints > 0) labels.push(`큰 조합 +${bonus.wideBonusPoints}`);
    if (bonus.catBonusPoints > 0) labels.push(`고양이 +${bonus.catBonusPoints}`);
    if (bonus.specialBonusPoints > 0) labels.push(`폭탄 +${bonus.specialBonusPoints}`);
    if (combo > 1) labels.push(`배율 ×${comboMultiplier(combo).toFixed(2)}`);
    detail.textContent = labels.join(' · ');
    detail.hidden = labels.length === 0;
    burst.replaceChildren(primary, detail);
    burst.dataset.level = combo >= 8 ? '8' : combo >= 5 ? '5' : combo >= 3 ? '3' : '1';
    burst.dataset.wide = String(isWide);
    if (bounds) {
      burst.style.left = `${clamp((bounds.left + bounds.right) / 2, 82, bounds.frameWidth - 82)}px`;
      burst.style.top = `${clamp((bounds.top + bounds.bottom) / 2, 52, bounds.frameHeight - 34)}px`;
    } else {
      const cols = typeof dimensions === 'number' ? dimensions : dimensions.cols;
      const rows = typeof dimensions === 'number' ? dimensions : dimensions.rows;
      burst.style.left = `${((rect.c1 + rect.c2 + 1) / 2 / cols) * 100}%`;
      burst.style.top = `${((rect.r1 + rect.r2 + 1) / 2 / rows) * 100}%`;
    }
    clearTimeout(this.scoreBurstTimer);
    burst.classList.remove('is-visible');
    void burst.offsetWidth;
    burst.classList.add('is-visible');
    this.scoreBurstTimer = window.setTimeout(() => {
      burst.classList.remove('is-visible');
      delete burst.dataset.wide;
    }, 660);
  }

  showCatBonus(points, rect, catCount = 1) {
    this.boardFrame.querySelector('.cat-bonus-pop')?.remove();
    const catTile = this.board.querySelector('.tile.is-bonus-cat.is-selected');
    const tileRect = catTile?.getBoundingClientRect();
    const frameRect = this.boardFrame.getBoundingClientRect();
    const bounds = this.selectionBounds(rect);
    const pop = document.createElement('div');
    pop.className = 'cat-bonus-pop';
    const cat = document.createElement('img');
    cat.src = CHARACTER_ASSETS.peek;
    cat.width = 359;
    cat.height = 306;
    cat.alt = '';
    const copy = document.createElement('div');
    const label = document.createElement('span');
    label.textContent = catCount > 1 ? `고양이 보너스 ×${catCount}` : '고양이 보너스';
    const score = document.createElement('strong');
    score.textContent = `+${points}`;
    copy.append(label, score);
    pop.append(cat, copy);
    for (let index = 0; index < 3; index += 1) pop.appendChild(document.createElement('i'));

    if (tileRect) {
      pop.style.left = `${tileRect.left + tileRect.width / 2 - frameRect.left}px`;
      pop.style.top = `${tileRect.top + tileRect.height * 0.18 - frameRect.top}px`;
    } else if (bounds) {
      pop.style.left = `${(bounds.left + bounds.right) / 2}px`;
      pop.style.top = `${(bounds.top + bounds.bottom) / 2}px`;
    }

    this.boardFrame.appendChild(pop);
    setTimeout(() => pop.remove(), 900);
  }

  showComboMoment(combo) {
    const level = combo >= 8 ? '8' : combo >= 5 ? '5' : combo >= 3 ? '3' : '';
    this.elements.comboChip.dataset.level = level;
    this.elements.comboChip.classList.remove('is-punching');
    void this.elements.comboChip.offsetWidth;
    this.elements.comboChip.classList.add('is-punching');
    setTimeout(() => this.elements.comboChip.classList.remove('is-punching'), 520);

    const milestone = combo === 3 || combo === 5 || combo === 8 || (combo > 8 && combo % 3 === 0);
    if (!milestone) return;

    const celebration = this.elements.comboCelebration;
    clearTimeout(this.comboCelebrationTimer);
    celebration.dataset.level = level;
    this.elements.comboCelebrationValue.textContent = String(combo);
    const callout = level === '8'
      ? 'OING FEVER!'
      : level === '5'
        ? 'SWEET!'
        : 'NICE!';
    this.elements.comboCelebrationKicker.textContent = callout;
    this.elements.comboChip.dataset.callout = callout;
    celebration.classList.remove('is-visible');
    void celebration.offsetWidth;
    celebration.setAttribute('aria-hidden', 'false');
    celebration.classList.add('is-visible');
    this.elements.playScreen.classList.add('is-combo-celebrating');
    this.boardFrame.classList.remove('combo-celebrating');
    this.boardFrame.dataset.comboCelebration = level;
    this.boardFrame.classList.add('combo-celebrating');
    if (level) this.spawnComboConfetti(Number(level));
    const duration = level === '8' ? 820 : level === '5' ? 760 : 700;
    this.comboCelebrationTimer = window.setTimeout(() => {
      this.dismissComboCelebration();
    }, duration);
  }

  showLowTimeAlert(seconds = 10) {
    this.elements.playScreen.querySelector('.low-time-alert')?.remove();
    this.dismissComboCelebration();
    this.elements.playScreen.classList.add('is-low-time-alerting');
    const alert = document.createElement('div');
    alert.className = 'low-time-alert';
    const clock = document.createElement('img');
    clock.src = 'assets/icons/hud/time.webp';
    clock.alt = '';
    const copy = document.createElement('div');
    const kicker = document.createElement('small');
    kicker.textContent = 'HURRY UP!';
    const value = document.createElement('strong');
    value.textContent = `${Math.max(1, Math.round(Number(seconds) || 10))} SEC`;
    copy.append(kicker, value);
    alert.append(clock, copy, document.createElement('i'), document.createElement('i'));
    this.elements.playScreen.appendChild(alert);
    window.setTimeout(() => {
      alert.remove();
      this.elements.playScreen.classList.remove('is-low-time-alerting');
    }, 980);
  }

  spawnComboConfetti(level) {
    this.boardFrame.querySelectorAll('.combo-confetti').forEach((particle) => particle.remove());
    const count = level >= 8 ? 10 : level >= 5 ? 7 : 4;
    const sources = [
      'assets/decor/star.webp',
      'assets/decor/sparkle.webp',
      'assets/decor/heart.webp',
      'assets/decor/paw.webp',
    ];
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement('img');
      const angle = -156 + (312 / Math.max(1, count - 1)) * index;
      const distance = 74 + (index % 3) * 18 + level * 2;
      const radians = (angle * Math.PI) / 180;
      particle.className = 'combo-confetti';
      particle.src = sources[index % sources.length];
      particle.alt = '';
      particle.style.setProperty('--combo-x', `${Math.cos(radians) * distance}px`);
      particle.style.setProperty('--combo-y', `${Math.sin(radians) * distance}px`);
      particle.style.setProperty('--combo-rotate', `${(index % 2 ? 1 : -1) * (35 + index * 11)}deg`);
      particle.style.setProperty('--combo-delay', `${(index % 5) * 18}ms`);
      particle.style.setProperty('--combo-size', `${level >= 8 ? 18 + (index % 3) * 3 : 15 + (index % 3) * 2}px`);
      this.boardFrame.appendChild(particle);
      setTimeout(() => particle.remove(), level >= 8 ? 980 : 860);
    }
  }

  dismissComboCelebration() {
    clearTimeout(this.comboCelebrationTimer);
    this.comboCelebrationTimer = null;
    this.elements.comboCelebration.classList.remove('is-visible');
    this.elements.comboCelebration.setAttribute('aria-hidden', 'true');
    this.elements.playScreen.classList.remove('is-combo-celebrating');
    delete this.elements.comboChip.dataset.callout;
    this.boardFrame.classList.remove('combo-celebrating');
    delete this.boardFrame.dataset.comboCelebration;
  }

  showRoundClear({
    scoreBonus = 0,
    timeBonus = 0,
    stage = 1,
    nextStage = stage + 1,
    rows = 0,
    cols = 0,
    boardGrew = false,
  } = {}) {
    this.dismissComboCelebration();
    const clear = this.elements.roundClear;
    const label = clear.querySelector('strong');
    const reward = clear.querySelector('#round-clear-reward');
    if (label) label.textContent = `STAGE ${stage} CLEAR!`;
    const details = [];
    if (boardGrew && rows > 0 && cols > 0) details.push(`${cols}×${rows} OPEN`);
    if (timeBonus > 0) details.push(`+${timeBonus} SEC`);
    if (scoreBonus > 0) details.push(`+${scoreBonus.toLocaleString('ko-KR')}점`);
    if (reward) reward.textContent = details.join(' · ') || `STAGE ${nextStage} GO!`;
    clear.dataset.stage = String(stage);
    clear.dataset.nextStage = String(nextStage);
    clear.classList.toggle('is-milestone', timeBonus > 0 || boardGrew);
    this.elements.playScreen.classList.toggle('is-board-growth-clear', boardGrew);
    if (boardGrew) this.spawnStageGrowthConfetti();
    clearTimeout(this.scoreBurstTimer);
    this.scoreBurstTimer = null;
    this.elements.scoreBurst.classList.remove('is-visible');
    clear.classList.remove('is-visible');
    void clear.offsetWidth;
    clear.classList.add('is-visible');
    this.elements.playScreen.classList.add('is-stage-clearing');
    setTimeout(() => {
      clear.classList.remove('is-visible');
      this.elements.playScreen.classList.remove('is-stage-clearing');
      this.elements.playScreen.classList.remove('is-board-growth-clear');
    }, 820);
  }

  spawnStageGrowthConfetti() {
    this.boardFrame.querySelectorAll('.stage-growth-confetti').forEach((particle) => particle.remove());
    const sources = [
      'assets/decor/star.webp',
      'assets/decor/sparkle.webp',
      'assets/decor/heart.webp',
      'assets/decor/flower.webp',
    ];
    const vectors = [
      [-34, -28], [34, -25], [-42, 7], [43, 10], [-28, 34], [31, 36],
    ];
    vectors.forEach(([x, y], index) => {
      const particle = document.createElement('img');
      particle.className = 'stage-growth-confetti';
      particle.src = sources[index % sources.length];
      particle.alt = '';
      particle.style.setProperty('--growth-x', `${x}px`);
      particle.style.setProperty('--growth-y', `${y}px`);
      particle.style.setProperty('--growth-delay', `${index * 34}ms`);
      this.boardFrame.appendChild(particle);
      window.setTimeout(() => particle.remove(), 920);
    });
  }

  showStageTimeBonus(seconds = 0) {
    const amount = Math.max(0, Math.round(Number(seconds) || 0));
    if (!amount || !this.elements.timePill) return;
    this.elements.playScreen.querySelector('.stage-time-bonus')?.remove();
    const pill = this.elements.timePill.getBoundingClientRect();
    const screen = this.elements.playScreen.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.className = 'stage-time-bonus';
    pop.textContent = `+${amount} SEC`;
    pop.style.left = `${pill.left + pill.width / 2 - screen.left}px`;
    pop.style.top = `${pill.bottom - screen.top + 4}px`;
    this.elements.playScreen.appendChild(pop);
    this.elements.timePill.classList.remove('is-bonus-awarded');
    void this.elements.timePill.offsetWidth;
    this.elements.timePill.classList.add('is-bonus-awarded');
    window.setTimeout(() => {
      pop.remove();
      this.elements.timePill.classList.remove('is-bonus-awarded');
    }, 820);
  }

  async animateRoundTransition(nextRound, swapBoard, intro = {}) {
    this.clearTransientBoardFeedback();
    this.boardFrame.classList.add('is-round-leaving');
    await delay(140);
    swapBoard();
    this.boardFrame.classList.remove('is-round-leaving');
    this.elements.roundMini.classList.remove('is-advancing');
    void this.elements.roundMini.offsetWidth;
    this.elements.roundMini.classList.add('is-advancing');
    this.boardFrame.classList.add('is-round-arriving');
    const entry = document.createElement('div');
    entry.className = 'stage-entry';
    const kicker = document.createElement('small');
    kicker.textContent = intro.kicker || 'LEVEL UP';
    const title = document.createElement('strong');
    title.textContent = intro.title || `STAGE ${nextRound}`;
    const detail = document.createElement('span');
    detail.textContent = intro.detail || '새 보드 시작';
    const goal = document.createElement('b');
    goal.textContent = `목표 ${Math.max(1, Math.round(Number(intro.target) || 1))}`;
    entry.classList.toggle('is-milestone', Boolean(intro.boardGrew));
    entry.append(kicker, title, detail, goal, document.createElement('i'), document.createElement('i'));
    this.boardFrame.appendChild(entry);
    await delay(460);
    entry.remove();
    this.boardFrame.classList.remove('is-round-arriving');
    this.elements.roundMini.classList.remove('is-advancing');
  }

  showRoundReady(duration = 420) {
    clearTimeout(this.roundReadyTimer);
    this.boardFrame.classList.remove('is-round-ready');
    void this.boardFrame.offsetWidth;
    this.boardFrame.classList.add('is-round-ready');
    this.roundReadyTimer = window.setTimeout(() => {
      this.boardFrame.classList.remove('is-round-ready');
    }, duration);
  }

  showFinalSecond(second) {
    this.elements.playScreen.querySelector('.final-second-pop')?.remove();
    const pop = document.createElement('div');
    pop.className = 'final-second-pop';
    pop.textContent = String(second);
    const pill = this.elements.timePill.getBoundingClientRect();
    const screen = this.elements.playScreen.getBoundingClientRect();
    pop.style.left = `${pill.left + pill.width / 2 - screen.left}px`;
    pop.style.top = `${pill.bottom - screen.top + 22}px`;
    this.elements.playScreen.appendChild(pop);
    setTimeout(() => pop.remove(), 520);
  }

  showEndAnswers(answers = []) {
    this.board.querySelectorAll('.tile.is-end-answer').forEach((tile) => {
      tile.classList.remove('is-end-answer');
      tile.style.removeProperty('--answer-group');
    });
    answers.slice(0, 4).forEach((answer, group) => {
      cellsInRect(answer).forEach(({ r, c }) => {
        const tile = this.tileAt(r, c);
        if (!tile || tile.classList.contains('is-empty')) return;
        tile.classList.add('is-end-answer');
        tile.style.setProperty('--answer-group', String(group));
      });
    });
  }

  clearEndAnswers() {
    this.board.querySelectorAll('.tile.is-end-answer').forEach((tile) => {
      tile.classList.remove('is-end-answer');
      tile.style.removeProperty('--answer-group');
    });
  }

  async animateGameEnd({ score = 0, maxCombo = 0, newRecord = false, answers = [] } = {}) {
    this.dismissComboCelebration();
    this.clearSelection();
    clearTimeout(this.scoreBurstTimer);
    this.scoreBurstTimer = null;
    this.elements.scoreBurst.classList.remove('is-visible');
    const timeUp = this.elements.timeUp;
    this.boardFrame.classList.remove('is-game-ending');
    timeUp.classList.remove('is-visible');
    void this.boardFrame.offsetWidth;
    this.boardFrame.classList.add('is-game-ending');
    this.showEndAnswers(answers);
    await delay(520);
    const sweep = document.createElement('div');
    sweep.className = 'game-end-sweep';
    sweep.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
    this.boardFrame.appendChild(sweep);
    timeUp.classList.add('is-visible');
    await delay(620);
    timeUp.classList.remove('is-visible');
    const summary = document.createElement('div');
    summary.className = 'end-score-summary';
    const label = document.createElement('small');
    label.textContent = newRecord ? 'NEW RECORD!' : 'FINAL SCORE';
    const value = document.createElement('strong');
    value.textContent = Math.max(0, Math.round(score)).toLocaleString('ko-KR');
    const combo = document.createElement('span');
    combo.textContent = maxCombo > 1 ? `최고 콤보 ${maxCombo}` : '끝까지 잘했다냥!';
    summary.append(label, value, combo, document.createElement('i'), document.createElement('i'));
    summary.classList.toggle('is-record', newRecord);
    this.boardFrame.appendChild(summary);
    await delay(620);
    summary.remove();
    sweep.remove();
    this.clearEndAnswers();
    this.boardFrame.classList.remove('is-game-ending');
    this.elements.playScreen.classList.add('is-ending-to-result');
    await delay(170);
  }

  setPlayCharacter(pose, duration = 0) {
    const next = CHARACTER_ASSETS[pose] ? pose : 'peek';
    const token = ++this.characterToken;
    clearTimeout(this.characterTimer);
    const image = this.elements.playCat;
    const source = CHARACTER_ASSETS[next];
    let applied = false;
    const apply = () => {
      if (applied || token !== this.characterToken) return;
      applied = true;
      image.classList.remove('is-switching');
      image.src = source;
      image.alt = CHARACTER_ALT[next];
      image.dataset.pose = next;
      void image.offsetWidth;
      image.classList.add('is-switching');
      if (duration > 0 && next !== 'peek') {
        this.characterTimer = setTimeout(() => {
          if (token === this.characterToken) this.setPlayCharacter('peek');
        }, duration);
      }
    };

    if (image.getAttribute('src') === source && image.complete) {
      apply();
      return;
    }

    const loader = new Image();
    loader.decoding = 'async';
    loader.onload = apply;
    loader.onerror = apply;
    loader.src = source;
    loader.decode?.().then(apply).catch(() => {});
  }

  setResultCharacter(pose) {
    const next = CHARACTER_ASSETS[pose] ? pose : 'cheer';
    const token = ++this.resultCharacterToken;
    const image = this.elements.resultCat;
    const source = CHARACTER_ASSETS[next];
    let applied = false;
    const apply = () => {
      if (applied || token !== this.resultCharacterToken) return;
      applied = true;
      image.src = source;
      image.alt = CHARACTER_ALT[next];
      image.dataset.pose = next;
    };
    if (image.getAttribute('src') === source && image.complete) apply();
    else {
      const loader = new Image();
      loader.decoding = 'async';
      loader.onload = apply;
      loader.onerror = apply;
      loader.src = source;
      loader.decode?.().then(apply).catch(() => {});
    }
  }

  showMessage(message, duration = 1500, tone = '') {
    const token = ++this.messageToken;
    clearTimeout(this.messageTimer);
    const bubble = this.elements.catMessage;
    bubble.dataset.tone = tone;
    bubble.classList.remove('is-changing');
    void bubble.offsetWidth;
    const emphasis = /(오잉|합 ?10|콤보|아이템|메가폭탄|폭탄|클로버|시간|정답|보너스|다음 판|좋다냥)/g;
    const parts = String(message).split(emphasis);
    const nodes = parts.filter(Boolean).map((part) => {
      if (part.match(emphasis)) {
        const strong = document.createElement('strong');
        strong.textContent = part;
        return strong;
      }
      return document.createTextNode(part);
    });
    bubble.replaceChildren(...nodes);
    bubble.classList.add('is-changing');
    this.messageTimer = setTimeout(() => {
      if (token === this.messageToken) bubble.classList.remove('is-changing');
    }, duration);
  }

  updateHUD({ round, score, timeLeft, duration = 0, timed = duration > 0, freezeRemaining = 0, combo, comboRemainingMs = 0, comboWindowMs = 1, rewardRemaining = 7, progress, target }) {
    this.elements.round.textContent = String(round);
    this.elements.score.textContent = score.toLocaleString('ko-KR');
    const time = Math.max(0, Math.ceil(timeLeft));
    this.elements.timePill.hidden = !timed;
    this.elements.playScreen.classList.toggle('is-untimed', !timed);
    this.elements.time.textContent = timed
      ? `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`
      : '';
    this.elements.timePill.style.setProperty('--time-progress', String(timed ? clamp(timeLeft / Math.max(1, duration), 0, 1) : 1));
    const isFrozen = freezeRemaining > 0;
    this.elements.timePill.classList.toggle('is-low-time', timed && !isFrozen && time > 10 && time <= 30);
    this.elements.timePill.classList.toggle('is-warning', timed && !isFrozen && time <= 10);
    this.elements.timePill.dataset.freezeRemaining = String(Math.ceil(freezeRemaining));
    const isFinalCountdown = timed && !isFrozen && time > 0 && time <= 10;
    this.elements.playScreen.classList.toggle('is-final-countdown', isFinalCountdown);
    this.elements.playScreen.dataset.round = String(round);
    this.elements.playScreen.dataset.stageBand = round >= 8 ? 'fever' : round >= 5 ? 'wide' : round >= 3 ? 'rising' : 'warmup';
    this.boardFrame.dataset.round = String(round);
    this.elements.timePill.dataset.urgency = time <= 3 ? 'high' : time <= 5 ? 'medium' : 'low';
    if (isFinalCountdown && time !== this.lastCountdownSecond) {
      this.lastCountdownSecond = time;
      clearTimeout(this.countdownPulseTimer);
      this.elements.timePill.classList.remove('is-counting');
      this.boardFrame.classList.remove('is-counting');
      void this.elements.timePill.offsetWidth;
      this.elements.timePill.classList.add('is-counting');
      this.boardFrame.classList.add('is-counting');
      this.countdownPulseTimer = setTimeout(() => {
        this.elements.timePill.classList.remove('is-counting');
        this.boardFrame.classList.remove('is-counting');
      }, time <= 3 ? 360 : 250);
    } else if (!isFinalCountdown) {
      this.lastCountdownSecond = null;
      this.elements.timePill.classList.remove('is-counting');
      this.boardFrame.classList.remove('is-counting');
    }
    this.elements.combo.textContent = String(combo);
    const comboStep = combo % 7;
    const rewardUnlocked = rewardRemaining > 0;
    const rewardProgress = !rewardUnlocked || combo === 0 ? 0 : comboStep === 0 ? 1 : comboStep / 7;
    this.elements.comboTimerFill.style.transform = `scaleX(${rewardProgress})`;
    this.elements.comboChip.classList.toggle('is-active', combo > 0);
    const comboUrgency = combo > 0 ? clamp(comboRemainingMs / Math.max(1, comboWindowMs), 0, 1) : 1;
    const comboExpiring = combo >= 3 && comboUrgency > 0 && comboUrgency <= 0.24;
    this.elements.comboChip.classList.toggle('is-expiring', comboExpiring);
    this.boardFrame.classList.toggle('is-fever-expiring', combo >= 8 && comboExpiring);
    this.elements.comboChip.style.setProperty('--combo-urgency', String(comboUrgency));
    this.elements.comboChip.classList.toggle('is-reward-close', rewardUnlocked && combo > 0 && rewardRemaining <= 2);
    this.elements.comboChip.dataset.rewardRemaining = String(rewardRemaining);
    this.elements.comboChip.setAttribute('aria-label', rewardUnlocked && combo > 0 && rewardRemaining <= 2
      ? `콤보 ${combo}, 아이템까지 ${rewardRemaining}번`
      : `콤보 ${combo}`);
    const comboLevel = combo >= 8 ? '8' : combo >= 5 ? '5' : combo >= 3 ? '3' : '';
    this.elements.comboChip.dataset.level = comboLevel;
    this.elements.playScreen.dataset.comboBand = combo >= 8 ? 'fever' : combo >= 5 ? 'hot' : combo >= 3 ? 'warm' : 'calm';
    this.boardFrame.classList.toggle('is-fever', combo >= 8);
    this.elements.goalLabel.textContent = '성공';
    this.elements.goal.textContent = `${progress} / ${target}`;
    this.elements.goal.closest('.goal-status')?.classList.toggle('is-complete', progress >= target);
    this.elements.goalFill.style.width = `${Math.min(100, (progress / Math.max(1, target)) * 100)}%`;
  }

  updateItems({ hint, shuffle, bomb, clock, clockAvailable = true }) {
    this.elements.hintCount.textContent = String(hint);
    this.elements.shuffleCount.textContent = String(shuffle);
    this.elements.bombCount.textContent = String(bomb);
    this.elements.clockCount.textContent = String(clock);
    this.elements.hintButton.disabled = hint <= 0;
    this.elements.shuffleButton.disabled = shuffle <= 0;
    this.elements.bombButton.disabled = bomb <= 0;
    this.elements.clockButton.disabled = clock <= 0 || !clockAvailable;
    // 0개일 때 무조건 "소진"을 붙이면, 아직 한 번도 얻은 적 없는 아이템까지
    // "다 써버렸다"로 보인다(폭탄은 1스테이지부터 0이라 첫 화면부터 그렇게 보였다).
    // 한 번이라도 가졌던 적이 있을 때만 소진으로 표시하고, 그 전에는 잠금으로 둔다.
    const markItem = (button, count, locked = false, lockCopy = '잠금') => {
      if (!button) return;
      if (count > 0) button.dataset.everHeld = '1';
      const everHeld = button.dataset.everHeld === '1';
      const empty = count <= 0;
      const depleted = empty && everHeld && !locked;
      const stageLocked = locked || (empty && !everHeld);
      button.classList.toggle('is-depleted', depleted);
      button.classList.toggle('is-stage-locked', stageLocked);
      button.dataset.state = stageLocked ? 'locked' : depleted ? 'depleted' : 'available';
      button.dataset.lockCopy = lockCopy;
    };
    markItem(this.elements.hintButton, hint);
    markItem(this.elements.shuffleButton, shuffle);
    markItem(this.elements.bombButton, bomb, false, 'S3');
    markItem(this.elements.clockButton, clock, !clockAvailable, 'S5');
    this.elements.hintButton.dataset.count = String(hint);
    this.elements.shuffleButton.dataset.count = String(shuffle);
    this.elements.bombButton.dataset.count = String(bomb);
    this.elements.clockButton.dataset.count = String(clock);
    this.elements.hintButton.setAttribute('aria-label', `힌트, ${hint}회 남음`);
    this.elements.shuffleButton.setAttribute('aria-label', `섞기, ${shuffle}회 남음`);
    this.elements.bombButton.setAttribute('aria-label', `폭탄, ${bomb}회 남음`);
    this.elements.clockButton.setAttribute('aria-label', clockAvailable
      ? `시계, ${clock}회 남음`
      : '시계, 시간 제한 스테이지에서 사용 가능');
  }

  resetItemAvailabilityHistory() {
    [
      this.elements.hintButton,
      this.elements.shuffleButton,
      this.elements.bombButton,
      this.elements.clockButton,
    ].forEach((button) => {
      if (button) delete button.dataset.everHeld;
    });
  }

  updateBestScore(score) {
    const text = score.toLocaleString('ko-KR');
    this.elements.homeBest.textContent = text;
    this.elements.rankingBest.textContent = text;
  }

  updateHighestStage(stage) {
    if (this.elements.homeBestStage) {
      this.elements.homeBestStage.textContent = `STAGE ${Math.max(1, Math.round(Number(stage) || 1))}`;
    }
  }

  renderRanking({ summary } = {}) {
    const record = summary || { recent: [], best: 0, average: 0, last: 0, count: 0, trendTone: 'new', trendText: '첫 판을 기다리고 있다냥!' };
    const format = (value) => Math.max(0, Math.round(Number(value) || 0)).toLocaleString('ko-KR');
    this.elements.rankingBest.textContent = format(record.best);
    this.elements.rankingLast.textContent = format(record.last);
    this.elements.rankingAverage.textContent = format(record.average);
    this.elements.rankingCount.textContent = `${record.count}/7`;
    this.elements.rankingTrend.textContent = record.trendText;
    this.elements.rankingTrend.dataset.tone = record.trendTone;
    this.elements.rankingEmpty.hidden = record.count > 0;
    const maxScore = Math.max(record.best, ...record.recent, 1);
    const bars = record.recent.map((score, index) => {
      const bar = document.createElement('i');
      const height = 22 + (score / maxScore) * 78;
      bar.style.setProperty('--record-height', `${height}%`);
      bar.dataset.index = String(index + 1);
      bar.classList.toggle('is-latest', index === record.recent.length - 1);
      bar.classList.toggle('is-best', score === record.best);
      bar.setAttribute('aria-label', `${index + 1}번째 기록 ${format(score)}점`);
      const value = document.createElement('b');
      value.textContent = score >= 1000 ? `${(score / 1000).toFixed(score >= 10000 ? 0 : 1)}k` : String(score);
      bar.appendChild(value);
      return bar;
    });
    this.elements.rankingBars.replaceChildren(...bars);
    this.elements.rankingBars.setAttribute('aria-label', record.count
      ? `최근 ${record.count}판 점수: ${record.recent.map(format).join(', ')}`
      : '저장된 최근 점수가 없음');
  }

  animateFinalScore(score) {
    cancelAnimationFrame(this.finalScoreAnimationFrame);
    const target = Math.max(0, Math.round(Number(score) || 0));
    const output = this.elements.finalScore;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    output.classList.remove('is-counting');
    if (reducedMotion || target === 0) {
      output.textContent = target.toLocaleString('ko-KR');
      return;
    }

    output.textContent = '0';
    void output.offsetWidth;
    output.classList.add('is-counting');
    const startedAt = performance.now();
    const duration = 680;
    const step = (now) => {
      const progress = clamp((now - startedAt) / duration, 0, 1);
      const eased = 1 - ((1 - progress) ** 4);
      output.textContent = Math.round(target * eased).toLocaleString('ko-KR');
      if (progress < 1) {
        this.finalScoreAnimationFrame = requestAnimationFrame(step);
      } else {
        output.textContent = target.toLocaleString('ko-KR');
        output.classList.remove('is-counting');
        this.finalScoreAnimationFrame = 0;
      }
    };
    this.finalScoreAnimationFrame = requestAnimationFrame(step);
  }

  showResult({
    score, maxCombo, round, progress = 0, target = 1, catsCollected = 0,
    newRecord, previousBest, previousScore, recordEligible = true, resultMessage = '',
  }) {
    this.elements.playScreen.classList.remove('is-ending-to-result');
    this.elements.finalCombo.textContent = String(maxCombo);
    this.elements.finalRound.textContent = String(round);
    this.elements.resultKicker.textContent = '이번 판 기록';
    this.elements.resultStageProgress.textContent = `STAGE ${round} 도달 · 목표 ${progress} / ${target}`;
    this.elements.retryButton.textContent = resultRetryLabel({
      score,
      previousBest,
      newRecord,
      recordEligible,
      maxCombo,
      round,
    });
    this.elements.finalCats.textContent = String(catsCollected);
    this.elements.newRecord.hidden = !newRecord;
    this.elements.resultDecor.classList.toggle('is-record', newRecord);

    const resultTone = resultToneForScore(score);
    if (newRecord || resultTone === 'legend' || resultTone === 'high') this.setResultCharacter('success');
    else if (maxCombo >= 5 || round >= 5) this.setResultCharacter('cheer');
    else this.setResultCharacter('wave');

    const comparison = buildScoreComparisons(score, previousScore, previousBest);
    this.elements.resultBestCompare.textContent = recordEligible
      ? comparison.bestText
      : '연습 플레이 기록';
    this.elements.resultBestCompare.dataset.tone = recordEligible ? comparison.bestTone : 'neutral';
    this.elements.resultPreviousCompare.textContent = recordEligible
      ? comparison.previousText
      : '정식 기록은 STAGE 1부터 시작해';
    this.elements.resultPreviousCompare.dataset.tone = recordEligible ? comparison.previousTone : 'neutral';
    this.elements.resultPreviousCompare.hidden = recordEligible ? !comparison.hasPrevious : false;
    const recordProgress = !recordEligible
      ? 0
      : newRecord || previousBest <= 0
      ? 1
      : clamp(score / Math.max(1, previousBest), 0, 1);
    const recordPercent = Math.round(recordProgress * 100);
    this.elements.resultRecordMeterLabel.textContent = !recordEligible
      ? '연습 기록 · 최고기록 제외'
      : newRecord
      ? '새 최고기록 달성!'
      : `최고기록 도전 ${recordPercent}%`;
    this.elements.resultRecordMeter.style.setProperty('--record-progress', String(recordProgress));
    this.elements.resultRecordMeter.classList.remove('is-animating');

    const message = resultMessage || pickMessage(newRecord ? 'record' : 'resultNormal', this.lastResultMessage);
    this.lastResultMessage = message;
    this.elements.resultMessage.textContent = message;
    this.showScreen('result');
    if (newRecord) this.launchRecordCelebration();
    void this.elements.resultRecordMeter.offsetWidth;
    this.elements.resultRecordMeter.classList.add('is-animating');
    this.animateFinalScore(score);
    const screen = document.querySelector('#result-screen');
    screen.dataset.resultTone = newRecord ? 'record' : resultTone;
    screen.classList.remove('is-entering');
    void screen.offsetWidth;
    screen.classList.add('is-entering');
    setTimeout(() => screen.classList.remove('is-entering'), 680);
  }

  launchRecordCelebration() {
    const screen = document.querySelector('#result-screen');
    if (!screen) return;
    screen.querySelector('.record-confetti')?.remove();
    const confetti = document.createElement('div');
    confetti.className = 'record-confetti';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const count = reducedMotion ? 12 : 54;
    for (let index = 0; index < count; index += 1) {
      const piece = document.createElement('i');
      piece.style.setProperty('--confetti-x', `${6 + ((index * 37) % 89)}%`);
      piece.style.setProperty('--confetti-delay', `${(index % 12) * 34}ms`);
      piece.style.setProperty('--confetti-drift', `${((index * 29) % 100) - 50}px`);
      piece.style.setProperty('--confetti-spin', `${120 + (index % 7) * 55}deg`);
      piece.style.setProperty('--confetti-hue', String((index * 47) % 360));
      piece.dataset.shape = index % 6 === 0 ? 'star' : 'paper';
      confetti.appendChild(piece);
    }
    screen.appendChild(confetti);
    window.setTimeout(() => confetti.remove(), reducedMotion ? 1100 : 3200);
  }

  setOverlay(id, visible) {
    const overlay = document.querySelector(`#${id}`);
    if (!overlay) return;
    overlay.hidden = !visible;
  }

  setPauseReason(reason = 'manual') {
    const background = reason === 'background';
    const title = document.querySelector('#pause-title');
    const copy = document.querySelector('#pause-copy');
    if (title) title.textContent = background ? '게임을 멈춰뒀어' : '잠깐 쉬어가자';
    if (copy) copy.textContent = background ? '돌아오면 계속하기를 눌러달라냥' : '시간도 같이 멈췄어';
  }

  setRestartConfirm(confirming) {
    const button = document.querySelector('#restart-button');
    const label = button?.querySelector('span');
    if (!button || !label) return;
    button.classList.toggle('is-confirming', confirming);
    button.setAttribute('aria-label', confirming ? '게임 다시 시작 확인' : '게임 다시 하기');
    label.textContent = confirming ? '한 번 더' : '다시 시작';
  }

  updateToggle(button, enabled) {
    button.classList.toggle('is-on', enabled);
    button.textContent = enabled ? 'ON' : 'OFF';
    button.setAttribute('aria-pressed', String(enabled));
  }

  updateMusicControls(enabled, volume = 0.4) {
    const active = Boolean(enabled);
    const percent = Math.round(clamp(Number(volume) || 0, 0, 1) * 100);
    const settingsToggle = document.querySelector('#music-toggle');
    const quickToggles = [
      document.querySelector('#music-button'),
      document.querySelector('#hud-music-button'),
    ];
    const slider = document.querySelector('#music-volume');
    const label = document.querySelector('#music-volume-label');

    if (settingsToggle) this.updateToggle(settingsToggle, active);
    quickToggles.filter(Boolean).forEach((quickToggle) => {
      quickToggle.classList.toggle('is-on', active);
      quickToggle.setAttribute('aria-pressed', String(active));
      quickToggle.setAttribute('aria-label', active ? '배경음악 끄기' : '배경음악 켜기');
    });
    if (slider) slider.value = String(percent);
    if (label) label.textContent = percent > 0 ? `${percent}%` : 'OFF';
  }

  updateSoundControls(enabled) {
    const active = Boolean(enabled);
    const settingsToggle = document.querySelector('#sound-toggle');
    const quickToggle = document.querySelector('#sound-button');
    if (settingsToggle) this.updateToggle(settingsToggle, active);
    if (quickToggle) {
      quickToggle.classList.toggle('is-on', active);
      quickToggle.setAttribute('aria-pressed', String(active));
      quickToggle.setAttribute('aria-label', active ? '효과음 끄기' : '효과음 켜기');
    }
  }

  toast(message) {
    const toast = this.elements.toast;
    toast.textContent = message;
    toast.classList.remove('is-visible');
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), 1800);
  }
}
