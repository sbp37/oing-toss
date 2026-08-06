import { GAME_DURATION_SECONDS, ITEM_DEFINITIONS, COMBO_WINDOW_MS, getRoundConfig, pickMessage, scoreForClear } from './data.js';
import { BoardModel } from './board.js';
import { attachStickyRectangleInput } from './input.js';
import { GameUI } from './ui.js';
import { storageAdapter, rankingAdapter, runtimeConfig, useFutureItem } from './adapters.js';
import { preloadResultAssets, schedulePlayAssetsPreload } from './preload.js';
import {
  isSoundEnabled,
  playComboSound,
  playCountdownTick,
  playFailSound,
  playGameOverSound,
  playHintSound,
  playRoundClearSound,
  playSelectionSound,
  playShuffleSound,
  playSuccessSound,
  setSoundEnabled,
  unlockAudio,
} from './audio.js';
import {
  failHaptic,
  countdownHaptic,
  isHapticEnabled,
  itemHaptic,
  roundHaptic,
  selectionTick,
  setHapticEnabled,
  successHaptic,
} from './haptic.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class OingGame {
  constructor() {
    this.ui = new GameUI();
    this.model = new BoardModel(4);
    this.runtime = runtimeConfig();
    this.settings = storageAdapter.getSettings();
    this.timer = null;
    this.endAt = 0;
    this.pauseStartedAt = 0;
    this.lowTimeSpoken = false;
    this.lastCountdownSecond = null;
    this.inputGuardUntil = 0;
    this.tutorialActive = false;
    this.waitingForFirstDrag = false;
    this.lastCatMessage = '';
    this.state = this.freshState();
    this.input = attachStickyRectangleInput({
      boardEl: this.ui.board,
      isEnabled: () => this.state.running
        && !this.state.paused
        && !this.state.inputLocked
        && performance.now() >= this.inputGuardUntil,
      onPreview: (rect, pointer) => this.preview(rect, pointer),
      onCommit: (rect) => this.commit(rect),
      onCancel: () => this.ui.clearSelection(),
      onSelectionStep: (rect) => {
        const stats = this.model.stats(rect);
        this.ui.selectionSnap(stats.sum === 10);
        selectionTick(stats.sum === 10);
        playSelectionSound(stats.sum);
      },
    });
    this.bindEvents();
    this.applySettings();
    this.ui.renderBoard(this.model);
    this.ui.updateBestScore(storageAdapter.getBestScore());
    this.ui.showScreen('home');
    schedulePlayAssetsPreload();
  }

  freshState() {
    return {
      running: false,
      paused: false,
      inputLocked: false,
      score: 0,
      combo: 0,
      maxCombo: 0,
      round: 1,
      progress: 0,
      timeLeft: this.runtime?.duration || GAME_DURATION_SECONDS,
      comboExpiresAt: 0,
      successCount: 0,
      maxClearCells: 0,
      items: {
        hint: ITEM_DEFINITIONS.hint.initial,
        shuffle: ITEM_DEFINITIONS.shuffle.initial,
      },
    };
  }

  bindEvents() {
    document.querySelector('#start-button').addEventListener('click', () => this.start());
    document.querySelector('#retry-button').addEventListener('click', () => this.start());
    document.querySelector('#home-button').addEventListener('click', () => this.goHome());
    document.querySelector('#pause-button').addEventListener('click', () => this.pause());
    document.querySelector('#resume-button').addEventListener('click', () => this.resume());
    document.querySelector('#pause-home-button').addEventListener('click', () => this.goHome());
    document.querySelector('#hint-button').addEventListener('click', () => this.useHint());
    document.querySelector('#shuffle-button').addEventListener('click', () => this.useShuffle());
    document.querySelector('#home-settings-button').addEventListener('click', () => this.ui.setOverlay('settings-overlay', true));
    document.querySelector('#settings-close').addEventListener('click', () => this.ui.setOverlay('settings-overlay', false));
    document.querySelector('#home-ranking-button').addEventListener('click', () => this.openRanking());
    document.querySelector('#result-ranking-button').addEventListener('click', () => this.openRanking());
    document.querySelector('#ranking-close').addEventListener('click', () => this.ui.setOverlay('ranking-overlay', false));
    document.querySelector('#sound-toggle').addEventListener('click', () => {
      this.settings.sound = !this.settings.sound;
      this.applySettings();
    });
    document.querySelector('#haptic-toggle').addEventListener('click', () => {
      this.settings.haptic = !this.settings.haptic;
      this.applySettings();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.state.running && !this.state.paused) this.pause();
    });
  }

  applySettings() {
    setSoundEnabled(this.settings.sound);
    setHapticEnabled(this.settings.haptic);
    storageAdapter.saveSettings(this.settings);
    this.ui.updateToggle(document.querySelector('#sound-toggle'), isSoundEnabled());
    this.ui.updateToggle(document.querySelector('#haptic-toggle'), isHapticEnabled());
  }

  start() {
    this.stopTimer();
    unlockAudio();
    this.state = this.freshState();
    this.inputGuardUntil = 0;
    this.state.running = true;
    this.lowTimeSpoken = false;
    this.lastCountdownSecond = null;
    this.waitingForFirstDrag = Boolean(this.runtime.forceTutorial || !storageAdapter.hasSeenDragTutorial());
    this.ui.setOverlay('pause-overlay', false);
    this.buildRound();
    this.ui.updateItems(this.state.items);
    this.ui.showScreen('play');
    this.ui.setPlayCharacter('peek');
    this.showCatMessage('start');
    preloadResultAssets();
    window.setTimeout(() => this.maybeShowTutorial(), 180);
    if (!this.waitingForFirstDrag) this.beginCountdown();
  }

  beginCountdown() {
    if (this.timer || !this.state.running) return;
    this.endAt = performance.now() + this.state.timeLeft * 1000;
    this.timer = window.setInterval(() => this.tick(), 100);
    this.tick();
  }

  beginFirstInteraction() {
    if (!this.waitingForFirstDrag) return;
    this.waitingForFirstDrag = false;
    this.tutorialActive = false;
    this.ui.hideTutorial();
    storageAdapter.markDragTutorialSeen();
    this.beginCountdown();
  }

  buildRound() {
    const config = getRoundConfig(this.state.round);
    this.model.generate(config.size);
    this.ui.renderBoard(this.model);
    this.updateHUD();
  }

  preview(rect, pointer) {
    if (!this.state.running || this.state.inputLocked) return;
    this.beginFirstInteraction();
    this.ui.previewSelection(rect, this.model.stats(rect), pointer);
  }

  maybeShowTutorial() {
    if (!this.state.running || (!this.runtime.forceTutorial && storageAdapter.hasSeenDragTutorial())) return;
    const answer = this.model.findAnswer();
    if (!answer) {
      this.beginFirstInteraction();
      return;
    }
    this.tutorialActive = true;
    this.ui.showTutorial(answer);
  }

  async commit(rect) {
    if (!this.state.running || this.state.paused || this.state.inputLocked) return;
    const stats = this.model.stats(rect);
    if (stats.count < 2) {
      this.ui.clearSelection();
      return;
    }
    if (stats.sum === 10) await this.handleSuccess(rect, stats);
    else await this.handleFailure(rect);
  }

  async handleSuccess(rect, stats) {
    this.state.inputLocked = true;
    const now = performance.now();
    this.state.combo = this.state.combo > 0 && this.state.comboExpiresAt >= now
      ? this.state.combo + 1
      : 1;
    this.state.comboExpiresAt = now + COMBO_WINDOW_MS;
    this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
    this.state.successCount += 1;
    this.state.maxClearCells = Math.max(this.state.maxClearCells, stats.count);
    const points = scoreForClear(stats.count, this.state.combo);
    this.state.score += points;
    this.state.progress += 1;
    successHaptic(this.state.combo);
    if (this.state.combo >= 2) playComboSound(this.state.combo);
    else playSuccessSound();
    if ([3, 5, 8].includes(this.state.combo)) {
      this.ui.showComboMoment(this.state.combo);
    }
    this.ui.showScoreBurst(points, rect, this.model.size, this.state.combo, stats.count);
    this.updateHUD();
    this.speakForSuccess();

    await this.ui.animateSuccess(rect, this.state.combo);
    this.model.remove(rect);
    this.ui.renderBoard(this.model);

    const config = getRoundConfig(this.state.round);
    if (this.state.progress >= config.target) {
      if ([3, 5, 8].includes(this.state.combo)) await delay(220);
      await this.clearRound();
    } else if (!this.model.findAnswer()) {
      this.model.generate(config.size);
      this.ui.renderBoard(this.model);
      this.ui.toast('새 보드로 바로 이어갈게!');
    }
    this.state.comboExpiresAt = performance.now() + COMBO_WINDOW_MS;
    this.state.inputLocked = false;
    this.updateHUD();
  }

  async handleFailure(rect) {
    this.state.inputLocked = true;
    this.state.combo = Math.max(0, this.state.combo - 1);
    this.state.comboExpiresAt = this.state.combo > 0
      ? Math.max(this.state.comboExpiresAt, performance.now() + 1200)
      : 0;
    failHaptic();
    playFailSound();
    this.updateHUD();
    this.showCatMessage('fail');
    this.ui.setPlayCharacter('fail', 700);
    await this.ui.animateFailure(rect);
    this.state.inputLocked = false;
  }

  speakForSuccess() {
    if (this.state.successCount === 1) {
      this.ui.setPlayCharacter('success', 800);
      this.showCatMessage('firstSuccess');
    } else if (this.state.combo === 3) {
      this.ui.setPlayCharacter('cheer', 900);
      this.showCatMessage('combo3');
    } else if (this.state.combo >= 5) {
      this.ui.setPlayCharacter('success', 900);
      this.showCatMessage(this.state.combo >= 8 ? 'combo8' : 'combo5');
    } else {
      this.showCatMessage('success');
    }
  }

  async clearRound() {
    roundHaptic();
    playRoundClearSound();
    this.ui.showRoundClear();
    this.ui.setPlayCharacter('cheer', 1000);
    this.showCatMessage('round');
    await delay(430);
    const nextRound = Math.min(3, this.state.round + 1);
    this.state.round = nextRound;
    this.state.progress = 0;
    await this.ui.animateRoundTransition(nextRound, () => this.buildRound());
    this.inputGuardUntil = performance.now() + 320;
  }

  useHint() {
    if (!this.canUseItem() || this.state.items.hint <= 0) return;
    this.beginFirstInteraction();
    const answer = this.model.findAnswer();
    if (!answer) {
      this.buildRound();
      this.ui.toast('가능한 보드를 준비했어!');
      return;
    }
    this.state.items.hint -= 1;
    this.ui.updateItems(this.state.items);
    this.ui.showHint(answer);
    this.showCatMessage('hint');
    this.ui.setPlayCharacter('wave', 900);
    playHintSound();
    itemHaptic();
  }

  async useShuffle() {
    if (!this.canUseItem() || this.state.items.shuffle <= 0) return;
    this.beginFirstInteraction();
    this.state.inputLocked = true;
    const success = this.model.shuffleRemaining();
    if (!success) {
      this.buildRound();
    }
    this.state.items.shuffle -= 1;
    this.ui.updateItems(this.state.items);
    this.showCatMessage('shuffle');
    playShuffleSound();
    itemHaptic();
    await this.ui.animateShuffleOut();
    this.ui.renderBoard(this.model);
    await this.ui.animateShuffleIn();
    this.state.inputLocked = false;
  }

  canUseItem() {
    return this.state.running && !this.state.paused && !this.state.inputLocked;
  }

  tick() {
    if (!this.state.running || this.state.paused) return;
    const now = performance.now();
    this.state.timeLeft = Math.max(0, (this.endAt - now) / 1000);
    if (this.state.combo > 0 && this.state.comboExpiresAt > 0 && now >= this.state.comboExpiresAt) {
      this.state.combo = 0;
      this.state.comboExpiresAt = 0;
    }
    if (this.state.timeLeft <= 10 && !this.lowTimeSpoken) {
      this.lowTimeSpoken = true;
      this.showCatMessage('lowTime');
      this.ui.setPlayCharacter('cheer', 1800);
    }
    const countdownSecond = Math.ceil(this.state.timeLeft);
    if (countdownSecond > 0 && countdownSecond <= 10 && countdownSecond !== this.lastCountdownSecond) {
      this.lastCountdownSecond = countdownSecond;
      playCountdownTick(countdownSecond);
      countdownHaptic(countdownSecond);
    }
    this.updateHUD();
    if (this.state.timeLeft <= 0) this.finish();
  }

  pause() {
    if (!this.state.running || this.state.paused) return;
    this.state.paused = true;
    this.pauseStartedAt = performance.now();
    this.input.cancel();
    this.ui.setOverlay('pause-overlay', true);
  }

  resume() {
    if (!this.state.running || !this.state.paused) return;
    this.endAt += performance.now() - this.pauseStartedAt;
    this.state.paused = false;
    this.ui.setOverlay('pause-overlay', false);
  }

  async finish() {
    if (!this.state.running) return;
    this.state.running = false;
    this.state.inputLocked = true;
    this.state.timeLeft = 0;
    this.stopTimer();
    this.input.cancel();
    this.tutorialActive = false;
    this.waitingForFirstDrag = false;
    this.ui.hideTutorial();
    this.ui.showMessage('시간 끝! 잘했어!');
    this.ui.setPlayCharacter(this.state.score >= 1200 ? 'success' : 'cheer');
    playGameOverSound();
    await this.ui.animateGameEnd();
    const oldBest = storageAdapter.getBestScore();
    const newRecord = this.state.score > oldBest;
    if (newRecord) storageAdapter.saveBestScore(this.state.score);
    this.ui.updateBestScore(Math.max(oldBest, this.state.score));
    this.ui.showResult({
      score: this.state.score,
      maxCombo: this.state.maxCombo,
      round: this.state.round,
      maxClearCells: this.state.maxClearCells,
      newRecord,
      previousBest: oldBest,
    });
  }

  goHome() {
    this.stopTimer();
    this.state.running = false;
    this.state.paused = false;
    this.input.cancel();
    this.tutorialActive = false;
    this.waitingForFirstDrag = false;
    this.ui.hideTutorial();
    this.ui.setOverlay('pause-overlay', false);
    this.ui.updateBestScore(storageAdapter.getBestScore());
    this.ui.showScreen('home');
  }

  async openRanking() {
    await rankingAdapter.open();
    this.ui.updateBestScore(storageAdapter.getBestScore());
    this.ui.setOverlay('ranking-overlay', true);
  }

  updateHUD() {
    const config = getRoundConfig(this.state.round);
    const comboRemaining = this.state.combo > 0 && this.state.comboExpiresAt > 0
      ? Math.max(0, (this.state.comboExpiresAt - performance.now()) / COMBO_WINDOW_MS)
      : 0;
    this.ui.updateHUD({ ...this.state, comboRemaining, target: config.target });
  }

  showCatMessage(type) {
    const message = pickMessage(type, this.lastCatMessage);
    this.lastCatMessage = message;
    this.ui.showMessage(message);
  }

  stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  useFutureItem(itemId) {
    return useFutureItem(itemId, { state: this.state, board: this.model.grid });
  }
}

const game = new OingGame();

if (game.runtime.testMode) {
  window.__OING_TEST__ = {
    getState: () => structuredClone(game.state),
    getBoard: () => game.model.grid.map((row) => row.slice()),
    findAnswer: () => game.model.findAnswer(),
  };
}
