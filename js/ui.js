import { cellsInRect } from './board.js';
import {
  BOARD_DROP_ITEMS,
  GARDEN_MILESTONES,
  buildScoreComparisons,
  classicChapterArtUrl,
  classicChapterThumbUrl,
  gardenProgress,
  isRecordInReach,
  isWowClear,
  isNiceClear,
  isItemUnlockedAtStage,
  pickMessage,
  resultRetryLabel,
  resultToneForScore,
} from './data.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Every tile is the same tile. There is no colour to assign, so nothing here
// assigns one — css/styles.css names the single art file.
//
// Colour used to be keyed off the value, which made it a half-working answer
// key: 4, 5, 6 and 8 each owned a hue outright, so the board leaked them at a
// glance, while 2, 7 and 9 shared one lilac, so the same glance was wrong as
// often as it was right. Keying it off the cell's position instead made a
// shortcut arithmetically impossible, and that part was right — but it still
// spread chroma over all forty-two cells, and a board you stare at for two
// minutes has nowhere to rest the eye. Every strength was wrong in one
// direction or the other: pale enough to be restful looked washed out, strong
// enough to look deliberate was tiring.
//
// One near-neutral tile ends the trade entirely. The charm is in the material
// rather than the hue: the syrup keeps its iridescent refraction, which reads
// at C* 8 without ever accumulating across the board. What used to be carried
// by tile colour is now carried by the moments that deserve it — selection,
// hint, success, combo — which are transient and local, and can be as saturated
// as they like.

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

// How much mist sits over the chapter art inside cleared cells: heavy while
// the board is still full of numbers to read, light once it is nearly empty.
const VEIL_FULL = 0.44;
const VEIL_CLEAR = 0.14;

