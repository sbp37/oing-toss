import { cellsInRect } from './board.js';
import { comboMultiplier, pickMessage } from './data.js';

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
    this.countdownPulseTimer = null;
    this.lastCountdownSecond = null;
    this.lastSelectionKey = '';
    this.lastSelectionBounds = null;
    this.characterToken = 0;
    this.resultCharacterToken = 0;
    this.lastResultMessage = '';
    this.elements = {
      round: document.querySelector('#round-value'),
      score: document.querySelector('#score-value'),
      time: document.querySelector('#time-value'),
      timePill: document.querySelector('#time-pill'),
      playScreen: document.querySelector('#play-screen'),
      combo: document.querySelector('#combo-value'),
      comboChip: document.querySelector('#combo-chip'),
      comboTimerFill: document.querySelector('#combo-timer-fill'),
      goal: document.querySelector('#goal-value'),
      goalFill: document.querySelector('#goal-fill'),
      sumBubble: document.querySelector('#sum-bubble'),
      sum: document.querySelector('#sum-value'),
      marquee: document.querySelector('#selection-marquee'),
      tutorial: document.querySelector('#tutorial-guide'),
      catMessage: document.querySelector('#cat-message'),
      playCat: document.querySelector('#play-cat'),
      resultCat: document.querySelector('#result-cat'),
      resultDecor: document.querySelector('#result-decor'),
      roundClear: document.querySelector('#round-clear'),
      roundShift: document.querySelector('#round-shift'),
      roundShiftValue: document.querySelector('#round-shift-value'),
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
      rankingBest: document.querySelector('#ranking-best-score'),
      finalScore: document.querySelector('#final-score'),
      finalCombo: document.querySelector('#final-combo'),
      finalRound: document.querySelector('#final-round'),
      finalLargestClear: document.querySelector('#final-largest-clear'),
      newRecord: document.querySelector('#new-record'),
      resultMessage: document.querySelector('#result-message'),
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

  renderBoard(model) {
    this.board.dataset.size = String(model.size);
    this.boardFrame.dataset.size = String(model.size);
    this.board.style.setProperty('--board-size', model.size);
    const fragment = document.createDocumentFragment();
    for (let r = 0; r < model.size; r += 1) {
      for (let c = 0; c < model.size; c += 1) {
        const value = model.valueAt(r, c);
        const tone = value ? TILE_TONE_BY_VALUE[value] : 0;
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.tabIndex = -1;
        tile.className = `tile tone-${tone}${value ? ` value-${value}` : ' is-empty'}`;
        tile.dataset.row = String(r);
        tile.dataset.col = String(c);
        tile.dataset.value = String(value || 0);
        tile.style.setProperty('--row', String(r));
        tile.style.setProperty('--col', String(c));
        tile.setAttribute('role', 'gridcell');
        tile.setAttribute('aria-label', value ? `${value}` : '빈칸');
        tile.innerHTML = value ? `<span>${value}</span>` : '';
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
        tile.classList.toggle('is-selected', selected.has(`${tile.dataset.row}:${tile.dataset.col}`));
      });
      bounds = this.selectionBounds(rect);
      this.lastSelectionKey = selectionKey;
      this.lastSelectionBounds = bounds;
      if (bounds) {
        const pad = 3;
        marquee.style.left = `${bounds.left - pad}px`;
        marquee.style.top = `${bounds.top - pad}px`;
        marquee.style.width = `${bounds.right - bounds.left + pad * 2}px`;
        marquee.style.height = `${bounds.bottom - bounds.top + pad * 2}px`;
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
      pullX = clamp(((pointerX / bounds.frameWidth) - 0.5) * 5.6, -2.8, 2.8);
      pullY = clamp(((pointerY / bounds.frameHeight) - 0.5) * 5.6, -2.8, 2.8);
      const selectionWidth = Math.max(1, bounds.right - bounds.left);
      const selectionHeight = Math.max(1, bounds.bottom - bounds.top);
      const syrupX = clamp(((pointerX - bounds.left) / selectionWidth) * 100, 10, 90);
      const syrupY = clamp(((pointerY - bounds.top) / selectionHeight) * 100, 10, 90);
      marquee.style.setProperty('--syrup-x', `${syrupX}%`);
      marquee.style.setProperty('--syrup-y', `${syrupY}%`);
      marquee.style.setProperty('--syrup-pull-x', `${pullX * 0.48}px`);
      marquee.style.setProperty('--syrup-pull-y', `${pullY * 0.48}px`);
      const sideOffset = pointerX > bounds.frameWidth / 2 ? -48 : 48;
      const bubbleX = clamp(pointerX + sideOffset, 49, bounds.frameWidth - 49);
      const bubbleY = clamp(Math.min(bounds.top - 39, pointerY - 52), -31, bounds.frameHeight - 44);
      bubble.style.left = `${bubbleX}px`;
      bubble.style.top = `${bubbleY}px`;
    }

    this.elements.sumBubble.classList.add('is-visible');
    this.boardFrame.style.setProperty('--drag-pull-x', `${pullX * 0.32}px`);
    this.boardFrame.style.setProperty('--drag-pull-y', `${pullY * 0.32}px`);
  }

  selectionSnap(isPerfect = false) {
    const marquee = this.elements.marquee;
    this.selectionSnapAnimation?.cancel();
    clearTimeout(this.selectionSnapTimer);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && typeof marquee.animate === 'function') {
      const frames = isPerfect
        ? [
          { scale: '0.978', filter: 'brightness(1)' },
          { scale: '1.022', filter: 'brightness(1.08) saturate(1.06)', offset: 0.52 },
          { scale: '1', filter: 'brightness(1.025)' },
        ]
        : [
          { scale: '0.99 1.01', borderRadius: '18px' },
          { scale: '1.009 0.995', borderRadius: '14px', offset: 0.5 },
          { scale: '1', borderRadius: '16px' },
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
    this.lastSelectionKey = '';
    this.lastSelectionBounds = null;
    this.board.querySelectorAll('.tile.is-selected').forEach((tile) => tile.classList.remove('is-selected'));
    this.elements.marquee.classList.remove('is-visible', 'is-ten', 'is-snapping', 'is-perfect-snap');
    this.elements.marquee.style.setProperty('--syrup-pull-x', '0px');
    this.elements.marquee.style.setProperty('--syrup-pull-y', '0px');
    this.elements.sumBubble.classList.remove('is-visible', 'is-ten');
    this.board.classList.remove('is-perfect');
    this.elements.sum.textContent = '0';
    this.boardFrame.style.setProperty('--drag-pull-x', '0px');
    this.boardFrame.style.setProperty('--drag-pull-y', '0px');
  }

  spawnParticles(rect, combo = 1) {
    const bounds = this.selectionBounds(rect);
    if (!bounds) return;
    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;
    const sources = [
      'assets/decor/sparkle.webp',
      'assets/decor/star.webp',
      'assets/decor/heart.webp',
      'assets/decor/paw.webp',
      'assets/decor/sparkle.webp',
    ];
    const imageCount = combo >= 5 ? 5 : combo >= 3 ? 4 : 3;
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

    const glintCount = combo >= 8 ? 12 : combo >= 5 ? 10 : combo >= 3 ? 8 : 6;
    const glintColors = ['#ff7ba8', '#7fd6c2', '#ffd57e', '#ffffff', '#8db7ff'];
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
  }

  async animateSuccess(rect, combo = 1) {
    const tiles = cellsInRect(rect).map(({ r, c }) => this.tileAt(r, c)).filter(Boolean);
    tiles.forEach((tile, index) => {
      tile.style.setProperty('--pop-delay', `${Math.min(index * 7, 42)}ms`);
      tile.classList.add('is-success');
    });
    this.elements.marquee.classList.add('is-ten');
    this.elements.marquee.classList.add('is-bursting');
    this.boardFrame.dataset.comboImpact = combo >= 8 ? '8' : combo >= 5 ? '5' : combo >= 3 ? '3' : '1';
    this.spawnParticles(rect, combo);
    this.boardFrame.classList.add('success-kick');
    await delay(225);
    this.boardFrame.classList.remove('success-kick');
    this.elements.marquee.classList.remove('is-bursting', 'is-visible');
    delete this.boardFrame.dataset.comboImpact;
  }

  async animateFailure(rect) {
    const tiles = cellsInRect(rect).map(({ r, c }) => this.tileAt(r, c)).filter(Boolean);
    tiles.forEach((tile) => tile.classList.add('is-fail'));
    this.elements.marquee.classList.add('is-fail');
    this.boardFrame.classList.add('fail-kick');
    await delay(175);
    tiles.forEach((tile) => tile.classList.remove('is-fail'));
    this.boardFrame.classList.remove('fail-kick');
    this.elements.marquee.classList.remove('is-fail');
    this.clearSelection();
  }

  showHint(rect) {
    const tiles = cellsInRect(rect).map(({ r, c }) => this.tileAt(r, c)).filter(Boolean);
    tiles.forEach((tile) => tile.classList.add('is-hint'));
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
      label.textContent = '여기!';
      region.append(label);
      for (let index = 0; index < 4; index += 1) region.appendChild(document.createElement('i'));
      this.boardFrame.appendChild(region);
      window.setTimeout(() => region.remove(), 1450);
    }
    const screen = this.board.closest('.screen-play');
    const first = this.tileAt(rect.r1, rect.c1)?.getBoundingClientRect();
    const last = this.tileAt(rect.r2, rect.c2)?.getBoundingClientRect();
    const button = this.elements.hintButton?.getBoundingClientRect();
    const screenBounds = screen?.getBoundingClientRect();
    if (screen && first && last && button && screenBounds) {
      const startX = button.left + button.width / 2 - screenBounds.left;
      const startY = button.top + button.height / 2 - screenBounds.top;
      const targetX = (first.left + last.right) / 2 - screenBounds.left;
      const targetY = (first.top + last.bottom) / 2 - screenBounds.top;
      const deltaX = targetX - startX;
      const deltaY = targetY - startY;
      const flight = document.createElement('div');
      flight.className = 'hint-flight';
      flight.style.left = `${startX}px`;
      flight.style.top = `${startY}px`;
      flight.style.width = `${Math.hypot(deltaX, deltaY)}px`;
      flight.style.transform = `rotate(${Math.atan2(deltaY, deltaX) * 180 / Math.PI}deg)`;
      for (let index = 0; index < 3; index += 1) flight.appendChild(document.createElement('i'));
      screen.appendChild(flight);
      setTimeout(() => flight.remove(), 1120);
    }
    setTimeout(() => tiles.forEach((tile) => tile.classList.remove('is-hint')), 1380);
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
    const label = this.elements.tutorial.querySelector('span');
    sparkleTrail.style.left = `${startX}px`;
    sparkleTrail.style.top = `${startY}px`;
    sparkleTrail.style.width = `${distance}px`;
    sparkleTrail.style.transform = `rotate(${angle}deg)`;
    label.style.left = `${clamp((bounds.left + bounds.right) / 2, 74, bounds.frameWidth - 74)}px`;
    label.style.top = `${clamp(bounds.top - 39, 7, bounds.frameHeight - 34)}px`;
    cellsInRect(rect).forEach(({ r, c }) => this.tileAt(r, c)?.classList.add('is-tutorial'));
    this.elements.tutorial.classList.add('is-visible');
  }

  hideTutorial() {
    this.elements.tutorial.classList.remove('is-visible');
    this.board.querySelectorAll('.tile.is-tutorial').forEach((tile) => tile.classList.remove('is-tutorial'));
  }

  setShuffleVectors() {
    const size = Number(this.board.dataset.size) || 4;
    const center = (size - 1) / 2;
    this.board.querySelectorAll('.tile').forEach((tile, index) => {
      const row = Number(tile.dataset.row);
      const col = Number(tile.dataset.col);
      const x = (col - center) * 15 + (index % 2 ? 8 : -8);
      const y = (row - center) * 13 + (index % 3 === 0 ? -9 : 7);
      tile.style.setProperty('--shuffle-x', `${x}px`);
      tile.style.setProperty('--shuffle-y', `${y}px`);
      const rotate = ((index % 5) - 2) * 5;
      tile.style.setProperty('--shuffle-mid-x', `${x * 0.48}px`);
      tile.style.setProperty('--shuffle-mid-y', `${y * 0.48}px`);
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
    icon.src = 'assets/icons/items/shuffle.webp';
    icon.alt = '';
    effect.append(icon, document.createElement('i'), document.createElement('i'), document.createElement('i'));
    this.boardFrame.appendChild(effect);
    this.board.classList.add('is-shuffling-out');
    await delay(420);
    this.board.classList.remove('is-shuffling-out');
  }

  async animateShuffleIn() {
    this.setShuffleVectors();
    this.board.classList.add('is-shuffling-in');
    await delay(430);
    this.board.classList.remove('is-shuffling-in');
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
  }

  setBombTargeting(active) {
    this.clearSelection();
    this.board.classList.toggle('is-bomb-targeting', active);
    this.elements.bombButton.classList.toggle('is-armed', active);
    this.elements.bombButton.setAttribute('aria-pressed', String(active));
  }

  async animateBomb(rect) {
    const bounds = this.selectionBounds(rect);
    const tiles = cellsInRect(rect).map(({ r, c }) => this.tileAt(r, c)).filter(Boolean);
    tiles.forEach((tile, index) => {
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
      this.boardFrame.appendChild(effect);
      setTimeout(() => effect.remove(), 720);
    }
    this.boardFrame.classList.add('bomb-kick');
    await delay(470);
    this.boardFrame.classList.remove('bomb-kick');
  }

  async animateClock(seconds = 8) {
    const screen = this.elements.playScreen;
    const start = this.elements.clockButton.getBoundingClientRect();
    const target = this.elements.timePill.getBoundingClientRect();
    const frame = screen.getBoundingClientRect();
    const flight = document.createElement('div');
    flight.className = 'clock-flight';
    flight.style.left = `${start.left + start.width / 2 - frame.left}px`;
    flight.style.top = `${start.top + start.height / 2 - frame.top}px`;
    flight.style.setProperty('--clock-x', `${target.left + target.width / 2 - start.left - start.width / 2}px`);
    flight.style.setProperty('--clock-y', `${target.top + target.height / 2 - start.top - start.height / 2}px`);
    const icon = document.createElement('img');
    icon.src = 'assets/icons/hud/time.webp';
    icon.alt = '';
    const label = document.createElement('strong');
    label.textContent = `+${seconds}초`;
    flight.append(icon, label);
    screen.appendChild(flight);
    this.elements.timePill.classList.remove('is-time-added');
    void this.elements.timePill.offsetWidth;
    this.elements.timePill.classList.add('is-time-added');
    await delay(620);
    flight.remove();
    this.elements.timePill.classList.remove('is-time-added');
  }

  showItemScoreBurst(points, rect, kind) {
    const bounds = this.selectionBounds(rect);
    const burst = this.elements.scoreBurst;
    const primary = document.createElement('strong');
    primary.textContent = `+${points}`;
    const detail = document.createElement('span');
    detail.textContent = kind === 'bomb' ? '폭탄 보너스' : '아이템 보너스';
    burst.replaceChildren(primary, detail);
    burst.dataset.level = '1';
    burst.dataset.item = kind;
    if (bounds) {
      burst.style.left = `${(bounds.left + bounds.right) / 2}px`;
      burst.style.top = `${(bounds.top + bounds.bottom) / 2}px`;
    }
    burst.classList.remove('is-visible');
    void burst.offsetWidth;
    burst.classList.add('is-visible');
    setTimeout(() => {
      burst.classList.remove('is-visible');
      delete burst.dataset.item;
    }, 760);
  }

  showScoreBurst(points, rect, size, combo, cellCount) {
    const bounds = this.selectionBounds(rect);
    const burst = this.elements.scoreBurst;
    const primary = document.createElement('strong');
    primary.textContent = `+${points}`;
    const detail = document.createElement('span');
    const labels = [];
    if (cellCount >= 3) labels.push(`${cellCount}칸 클리어`);
    if (combo > 1) labels.push(`배율 ×${comboMultiplier(combo).toFixed(2)}`);
    detail.textContent = labels.join(' · ');
    detail.hidden = labels.length === 0;
    burst.replaceChildren(primary, detail);
    burst.dataset.level = combo >= 8 ? '8' : combo >= 5 ? '5' : combo >= 3 ? '3' : '1';
    if (bounds) {
      burst.style.left = `${(bounds.left + bounds.right) / 2}px`;
      burst.style.top = `${(bounds.top + bounds.bottom) / 2}px`;
    } else {
      burst.style.left = `${((rect.c1 + rect.c2 + 1) / 2 / size) * 100}%`;
      burst.style.top = `${((rect.r1 + rect.r2 + 1) / 2 / size) * 100}%`;
    }
    burst.classList.remove('is-visible');
    void burst.offsetWidth;
    burst.classList.add('is-visible');
    setTimeout(() => burst.classList.remove('is-visible'), 760);
  }

  showComboMoment(combo) {
    const level = combo >= 8 ? '8' : combo >= 5 ? '5' : combo >= 3 ? '3' : '';
    this.elements.comboChip.dataset.level = level;
    this.elements.comboChip.classList.remove('is-punching');
    void this.elements.comboChip.offsetWidth;
    this.elements.comboChip.classList.add('is-punching');
    setTimeout(() => this.elements.comboChip.classList.remove('is-punching'), 520);

    const celebration = this.elements.comboCelebration;
    clearTimeout(this.comboCelebrationTimer);
    celebration.dataset.level = level;
    this.elements.comboCelebrationValue.textContent = String(combo);
    this.elements.comboCelebrationKicker.textContent = level === '8'
      ? 'OING FEVER!'
      : level === '5'
        ? 'SWEET!'
        : 'NICE!';
    celebration.classList.remove('is-visible');
    this.boardFrame.classList.remove('combo-celebrating');
    void celebration.offsetWidth;
    celebration.classList.add('is-visible');
    this.boardFrame.dataset.comboCelebration = level;
    this.boardFrame.classList.add('combo-celebrating');
    this.spawnComboConfetti(Number(level));
    const duration = level === '8' ? 820 : level === '5' ? 760 : 700;
    this.comboCelebrationTimer = window.setTimeout(() => {
      this.dismissComboCelebration();
    }, duration);
  }

  spawnComboConfetti(level) {
    this.boardFrame.querySelectorAll('.combo-confetti').forEach((particle) => particle.remove());
    const count = level >= 8 ? 14 : level >= 5 ? 9 : 6;
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
    this.boardFrame.classList.remove('combo-celebrating');
    delete this.boardFrame.dataset.comboCelebration;
  }

  showRoundClear() {
    this.dismissComboCelebration();
    const clear = this.elements.roundClear;
    this.elements.scoreBurst.classList.remove('is-visible');
    clear.classList.remove('is-visible');
    void clear.offsetWidth;
    clear.classList.add('is-visible');
    setTimeout(() => clear.classList.remove('is-visible'), 540);
  }

  async animateRoundTransition(nextRound, swapBoard) {
    const shift = this.elements.roundShift;
    this.elements.roundShiftValue.textContent = String(nextRound);
    this.boardFrame.classList.add('is-round-leaving');
    await delay(190);
    swapBoard();
    this.boardFrame.classList.remove('is-round-leaving');
    shift.classList.remove('is-visible');
    void shift.offsetWidth;
    shift.classList.add('is-visible');
    this.boardFrame.classList.add('is-round-arriving');
    await delay(540);
    this.boardFrame.classList.remove('is-round-arriving');
    shift.classList.remove('is-visible');
  }

  async animateGameEnd() {
    this.dismissComboCelebration();
    this.clearSelection();
    this.elements.scoreBurst.classList.remove('is-visible');
    const timeUp = this.elements.timeUp;
    this.boardFrame.classList.remove('is-game-ending');
    timeUp.classList.remove('is-visible');
    void this.boardFrame.offsetWidth;
    this.boardFrame.classList.add('is-game-ending');
    timeUp.classList.add('is-visible');
    await delay(1050);
    timeUp.classList.remove('is-visible');
    this.boardFrame.classList.remove('is-game-ending');
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

  showMessage(message, duration = 1500) {
    const token = ++this.messageToken;
    clearTimeout(this.messageTimer);
    const bubble = this.elements.catMessage;
    bubble.classList.remove('is-changing');
    void bubble.offsetWidth;
    bubble.textContent = message;
    bubble.classList.add('is-changing');
    this.messageTimer = setTimeout(() => {
      if (token === this.messageToken) bubble.classList.remove('is-changing');
    }, duration);
  }

  updateHUD({ round, score, timeLeft, combo, comboRemaining = 0, progress, target }) {
    this.elements.round.textContent = String(round);
    this.elements.score.textContent = score.toLocaleString('ko-KR');
    const time = Math.max(0, Math.ceil(timeLeft));
    this.elements.time.textContent = `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
    this.elements.timePill.classList.toggle('is-warning', time <= 10);
    const isFinalCountdown = time > 0 && time <= 10;
    this.elements.playScreen.classList.toggle('is-final-countdown', isFinalCountdown);
    this.elements.playScreen.dataset.round = String(round);
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
    this.elements.comboTimerFill.style.transform = `scaleX(${clamp(comboRemaining, 0, 1)})`;
    this.elements.comboChip.classList.toggle('is-active', combo > 0 && comboRemaining > 0);
    const comboLevel = combo >= 8 ? '8' : combo >= 5 ? '5' : combo >= 3 ? '3' : '';
    this.elements.comboChip.dataset.level = comboLevel;
    this.boardFrame.classList.toggle('is-fever', combo >= 8 && comboRemaining > 0);
    this.elements.goal.textContent = `${progress}/${target}`;
    this.elements.goalFill.style.width = `${Math.min(100, (progress / target) * 100)}%`;
  }

  updateItems({ hint, shuffle, bomb, clock }) {
    this.elements.hintCount.textContent = String(hint);
    this.elements.shuffleCount.textContent = String(shuffle);
    this.elements.bombCount.textContent = String(bomb);
    this.elements.clockCount.textContent = String(clock);
    this.elements.hintButton.disabled = hint <= 0;
    this.elements.shuffleButton.disabled = shuffle <= 0;
    this.elements.bombButton.disabled = bomb <= 0;
    this.elements.clockButton.disabled = clock <= 0;
    this.elements.hintButton.classList.toggle('is-depleted', hint <= 0);
    this.elements.shuffleButton.classList.toggle('is-depleted', shuffle <= 0);
    this.elements.bombButton.classList.toggle('is-depleted', bomb <= 0);
    this.elements.clockButton.classList.toggle('is-depleted', clock <= 0);
    this.elements.hintButton.setAttribute('aria-label', `힌트, ${hint}회 남음`);
    this.elements.shuffleButton.setAttribute('aria-label', `섞기, ${shuffle}회 남음`);
    this.elements.bombButton.setAttribute('aria-label', `폭탄, ${bomb}회 남음`);
    this.elements.clockButton.setAttribute('aria-label', `시계, ${clock}회 남음`);
  }

  updateBestScore(score) {
    const text = score.toLocaleString('ko-KR');
    this.elements.homeBest.textContent = text;
    this.elements.rankingBest.textContent = text;
  }

  showResult({ score, maxCombo, round, maxClearCells, newRecord, previousBest }) {
    this.elements.finalScore.textContent = score.toLocaleString('ko-KR');
    this.elements.finalCombo.textContent = String(maxCombo);
    this.elements.finalRound.textContent = String(round);
    this.elements.finalLargestClear.textContent = String(maxClearCells);
    this.elements.newRecord.hidden = !newRecord;
    this.elements.resultDecor.classList.toggle('is-record', newRecord);

    let resultMessageType = 'resultNormal';
    if (newRecord) {
      this.setResultCharacter('success');
      resultMessageType = 'record';
    } else if (score < 900) {
      this.setResultCharacter('fail');
      resultMessageType = 'resultLow';
    } else if (score >= 2500) {
      this.setResultCharacter('success');
      resultMessageType = 'resultHigh';
    } else {
      this.setResultCharacter('cheer');
      resultMessageType = 'resultNormal';
    }

    const gap = Math.max(0, previousBest - score);
    const message = !newRecord && gap > 0
      ? `최고기록까지 ${gap.toLocaleString('ko-KR')}점 남았어`
      : pickMessage(resultMessageType, this.lastResultMessage);
    this.lastResultMessage = message;
    this.elements.resultMessage.textContent = message;
    this.showScreen('result');
    const screen = document.querySelector('#result-screen');
    screen.classList.remove('is-entering');
    void screen.offsetWidth;
    screen.classList.add('is-entering');
    setTimeout(() => screen.classList.remove('is-entering'), 680);
  }

  setOverlay(id, visible) {
    const overlay = document.querySelector(`#${id}`);
    if (!overlay) return;
    overlay.hidden = !visible;
  }

  updateToggle(button, enabled) {
    button.classList.toggle('is-on', enabled);
    button.textContent = enabled ? 'ON' : 'OFF';
    button.setAttribute('aria-pressed', String(enabled));
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
