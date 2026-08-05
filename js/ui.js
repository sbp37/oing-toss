import { cellsInRect } from './board.js';
import { pickMessage } from './data.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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
    this.characterToken = 0;
    this.resultCharacterToken = 0;
    this.lastResultMessage = '';
    this.elements = {
      round: document.querySelector('#round-value'),
      score: document.querySelector('#score-value'),
      time: document.querySelector('#time-value'),
      timePill: document.querySelector('#time-pill'),
      combo: document.querySelector('#combo-value'),
      comboChip: document.querySelector('#combo-chip'),
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
      scoreBurst: document.querySelector('#score-burst'),
      hintCount: document.querySelector('#hint-count'),
      shuffleCount: document.querySelector('#shuffle-count'),
      hintButton: document.querySelector('#hint-button'),
      shuffleButton: document.querySelector('#shuffle-button'),
      homeBest: document.querySelector('#home-best-score'),
      rankingBest: document.querySelector('#ranking-best-score'),
      finalScore: document.querySelector('#final-score'),
      finalCombo: document.querySelector('#final-combo'),
      finalRound: document.querySelector('#final-round'),
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
    this.board.style.setProperty('--board-size', model.size);
    const fragment = document.createDocumentFragment();
    for (let r = 0; r < model.size; r += 1) {
      for (let c = 0; c < model.size; c += 1) {
        const value = model.valueAt(r, c);
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.tabIndex = -1;
        tile.className = `tile tone-${value ? ((value - 1) % 4) + 1 : 0}${value ? '' : ' is-empty'}`;
        tile.dataset.row = String(r);
        tile.dataset.col = String(c);
        tile.dataset.value = String(value || 0);
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

  previewSelection(rect, stats) {
    const selected = new Set(cellsInRect(rect).map(({ r, c }) => `${r}:${c}`));
    this.board.querySelectorAll('.tile').forEach((tile) => {
      tile.classList.toggle('is-selected', selected.has(`${tile.dataset.row}:${tile.dataset.col}`));
    });

    const bounds = this.selectionBounds(rect);
    if (bounds) {
      const pad = 3;
      const marquee = this.elements.marquee;
      marquee.style.left = `${bounds.left - pad}px`;
      marquee.style.top = `${bounds.top - pad}px`;
      marquee.style.width = `${bounds.right - bounds.left + pad * 2}px`;
      marquee.style.height = `${bounds.bottom - bounds.top + pad * 2}px`;
      marquee.classList.add('is-visible');

      const bubble = this.elements.sumBubble;
      const bubbleX = clamp((bounds.left + bounds.right) / 2, 49, bounds.frameWidth - 49);
      const bubbleY = clamp(bounds.top - 39, -31, bounds.frameHeight - 44);
      bubble.style.left = `${bubbleX}px`;
      bubble.style.top = `${bubbleY}px`;
    }

    this.elements.sum.textContent = stats.sum === 10 ? '10!' : String(stats.sum);
    this.elements.sumBubble.classList.add('is-visible');
    this.elements.sumBubble.classList.toggle('is-ten', stats.sum === 10);
    this.boardFrame.style.setProperty('--drag-pull-x', `${Math.min((rect.c2 - rect.c1) * 0.8, 2.4)}px`);
    this.boardFrame.style.setProperty('--drag-pull-y', `${Math.min((rect.r2 - rect.r1) * 0.8, 2.4)}px`);
  }

  clearSelection() {
    this.board.querySelectorAll('.tile.is-selected').forEach((tile) => tile.classList.remove('is-selected'));
    this.elements.marquee.classList.remove('is-visible', 'is-ten');
    this.elements.sumBubble.classList.remove('is-visible', 'is-ten');
    this.elements.sum.textContent = '0';
    this.boardFrame.style.setProperty('--drag-pull-x', '0px');
    this.boardFrame.style.setProperty('--drag-pull-y', '0px');
  }

  spawnParticles(rect) {
    const bounds = this.selectionBounds(rect);
    if (!bounds) return;
    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;
    const sources = ['assets/decor/star.webp', 'assets/decor/sparkle.webp', 'assets/decor/sparkle.webp'];
    sources.forEach((source, index) => {
      const particle = document.createElement('img');
      particle.className = `success-particle particle-${index + 1}`;
      particle.src = source;
      particle.alt = '';
      particle.style.left = `${centerX}px`;
      particle.style.top = `${centerY}px`;
      this.boardFrame.appendChild(particle);
      setTimeout(() => particle.remove(), 520);
    });
  }

  async animateSuccess(rect) {
    const tiles = cellsInRect(rect).map(({ r, c }) => this.tileAt(r, c)).filter(Boolean);
    tiles.forEach((tile, index) => {
      tile.style.setProperty('--pop-delay', `${Math.min(index * 7, 42)}ms`);
      tile.classList.add('is-success');
    });
    this.elements.marquee.classList.add('is-ten');
    this.spawnParticles(rect);
    this.boardFrame.classList.add('success-kick');
    await delay(225);
    this.boardFrame.classList.remove('success-kick');
  }

  async animateFailure(rect) {
    cellsInRect(rect).forEach(({ r, c }) => this.tileAt(r, c)?.classList.add('is-fail'));
    this.elements.marquee.classList.add('is-fail');
    this.boardFrame.classList.add('fail-kick');
    await delay(175);
    this.boardFrame.classList.remove('fail-kick');
    this.elements.marquee.classList.remove('is-fail');
    this.clearSelection();
  }

  showHint(rect) {
    const tiles = cellsInRect(rect).map(({ r, c }) => this.tileAt(r, c)).filter(Boolean);
    tiles.forEach((tile) => tile.classList.add('is-hint'));
    setTimeout(() => tiles.forEach((tile) => tile.classList.remove('is-hint')), 1000);
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
    const line = this.elements.tutorial.querySelector('.tutorial-line');
    const label = this.elements.tutorial.querySelector('span');
    line.style.left = `${startX}px`;
    line.style.top = `${startY}px`;
    line.style.width = `${distance}px`;
    line.style.transform = `rotate(${angle}deg)`;
    label.style.left = `${clamp((bounds.left + bounds.right) / 2, 74, bounds.frameWidth - 74)}px`;
    label.style.top = `${clamp(bounds.top - 39, 7, bounds.frameHeight - 34)}px`;
    cellsInRect(rect).forEach(({ r, c }) => this.tileAt(r, c)?.classList.add('is-tutorial'));
    this.elements.tutorial.classList.add('is-visible');
  }

  hideTutorial() {
    this.elements.tutorial.classList.remove('is-visible');
    this.board.querySelectorAll('.tile.is-tutorial').forEach((tile) => tile.classList.remove('is-tutorial'));
  }

  async animateShuffle() {
    this.board.classList.add('is-shuffling');
    await delay(190);
    this.board.classList.remove('is-shuffling');
  }

  showScoreBurst(points, rect, size, combo) {
    const bounds = this.selectionBounds(rect);
    const burst = this.elements.scoreBurst;
    burst.textContent = `+${points}${combo > 1 ? ` ×${combo}` : ''}`;
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
    this.elements.comboChip.dataset.level = combo >= 8 ? '8' : combo >= 5 ? '5' : combo >= 3 ? '3' : '';
    this.elements.comboChip.classList.remove('is-punching');
    void this.elements.comboChip.offsetWidth;
    this.elements.comboChip.classList.add('is-punching');
    setTimeout(() => this.elements.comboChip.classList.remove('is-punching'), 520);
  }

  showRoundClear() {
    const clear = this.elements.roundClear;
    clear.classList.remove('is-visible');
    void clear.offsetWidth;
    clear.classList.add('is-visible');
    setTimeout(() => clear.classList.remove('is-visible'), 540);
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

  updateHUD({ round, score, timeLeft, combo, progress, target }) {
    this.elements.round.textContent = String(round);
    this.elements.score.textContent = score.toLocaleString('ko-KR');
    const time = Math.max(0, Math.ceil(timeLeft));
    this.elements.time.textContent = `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
    this.elements.timePill.classList.toggle('is-warning', time <= 10);
    this.elements.combo.textContent = String(combo);
    this.elements.goal.textContent = `${progress}/${target}`;
    this.elements.goalFill.style.width = `${Math.min(100, (progress / target) * 100)}%`;
  }

  updateItems({ hint, shuffle }) {
    this.elements.hintCount.textContent = String(hint);
    this.elements.shuffleCount.textContent = String(shuffle);
    this.elements.hintButton.disabled = hint <= 0;
    this.elements.shuffleButton.disabled = shuffle <= 0;
    this.elements.hintButton.classList.toggle('is-depleted', hint <= 0);
    this.elements.shuffleButton.classList.toggle('is-depleted', shuffle <= 0);
    this.elements.hintButton.setAttribute('aria-label', `힌트, ${hint}회 남음`);
    this.elements.shuffleButton.setAttribute('aria-label', `섞기, ${shuffle}회 남음`);
  }

  updateBestScore(score) {
    const text = score.toLocaleString('ko-KR');
    this.elements.homeBest.textContent = text;
    this.elements.rankingBest.textContent = text;
  }

  showResult({ score, maxCombo, round, newRecord, previousBest }) {
    this.elements.finalScore.textContent = score.toLocaleString('ko-KR');
    this.elements.finalCombo.textContent = String(maxCombo);
    this.elements.finalRound.textContent = String(round);
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
      ? `최고기록까지 ${gap.toLocaleString('ko-KR')}점 남았다냥`
      : pickMessage(resultMessageType, this.lastResultMessage);
    this.lastResultMessage = message;
    this.elements.resultMessage.textContent = message;
    this.showScreen('result');
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