// A url() inside a custom property is resolved against the stylesheet that
// consumes it, not the document, so a document-relative path handed to CSS
// from here would be looked up under css/. Resolve it to an absolute URL
// first and CSS has nothing left to re-resolve.
function cssUrl(path) {
  return `url("${new URL(path, document.baseURI).href}")`;
}

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
    this.hintTimer = null;
    this.roundReadyTimer = null;
    this.countdownPulseTimer = null;
    this.boardChangeFlashTimer = null;
    this.goalPulseTimer = null;
    this.itemRewardPreviewTimer = null;
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
      comboItemLabel: document.querySelector('#combo-item-label'),
      comboItemTrack: document.querySelector('#combo-item-track'),
      comboItemFill: document.querySelector('#combo-item-fill'),
      boardTimeGauge: document.querySelector('#board-time-gauge'),
      boardTimeFill: document.querySelector('#board-time-fill'),
      goal: document.querySelector('#goal-value'),
      goalLabel: document.querySelector('#goal-label'),
      roundMini: document.querySelector('.round-mini'),
      sumBubble: document.querySelector('#sum-bubble'),
      sum: document.querySelector('#sum-value'),
      marquee: document.querySelector('#selection-marquee'),
      tutorial: document.querySelector('#tutorial-guide'),
      tutorialCallout: document.querySelector('#tutorial-callout'),
      wowMoment: document.querySelector('#wow-moment'),
      catMessage: document.querySelector('#cat-message'),
      playCat: document.querySelector('#play-cat'),
      resultCat: document.querySelector('#result-cat'),
      resultDecor: document.querySelector('#result-decor'),
      roundClear: document.querySelector('#round-clear'),
      timeUp: document.querySelector('#time-up'),
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
      rankingBest: document.querySelector('#ranking-best-score'),
      rankingLast: document.querySelector('#ranking-last-score'),
      rankingAverage: document.querySelector('#ranking-average-score'),
      rankingCount: document.querySelector('#ranking-run-count'),
      rankingTrend: document.querySelector('#ranking-trend'),
      rankingBars: document.querySelector('#ranking-bars'),
      rankingEmpty: document.querySelector('#ranking-empty'),
      rankingCatsLine: document.querySelector('#ranking-cats-line'),
      rankingCatsTotal: document.querySelector('#ranking-cats-total'),
      homeGardenCount: document.querySelector('#home-garden-count'),
      gardenScene: document.querySelector('#garden-scene'),
      gardenCatsTotal: document.querySelector('#garden-cats-total'),
      gardenProgressLabel: document.querySelector('#garden-progress-label'),
      gardenProgressFill: document.querySelector('#garden-progress-fill'),
      gardenTiers: document.querySelector('#garden-tiers'),
      chapterGallery: document.querySelector('#chapter-gallery'),
      chapterGalleryNote: document.querySelector('#chapter-gallery-note'),
      chapterViewerTitle: document.querySelector('#chapter-viewer-title'),
      chapterViewerArt: document.querySelector('#chapter-viewer-art'),
      gardenRevealBest: document.querySelector('#garden-reveal-best'),
      gardenRevealBestValue: document.querySelector('#garden-reveal-best-value'),
      finalScore: document.querySelector('#final-score'),
      finalCombo: document.querySelector('#final-combo'),
      finalRound: document.querySelector('#final-round'),
      finalRoundLabel: document.querySelector('#final-round-label'),
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

  showScreen(name, { behind = null } = {}) {
    this.screens.forEach((screen) => {
      const active = screen.dataset.screen === name;
      const kept = behind && screen.dataset.screen === behind;
      screen.classList.toggle('is-active', active || Boolean(kept));
      screen.classList.toggle('is-behind-sheet', Boolean(kept));
      screen.setAttribute('aria-hidden', String(!active));
    });
    document.querySelector('#result-screen')?.classList.toggle('is-sheet', name === 'result' && Boolean(behind));
  }

  async animateStartCountdown(steps, onStep = () => {}, { compact = false } = {}) {
    const token = ++this.startCountdownToken;
    const overlay = this.elements.startCountdown;
    overlay.classList.remove('is-visible', 'is-go', 'is-leaving');
    overlay.setAttribute('aria-hidden', 'false');
    void overlay.offsetWidth;
    overlay.classList.add('is-visible');

    for (const step of steps) {
      if (token !== this.startCountdownToken) return false;
      const isGo = step === 'GO!';
      this.elements.startCountdownKicker.textContent = isGo ? '합이 10이면' : '준비!';
      this.elements.startCountdownValue.textContent = isGo ? 'GO!' : String(step);
      overlay.classList.toggle('is-go', isGo);
      overlay.dataset.step = String(step);
      this.elements.startCountdownValue.classList.remove('is-popping');
      void this.elements.startCountdownValue.offsetWidth;
      this.elements.startCountdownValue.classList.add('is-popping');
      onStep(step);
      // The original OING holds each digit for 650ms and GO! for 500ms —
      // long enough for the bloom to overshoot and settle before the next
      // beat lands. Ours ran at 420/500 and read as a stutter.
      await delay(compact ? (isGo ? 380 : 420) : (isGo ? 500 : 650));
    }

    if (token !== this.startCountdownToken) return false;
    overlay.classList.add('is-leaving');
    await delay(compact ? 110 : 150);
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
    this.boardFrame.dataset.cols = String(cols);
    this.boardFrame.dataset.rows = String(rows);
    this.elements.playScreen.classList.toggle('is-tall-board', rows > cols);
    // The deepest ladder steps (8 and 9 rows) need more height than the tall
    // board's chrome trim frees up, so they get their own tighter tier.
    this.elements.playScreen.dataset.boardRows = String(rows);
    this.board.style.setProperty('--board-cols', cols);
    this.board.style.setProperty('--board-rows', rows);
    this.boardFrame.style.setProperty('--board-cols', cols);
    this.boardFrame.style.setProperty('--board-rows', rows);
    this.elements.playScreen.style.setProperty('--board-cols', cols);
    this.elements.playScreen.style.setProperty('--board-rows', rows);
    const fragment = document.createDocumentFragment();
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const value = model.valueAt(r, c);
        const boardItem = boardItems.get(`${r}:${c}`);
        const bonusCat = model.hasBonusCat?.(r, c) || false;
        const special = model.specialAt?.(r, c) || null;
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.tabIndex = -1;
        tile.className = boardItem
          ? `tile is-empty is-board-item board-item-${boardItem.type}${boardItem.showcase ? ' is-showcase-item' : ''}`
          : bonusCat
            ? 'tile is-bonus-cat'
            : `tile${value ? ` value-${value}` : ' is-empty'}${special ? ` is-special-tile special-${special}` : ''}`;
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
          // The bomb is the only special tile the board can produce; the
          // clock version was retired with its stage chance and placement.
          const specialLabel = special === 'bomb' ? ', 폭탄 타일' : '';
          tile.setAttribute('aria-label', value ? `${value}${specialLabel}` : '빈칸');
          if (value) {
            const number = document.createElement('span');
            number.textContent = String(value);
            tile.appendChild(number);
            if (special) {
              tile.dataset.special = special;
              const badge = document.createElement('img');
              badge.className = 'special-tile-badge';
              badge.src = 'assets/icons/items/bomb.webp';
              badge.alt = '';
              const actionLabel = document.createElement('small');
              actionLabel.className = 'special-tile-label';
              actionLabel.textContent = '펑!';
              tile.append(badge, actionLabel);
            }
          }
        }
        fragment.appendChild(tile);
      }
    }
    this.board.replaceChildren(fragment);
    this.clearSelection();
    requestAnimationFrame(() => this.syncChapterWindows());
    if (!this.chapterWindowResizeBound) {
      this.chapterWindowResizeBound = true;
      window.addEventListener('resize', () => this.syncChapterWindows());
    }
  }

  // Cleared cells paint the chapter art themselves: each tile gets the
  // board-sized painting offset to its own cell, so adjacent cleared cells
  // line up into one continuous picture while the sealed bed keeps it out of
  // the gutters. Measured from offsetLeft/Top - layout coordinates - so the
  // flip animations' transforms cannot skew the sample points. Every tile is
  // measured up front because cells go empty later without a re-render.
  syncChapterWindows() {
    const board = this.board;
    if (!board || !board.offsetWidth) return;
    // Cover-fit at the painting's own 1086x1448 ratio. Stretching the image
    // to the board box squashed every scene on boards that are not 3:4 -
    // visibly so on the square openers.
    const ART_W = 1086;
    const ART_H = 1448;
    const bw = board.offsetWidth;
    const bh = board.offsetHeight;
    const scale = Math.max(bw / ART_W, bh / ART_H);
    const coverW = ART_W * scale;
    const coverH = ART_H * scale;
    const originX = (bw - coverW) / 2;
    const originY = (bh - coverH) / 2;
    board.style.setProperty('--win-size', `${coverW}px ${coverH}px`);
    const tiles = board.querySelectorAll('.tile');
    tiles.forEach((tile) => {
      tile.style.setProperty('--win-pos', `${originX - tile.offsetLeft}px ${originY - tile.offsetTop}px`);
    });
    this.syncChapterVeil(tiles);
  }

  // The mist thins as the board empties, so a scene develops rather than
  // arriving. Written as two variables on the board itself - one style write
  // per render, inherited by the cells - rather than per-tile, and as plain
  // gradient alpha rather than a filter, so nothing here adds a composited
  // layer or a per-frame cost.
  syncChapterVeil(tiles = this.board?.querySelectorAll('.tile')) {
    const board = this.board;
    if (!board || !tiles?.length) return;
    let playable = 0;
    let cleared = 0;
    tiles.forEach((tile) => {
      if (tile.classList.contains('is-board-item') || tile.classList.contains('is-bonus-cat')) return;
      playable += 1;
      if (tile.classList.contains('is-empty')) cleared += 1;
    });
    const ratio = playable ? cleared / playable : 0;
    const veil = VEIL_FULL + (VEIL_CLEAR - VEIL_FULL) * ratio;
    board.style.setProperty('--win-veil', veil.toFixed(3));
    board.style.setProperty('--win-veil-b', (veil - 0.06).toFixed(3));
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
    const counter = this.elements.goal;
    if (!counter) return;
    clearTimeout(this.goalPulseTimer);
    counter.dataset.level = combo >= 8 ? '8' : combo >= 5 ? '5' : combo >= 3 ? '3' : '1';
    counter.classList.remove('is-rewarded');
    void counter.offsetWidth;
    counter.classList.add('is-rewarded');
    this.goalPulseTimer = window.setTimeout(() => {
      counter.classList.remove('is-rewarded');
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

  showComboLoss(amount) {
    const loss = Math.max(1, Math.round(Number(amount) || 1));
    clearTimeout(this.comboLossTimer);
    this.elements.playScreen.querySelector('.combo-loss-pop')?.remove();
    const pop = document.createElement('div');
    pop.className = 'combo-loss-pop';
    pop.textContent = `−${loss}`;
    this.elements.comboChip.appendChild(pop);
    this.elements.comboChip.classList.add('is-inline-feedback');
    this.comboLossTimer = window.setTimeout(() => {
      pop.remove();
      this.elements.comboChip.classList.remove('is-inline-feedback');
    }, 720);
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
    // The live sum bubble belongs to the drag phase. Once the pointer is
    // released, use one decisive confirmation instead of showing both
    // "합 10!" and "딱 10!" over the same selection.
    this.elements.sumBubble.classList.remove('is-visible', 'is-ten');
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
      .filter((tile) => tile && !tile.dataset.item && !tile.classList.contains('is-empty'));
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
    this.hintTimer = setTimeout(() => this.clearHint(), 2200);
  }

  // Once the hinted answer is actually played the hint has done its job, so
  // the board must come back instantly. Waiting out the 2.2s display timer
  // left the veil and the region sitting over the next move.
  clearHint() {
    clearTimeout(this.hintTimer);
    this.hintTimer = null;
    this.board.querySelectorAll('.tile.is-hint').forEach((tile) => {
      tile.classList.remove('is-hint');
      tile.style.removeProperty('--hint-index');
    });
    this.board.classList.remove('is-hinting');
    this.boardFrame.querySelector('.hint-region')?.remove();
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
    this.elements.comboChip.classList.remove('is-inline-feedback');
    this.elements.playScreen.classList.remove('is-board-growth-clear', 'is-time-rescued', 'is-low-time-alerting');
  }

  setShuffleVectors() {
    // The flip animation needs only a per-tile delay. Staggering by
    // (row + col) sends one diagonal wave across the board, so the shuffle
    // reads as a sweep of cards turning over rather than 42 separate pops.
    const cols = Number(this.board.dataset.cols) || Number(this.board.dataset.size) || 4;
    const rows = Number(this.board.dataset.rows) || cols;
    const span = Math.max(1, cols + rows - 2);
    this.board.querySelectorAll('.tile').forEach((tile) => {
      const row = Number(tile.dataset.row) || 0;
      const col = Number(tile.dataset.col) || 0;
      tile.style.setProperty('--shuffle-delay', `${Math.round(((row + col) / span) * 200)}ms`);
    });
  }

  // Transition cleanup: when a stage ends with tiles left (the tens ran
  // out), the leftovers pop away as part of the stage transition — a
  // different rhythm from the success animation on purpose.
  async animateSweep(cells = []) {
    const tiles = cells
      .map(({ r, c }) => this.tileAt(r, c))
      .filter(Boolean);
    tiles.forEach((tile, index) => {
      tile.style.setProperty('--sweep-delay', `${index * 30}ms`);
      tile.classList.add('is-sweeping');
    });
    await delay(240 + cells.length * 30);
  }

  // The full-clear payoff: the board is empty, so the garden art beneath it
  // is completely visible for the first time. Hold on it briefly — long
  // enough to register as a reward, short enough not to stall the run.
  async celebrateFullGarden({ perfect = false } = {}) {
    this.boardFrame.classList.add('is-garden-complete');
    this.boardFrame.classList.toggle('is-garden-perfect', perfect);
    await delay(perfect ? 780 : 620);
    this.boardFrame.classList.remove('is-garden-complete', 'is-garden-perfect');
  }

  async animateShuffleOut() {
    this.setShuffleVectors();
    this.boardFrame.querySelector('.shuffle-fx')?.remove();
    const effect = document.createElement('div');
    effect.className = 'shuffle-fx';
    this.boardFrame.appendChild(effect);
    this.board.classList.add('is-shuffling-out');
    await delay(400);
    this.board.classList.remove('is-shuffling-out');
  }

  async animateShuffleIn() {
    this.setShuffleVectors();
    this.board.classList.add('is-shuffling-in');
    await delay(480);
    this.board.classList.remove('is-shuffling-in');
    this.boardFrame.classList.remove('is-shuffle-settled');
    void this.boardFrame.offsetWidth;
    this.boardFrame.classList.add('is-shuffle-settled');
    this.board.querySelectorAll('.tile').forEach((tile) => {
      tile.style.removeProperty('--shuffle-delay');
    });
    this.boardFrame.querySelector('.shuffle-fx')?.remove();
    window.setTimeout(() => this.boardFrame.classList.remove('is-shuffle-settled'), 260);
    // The board may have morphed to a new ladder size during the swap; the
    // windows resample once the layout has settled.
    this.syncChapterWindows();
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
      effect.append(icon, document.createElement('i'), document.createElement('i'), document.createElement('i'));
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
      setTimeout(() => {
        tile.classList.remove('is-item-spawning');
        flight.remove();
      }, 1420 + index * 80);
    });
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
    // Text only: the icon asset has an opaque square background, which is
    // what flew across the screen as a clipped box.
    const label = document.createElement('strong');
    label.textContent = `+${seconds}초`;
    flight.append(label);
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
      .filter((tile) => tile && !tile.dataset.item && !tile.classList.contains('is-empty'));
    tiles.forEach((tile) => tile.classList.add('is-clover-hint'));
    setTimeout(() => tiles.forEach((tile) => tile.classList.remove('is-clover-hint')), 4500);
  }

  showItemScoreBurst(points, rect, kind) {
    const bounds = this.selectionBounds(rect);
    const burst = this.elements.scoreBurst;
    const primary = document.createElement('strong');
    primary.textContent = `+${points}`;
    // No label: the blast that just played said "bomb" far louder than a
    // caption can, and the caption sat right on top of the bomb tile.
    burst.replaceChildren(primary);
    burst.dataset.level = '1';
    burst.dataset.item = kind;
    if (bounds) {
      burst.style.left = `${(bounds.left + bounds.right) / 2}px`;
      // Lifted above the blast so the number and the bomb never overlap.
      burst.style.top = `${Math.max(18, (bounds.top + bounds.bottom) / 2 - 42)}px`;
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

  showScoreBurst(points, rect, dimensions, combo, cellCount, { nice = false } = {}) {
    const bounds = this.selectionBounds(rect);
    const burst = this.elements.scoreBurst;
    const primary = document.createElement('strong');
    primary.textContent = `+${points}`;
    // The original OING's entire score readout is "+48 ×7", and that is all a
    // clear needs to say: the total already contains every bonus, and each
    // bonus announces itself elsewhere (the cat pop, the bomb blast, the
    // mission chip, the cat's line). Naming them here as well stacked up to
    // seven different labels onto one pop and turned a reward into homework.
    // Just the number. The combo already lives in the HUD, one glance away.
    // NICE rides on the score pop rather than owning the screen: a four-cell
    // clear gets a small tag next to its own number, right where the clear
    // happened. WOW keeps the centred card and the fanfare to itself.
    const showNice = nice && isNiceClear(cellCount);
    if (showNice) {
      const tag = document.createElement('em');
      tag.textContent = 'NICE!';
      burst.replaceChildren(primary, tag);
    } else {
      burst.replaceChildren(primary);
    }
    burst.dataset.level = combo >= 8 ? '8' : combo >= 5 ? '5' : combo >= 3 ? '3' : '1';
    burst.dataset.wide = String(isWowClear(cellCount));
    if (showNice) burst.dataset.nice = 'true';
    else delete burst.dataset.nice;
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
      delete burst.dataset.nice;
    }, 900);
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

  // `milestone` is whatever comboMilestoneCrossed(previousCombo, combo)
  // returned for this success — the caller decides whether one was crossed,
  // this method only ever renders that answer. It used to recompute its own
  // "did combo land exactly on 3/5/8/multiple-of-8" check, which disagreed
  // with the rank calculation's crossing check (e.g. 15 -> 17 skips 16 by
  // landing but still crosses it), so a banner could fire at the same time
  // successFeedbackLevel had already decided this was a plain clear.
  // Five-plus cells in one clear. The original stops the screen for this and
  // nothing else, which is exactly what makes hunting a big rectangle worth
  // the extra seconds of looking.
  showWowMoment() {
    const wow = this.elements.wowMoment;
    if (!wow) return;
    clearTimeout(this.wowMomentTimer);
    wow.classList.remove('is-visible');
    void wow.offsetWidth;
    wow.classList.add('is-visible');
    this.wowMomentTimer = window.setTimeout(() => wow.classList.remove('is-visible'), 940);
  }

  showComboMoment(combo, { allowCelebration = true, milestone = 0 } = {}) {
    // The chip carries every step of the climb — it punches on each combo and
    // its band keeps rising past 8, so the escalation lives in the HUD rather
    // than in another card over the board.
    const level = combo >= 16 ? '16' : combo >= 8 ? '8' : combo >= 5 ? '5' : combo >= 3 ? '3' : '';
    this.elements.comboChip.dataset.level = level;
    this.elements.comboChip.classList.remove('is-punching');
    void this.elements.comboChip.offsetWidth;
    this.elements.comboChip.classList.add('is-punching');
    setTimeout(() => this.elements.comboChip.classList.remove('is-punching'), 520);

    if (!milestone || !allowCelebration) return;

    // The original's entire milestone celebration is one small line of
    // floating text over the board — no card, no confetti, nothing that has
    // to be dismissed or that can double up with the HUD chip.
    this.elements.playScreen.querySelector('.combo-text-pop')?.remove();
    const pop = document.createElement('div');
    pop.className = 'combo-text-pop';
    pop.textContent = `${combo} combo \uD83D\uDD25`;
    this.elements.playScreen.appendChild(pop);
    setTimeout(() => pop.remove(), 1200);
  }

  showStageTimeBonus(seconds = 0) {
    const amount = Math.max(0, Math.round(Number(seconds) || 0));
    if (!amount || !this.elements.boardTimeGauge) return;
    // The gain shows on the surface that represents time, rather than as a
    // pill floating over the HUD where it covered the clock and the tally.
    const gauge = this.elements.boardTimeGauge;
    clearTimeout(this.timeBonusTimer);
    gauge.dataset.bonus = `+${amount}초`;
    gauge.classList.remove('is-bonus');
    void gauge.offsetWidth;
    gauge.classList.add('is-bonus');
    this.timeBonusTimer = window.setTimeout(() => {
      gauge.classList.remove('is-bonus');
      delete gauge.dataset.bonus;
    }, 1100);
  }

  showRoundClear({
    scoreBonus = 0,
    timeBonus = 0,
    stage = 1,
    nextStage = stage + 1,
    rows = 0,
    cols = 0,
    perfect = false,
    boardGrew = false,
  } = {}) {
    const clear = this.elements.roundClear;
    const label = clear.querySelector('strong');
    // One line of text is the whole card, like the original's board-change
    // pop. PERFECT — a board emptied without one rescue shuffle — earns the
    // word itself; everything else stays the plain clear.
    if (label) label.textContent = perfect ? `STAGE ${stage} PERFECT!` : `STAGE ${stage} CLEAR!`;
    clear.dataset.perfect = perfect ? '1' : '0';
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
    const screen = this.elements.playScreen.getBoundingClientRect();
    // Centred over the time gauge — the surface that actually shows the
    // gain — instead of under the timer pill, where it was clipped by the
    // HUD art and covered whatever sat beneath it.
    const gauge = this.elements.boardTimeGauge?.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.className = 'stage-time-bonus';
    pop.textContent = `+${amount}초`;
    pop.style.left = `${gauge ? gauge.left + gauge.width / 2 - screen.left : screen.width / 2}px`;
    pop.style.top = `${gauge ? gauge.top - screen.top - 6 : 120}px`;
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
    const previousTileWidth = this.board.querySelector('.tile')?.getBoundingClientRect().width || 0;
    this.boardFrame.classList.add('is-round-leaving');
    await delay(140);
    swapBoard();
    this.boardFrame.classList.remove('is-round-leaving');
    // When the ladder grows an axis the tiles drop a size in one frame,
    // which read as the board being replaced rather than growing. Arriving
    // scaled so the new tiles start at the old tile size, then settling to
    // 1, keeps it one continuous board. Measured from real widths so the
    // same code handles every step (and does nothing when size is equal).
    const nextTileWidth = this.board.querySelector('.tile')?.getBoundingClientRect().width || 0;
    clearTimeout(this.sizeMorphTimer);
    this.boardFrame.classList.remove('is-size-morphing');
    if (previousTileWidth && nextTileWidth && Math.abs(previousTileWidth - nextTileWidth) > 1.5) {
      const scale = clamp(previousTileWidth / nextTileWidth, 0.6, 1.6);
      this.boardFrame.style.setProperty('--arrive-scale', String(Math.round(scale * 1000) / 1000));
      void this.boardFrame.offsetWidth;
      this.boardFrame.classList.add('is-size-morphing');
      this.sizeMorphTimer = window.setTimeout(() => {
        this.boardFrame.classList.remove('is-size-morphing');
      }, 680);
    }
    this.elements.roundMini.classList.remove('is-advancing');
    void this.elements.roundMini.offsetWidth;
    this.elements.roundMini.classList.add('is-advancing');
    this.boardFrame.classList.add('is-round-arriving');
    // One line of plain glowing text, like the original's board-change pop.
    const entry = document.createElement('div');
    entry.className = 'stage-entry';
    const title = document.createElement('strong');
    title.textContent = intro.title || `STAGE ${nextRound}`;
    entry.classList.toggle('is-milestone', Boolean(intro.boardGrew));
    entry.append(title);
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

  async animateGameEnd({ answers = [] } = {}) {
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
    await delay(780);
    timeUp.classList.remove('is-visible');
    sweep.remove();
    // The score is about to be the sheet's headline, so it is not announced
    // twice; the missed answers stay lit underneath it.
    this.boardFrame.classList.remove('is-game-ending');
    await delay(140);
  }

  setPlayCharacter(pose, duration = 0) {
    const next = CHARACTER_ASSETS[pose] ? pose : 'wave';
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
      if (duration > 0 && next !== 'wave') {
        this.characterTimer = setTimeout(() => {
          if (token === this.characterToken) this.setPlayCharacter('wave');
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
    bubble.classList.remove('is-changing', 'is-long');
    bubble.classList.toggle('is-long', String(message).length >= 18);
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

  updateHUD({ round, score, timeLeft, duration = 0, timed = duration > 0, freezeRemaining = 0, combo, comboRemainingMs = 0, comboWindowMs = 1, rewardRemaining = 7, successCount = 0, gardenFromStart = false, bestScore = 0 }) {
    this.elements.round.textContent = String(round);
    const scoreText = score.toLocaleString('ko-KR');
    this.elements.score.textContent = scoreText;
    // The painted score pill has ~50px of room after the coin and the 점수
    // label; a five-figure score at full size ellipsised to "21,4…" mid-game.
    // The digits shrink one step per length band instead, so the full number
    // always reads.
    this.elements.score.dataset.digits = scoreText.length > 9 ? 'xl'
      : scoreText.length > 6 ? 'l'
        : 'm';
    const time = Math.max(0, Math.ceil(timeLeft));
    this.elements.timePill.hidden = !timed;
    this.elements.playScreen.classList.toggle('is-untimed', !timed);
    this.elements.time.textContent = timed
      ? `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`
      : '';
    this.elements.timePill.style.setProperty('--time-progress', String(timed ? clamp(timeLeft / Math.max(1, duration), 0, 1) : 1));
    const isFrozen = freezeRemaining > 0;
    // The gauge above the numbers: remaining time as a shrinking bar in the
    // original's green-to-lemon-to-orange language, readable in peripheral
    // vision while the eyes stay on the board. The original switched on
    // remaining *percentage* (40% and 15%), not absolute seconds, so a time
    // bonus widens the green stretch instead of skipping past a band.
    if (this.elements.boardTimeGauge) {
      this.elements.boardTimeGauge.hidden = !timed;
      if (timed) {
        const remaining = clamp(timeLeft / Math.max(1, duration), 0, 1);
        this.elements.boardTimeFill.style.transform = `scaleX(${remaining})`;
        this.elements.boardTimeGauge.dataset.band = isFrozen ? 'frozen'
          : remaining <= 0.15 ? 'low'
            : remaining <= 0.4 ? 'mid'
              : 'high';
      }
    }
    this.elements.timePill.classList.toggle('is-low-time', timed && !isFrozen && time > 10 && time <= 30);
    this.elements.timePill.classList.toggle('is-warning', timed && !isFrozen && time <= 10);
    this.elements.timePill.dataset.freezeRemaining = String(Math.ceil(freezeRemaining));
    const isFinalCountdown = timed && !isFrozen && time > 0 && time <= 10;
    this.elements.playScreen.classList.toggle('is-final-countdown', isFinalCountdown);
    this.elements.playScreen.dataset.round = String(round);
    // The warmup band hides the hidden-garden art; classic runs skip it so
    // the picture peeks through from the very first cleared cell.
    this.elements.playScreen.dataset.stageBand = round >= 8 ? 'fever'
      : round >= 5 ? 'wide'
        : round >= 3 || gardenFromStart ? 'rising'
          : 'warmup';
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
    // The centre compartment's gauge. The track is always on screen — it is
    // half of what makes the compartment look furnished, and hiding it for
    // the first two stages left an empty box exactly where new players
    // look first. Only the "아이템까지 N" caption waits for stage 3, when
    // item drops actually unlock and the number means something.
    if (this.elements.comboItemTrack) {
      const comboCycle = combo === 0 ? 0 : comboStep === 0 ? 1 : comboStep / 7;
      this.elements.comboItemFill.style.width = `${Math.round(comboCycle * 100)}%`;
      this.elements.comboItemLabel.hidden = !rewardUnlocked;
      if (rewardUnlocked) this.elements.comboItemLabel.textContent = `아이템까지 ${rewardRemaining}`;
    }
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
    // Classic multipliers keep climbing long after the fever band tops out,
    // so the board carries a second, coarser tier keyed to the figures that
    // actually matter there: the score cap and the two steps past it.
    this.boardFrame.dataset.comboTier = combo >= 60 ? '60' : combo >= 40 ? '40' : combo >= 25 ? '25' : '';
    this.boardFrame.classList.toggle('is-fever', combo >= 8);
    // The third compartment used to count answers found, which never changed
    // a decision — it only ever went up. In a score attack the figure worth
    // carrying there is the record being chased, and once the run passes it
    // the slot flips into a live "you are ahead" readout.
    const best = Math.max(0, Math.round(Number(bestScore) || 0));
    const ahead = best > 0 && score > best;
    const goalText = (ahead ? score : best).toLocaleString('ko-KR');
    this.elements.goal.textContent = goalText;
    if (this.elements.goalLabel) this.elements.goalLabel.textContent = ahead ? '신기록' : '최고';
    this.elements.goal.closest('.goal-status')?.classList.toggle('is-ahead', ahead);
    // Same length-band pattern as the score figure: the counter box is narrow
    // and the text is nowrap-centred, so long values shrink one step.
    this.elements.goal.dataset.digits = goalText.length > 3 ? 'l' : 'm';
  }

  updateItems({ hint, shuffle, bomb, clock, stage = 1, clockAvailable = true }) {
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
    const markItem = (button, count, locked = false, lockCopy = '잠금', unlocked = false) => {
      if (!button) return;
      if (count > 0) button.dataset.everHeld = '1';
      const everHeld = button.dataset.everHeld === '1';
      const empty = count <= 0;
      const stageLocked = locked || (empty && !everHeld && !unlocked);
      const depleted = empty && !stageLocked;
      button.classList.toggle('is-depleted', depleted);
      button.classList.toggle('is-stage-locked', stageLocked);
      button.dataset.state = stageLocked ? 'locked' : depleted ? 'depleted' : 'available';
      button.dataset.lockCopy = lockCopy;
    };
    markItem(this.elements.hintButton, hint, false, '잠금', true);
    markItem(this.elements.shuffleButton, shuffle, false, '잠금', true);
    const bombUnlocked = isItemUnlockedAtStage('bomb', stage);
    const clockUnlocked = isItemUnlockedAtStage('clock', stage) && clockAvailable;
    markItem(this.elements.bombButton, bomb, !bombUnlocked, '', bombUnlocked);
    markItem(this.elements.clockButton, clock, !clockUnlocked, '', clockUnlocked);
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

  // Which scene of 고양이의 모험 is painted behind the board. The art itself
  // lives in CSS (one rule per chapter) so a missing file falls back to the
  // original garden painting instead of leaving a blank frame.
  setChapter(key, artUrl = null) {
    const screen = this.elements.playScreen;
    if (key) screen.dataset.chapter = key;
    else delete screen.dataset.chapter;
    if (artUrl) screen.style.setProperty('--chapter-art', cssUrl(artUrl));
    else screen.style.removeProperty('--chapter-art');
  }

  updateCatsRescued(total = 0) {
    const count = Math.max(0, Math.round(Number(total) || 0));
    const formatted = count.toLocaleString('ko-KR');
    if (this.elements.rankingCatsLine && this.elements.rankingCatsTotal) {
      this.elements.rankingCatsTotal.textContent = formatted;
      this.elements.rankingCatsLine.hidden = count <= 0;
    }
    if (this.elements.homeGardenCount) {
      this.elements.homeGardenCount.textContent = `고양이 ${formatted}마리`;
    }
  }

  renderGarden(total = 0, cleanClears = 0) {
    const cleared = Math.max(0, Math.round(Number(cleanClears) || 0));
    if (this.elements.gardenRevealBest && this.elements.gardenRevealBestValue) {
      this.elements.gardenRevealBestValue.textContent = cleared.toLocaleString('ko-KR');
      this.elements.gardenRevealBest.hidden = cleared <= 0;
    }
    const state = gardenProgress(total);
    if (this.elements.gardenCatsTotal) {
      this.elements.gardenCatsTotal.textContent = state.cats.toLocaleString('ko-KR');
    }
    if (this.elements.gardenProgressLabel) {
      this.elements.gardenProgressLabel.textContent = state.complete
        ? '정원을 모두 채웠다냥!'
        : `${state.next.label}까지 ${state.remaining.toLocaleString('ko-KR')}마리`;
    }
    if (this.elements.gardenProgressFill) {
      this.elements.gardenProgressFill.style.width = `${Math.round(state.progress * 100)}%`;
    }
    if (this.elements.gardenScene) {
      // Unlocked decorations are the garden itself filling in. Positions are
      // fixed per tier so a returning player finds the same garden, with the
      // newest friend arriving in an empty spot rather than reshuffling.
      this.elements.gardenScene.querySelectorAll('.garden-decor').forEach((decor) => decor.remove());
      GARDEN_MILESTONES.forEach((milestone, index) => {
        if (!state.unlocked.includes(milestone.id)) return;
        const decor = document.createElement('img');
        decor.className = `garden-decor garden-decor-${milestone.id}`;
        decor.dataset.slot = String(index);
        decor.src = milestone.asset;
        decor.alt = '';
        this.elements.gardenScene.appendChild(decor);
      });
      this.elements.gardenScene.dataset.tier = String(state.unlocked.length);
    }
    if (this.elements.gardenTiers) {
      const tiers = GARDEN_MILESTONES.map((milestone) => {
        const unlocked = state.unlocked.includes(milestone.id);
        const item = document.createElement('li');
        item.className = 'garden-tier';
        item.classList.toggle('is-unlocked', unlocked);
        const icon = document.createElement('img');
        icon.src = milestone.asset;
        icon.alt = '';
        const label = document.createElement('span');
        label.textContent = milestone.label;
        const requirement = document.createElement('b');
        requirement.textContent = unlocked ? '완료' : `${milestone.cats}마리`;
        item.append(icon, label, requirement);
        item.setAttribute('aria-label', unlocked
          ? `${milestone.label} 해금 완료`
          : `${milestone.label} 잠김, 고양이 ${milestone.cats}마리 필요`);
        return item;
      });
      this.elements.gardenTiers.replaceChildren(...tiers);
    }
  }

  // The adventure gallery: every scene the run can travel to, with the ones
  // still ahead shown as silhouettes so there is something to aim at. Art is
  // applied by CSS class, so scenes without a file yet render as a plain
  // locked card rather than a broken image.
  // Held between the old board fading out and the new one landing: the
  // tiles are already gone, so the chapter art behind them is briefly the
  // whole screen. One card names the scene, then play resumes.
  // 판갈이 is the loop's only lifeline, so it gets a real beat: the frame
  // flashes and kicks once as the seconds land.
  flashBoardChange() {
    this.boardFrame.classList.remove('is-board-change');
    void this.boardFrame.offsetWidth;
    this.boardFrame.classList.add('is-board-change');
    clearTimeout(this.boardChangeFlashTimer);
    this.boardChangeFlashTimer = window.setTimeout(() => {
      this.boardFrame.classList.remove('is-board-change');
    }, 620);
  }

  renderChapterGallery(chapters = []) {
    if (!this.elements.chapterGallery) return;
    const list = Array.isArray(chapters) ? chapters : [];
    const cards = list.map((chapter) => {
      const item = document.createElement('li');
      item.className = 'chapter-card';
      item.dataset.chapter = chapter.key;
      item.classList.toggle('is-unlocked', Boolean(chapter.unlocked));
      item.classList.toggle('is-secret', Boolean(chapter.secret));
      // A locked card still paints its scene, blurred and drained by CSS, so
      // the album reads as pictures waiting to be earned rather than a list of
      // empty slots. Chapters whose art has not shipped get no thumb at all
      // and fall back to the placeholder wash.
      const thumb = classicChapterThumbUrl(chapter);
      item.classList.toggle('has-art', Boolean(thumb));
      if (thumb) item.style.setProperty('--chapter-thumb', cssUrl(thumb));
      const label = document.createElement('strong');
      label.textContent = chapter.unlocked ? chapter.label : '???';
      const requirement = document.createElement('span');
      requirement.textContent = chapter.unlocked ? '수집 완료' : chapter.requirement;
      item.append(label, requirement);
      item.setAttribute('aria-label', chapter.unlocked
        ? `${chapter.label} 수집 완료`
        : `잠긴 장면, ${chapter.requirement} 필요`);
      if (chapter.unlocked && classicChapterArtUrl(chapter)) {
        item.setAttribute('role', 'button');
        item.tabIndex = 0;
        item.addEventListener('click', () => this.openChapterViewer(chapter));
        item.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.openChapterViewer(chapter);
          }
        });
      }
      return item;
    });
    this.elements.chapterGallery.replaceChildren(...cards);
    if (this.elements.chapterGalleryNote) {
      const found = list.filter((chapter) => chapter.unlocked).length;
      this.elements.chapterGalleryNote.textContent = list.length
        ? `장면 ${found}/${list.length} 수집`
        : '';
    }
  }

  // The album card is a thumbnail; tapping an earned scene opens the real
  // painting. Locked cards stay inert - the blur is the tease.
  openChapterViewer(chapter) {
    const art = classicChapterArtUrl(chapter);
    if (!art) return;
    if (this.elements.chapterViewerTitle) this.elements.chapterViewerTitle.textContent = chapter.label;
    if (this.elements.chapterViewerArt) this.elements.chapterViewerArt.src = art;
    this.setOverlay('chapter-viewer', true);
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
    score, maxCombo, round, successCount = 0, catsCollected = 0,
    catsRescuedTotal = 0, cleanClears = 0, cleanClearsTotal = 0,
    newRecord, previousBest, previousScore, recordEligible = true, resultMessage = '',
    classic = null,
  }) {
    this.elements.playScreen.classList.remove('is-ending-to-result');
    this.elements.finalCombo.textContent = String(maxCombo);
    this.elements.finalRound.textContent = String(round);
    // Classic reads its own sheet: the round figure is boards survived, and
    // the kicker names the mode so the score's smaller scale isn't read
    // against stage-mode records.
    if (this.elements.finalRoundLabel) {
      this.elements.finalRoundLabel.textContent = classic ? '판갈이 수' : '도달 스테이지';
    }
    this.elements.resultKicker.textContent = '이번 판 기록';
    this.elements.resultStageProgress.textContent = classic
      ? `${classic.boards}판 진행 · 성공 ${successCount}회`
      : `STAGE ${round} 도달 · 성공 ${successCount}회`;
    this.elements.retryButton.textContent = classic ? '한 판 더!' : resultRetryLabel({
      score,
      previousBest,
      newRecord,
      recordEligible,
      maxCombo,
      round,
    });
    // Rescued-cat counts live in the garden screen, which is where they
    // actually accumulate; the sheet keeps to the run's own headline.
    this.elements.newRecord.hidden = !newRecord;
    this.elements.resultDecor.classList.toggle('is-record', newRecord);

    const resultTone = resultToneForScore(score);
    if (newRecord || resultTone === 'legend' || resultTone === 'high') this.setResultCharacter('success');
    else if (maxCombo >= 5 || round >= 5) this.setResultCharacter('cheer');
    else this.setResultCharacter('wave');

    // One comparison, not two stacked. The card used to print the best-score
    // line and the last-run line together, so an ordinary result said two
    // similar things at once and neither led. This picks the single most
    // meaningful reading of the run and shows only that.
    const comparison = buildScoreComparisons(score, previousScore, previousBest);
    const chasingRecord = recordEligible && !newRecord && isRecordInReach(score, previousBest);
    const beatLastRun = recordEligible && comparison.hasPrevious && comparison.previousTone === 'up';
    const headline = !recordEligible
      ? { text: '연습 플레이 기록 · 최고기록에는 반영되지 않아', tone: 'neutral' }
      : newRecord || chasingRecord || !beatLastRun
        ? { text: comparison.bestText, tone: comparison.bestTone }
        : { text: comparison.previousText, tone: comparison.previousTone };
    this.elements.resultBestCompare.textContent = headline.text;
    this.elements.resultBestCompare.dataset.tone = headline.tone;
    // The freed second line celebrates clean clears — boards emptied without
    // a rescue — which replaced the reveal-percentage record now that every
    // stage ends fully revealed.
    const clean = Math.max(0, Math.round(Number(cleanClears) || 0));
    this.elements.resultPreviousCompare.hidden = clean <= 0;
    this.elements.resultPreviousCompare.textContent = clean > 0 ? `CLEAN CLEAR ×${clean}!` : '';
    if (clean > 0) this.elements.resultPreviousCompare.dataset.tone = 'up';
    const recordProgress = !recordEligible
      ? 0
      : newRecord || previousBest <= 0
      ? 1
      : clamp(score / Math.max(1, previousBest), 0, 1);
    const recordPercent = Math.round(recordProgress * 100);
    // The meter only earns its row when it says something the copy above it
    // does not. A new record pins it at 100% and a practice run excludes it
    // from records entirely, and in both cases the line under the score has
    // already said so — so the meter is a chase bar, shown only while there
    // is a record left to chase.
    const meterIsInformative = recordEligible && !newRecord && previousBest > 0;
    this.elements.resultRecordMeter.hidden = !meterIsInformative;
    // Its own label repeated the comparison line verbatim ("최고기록 도전
    // 15%" over "최고 기록의 15%까지 왔다냥"), so the bar now carries the
    // figure for assistive tech instead of printing it twice.
    this.elements.resultRecordMeterLabel.textContent = `최고기록 도전 ${recordPercent}%`;
    this.elements.resultRecordMeter.setAttribute('aria-label', `최고기록 도전 진행도 ${recordPercent}%`);
    this.elements.resultRecordMeter.style.setProperty('--record-progress', String(recordProgress));
    this.elements.resultRecordMeter.classList.remove('is-animating');

    const message = resultMessage || pickMessage(newRecord ? 'record' : 'resultNormal', this.lastResultMessage);
    this.lastResultMessage = message;
    this.elements.resultMessage.textContent = message;
    // The board stays on screen behind the sheet, with its remaining answers
    // still lit — seeing what you missed is what makes the retry button worth
    // pressing, and it is how the original ends a run.
    this.showScreen('result', { behind: 'play' });
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
