import {
  BOARD_DROP_ITEMS,
  GAME_DURATION_SECONDS,
  ITEM_REWARD_INTERVAL,
  START_COUNTDOWN_STEPS,
  TIME_FREEZE_SECONDS,
  boardDropReward,
  chooseBoardDrop,
  comboAfterFailure,
  comboGainForClear,
  comboMilestoneCrossed,
  freezeTimeline,
  getRoundConfig,
  itemRewardCountdown,
  pickMessage,
  rebasePausedTimeline,
  roundTimeBonusSeconds,
  scoreForBomb,
  scoreForCatBonus,
  scoreForClear,
  scoreForWideClear,
  scoreForMegaBomb,
  shouldShowBeginnerAutoHint,
  shouldAdvanceRound,
} from './data.js';
import { BoardModel, boardAssistForSuccessCount } from './board.js';
import { BoardItemField } from './board-items.js';
import { createRunInventory } from './inventory.js';
import { attachStickyRectangleInput } from './input.js';
import { GameUI } from './ui.js';
import { storageAdapter, rankingAdapter, shareAdapter, runtimeConfig, useFutureItem } from './adapters.js';
import { RunTelemetry, clearTelemetryRuns, getLocalTelemetrySummary, readTelemetryRuns } from './telemetry.js';
import { preloadPlayAssets, preloadResultAssets, schedulePlayAssetsPreload } from './preload.js';
import {
  configureMusic,
  duckMusic,
  fadeOutMusic,
  pauseMusic,
  playMusic,
  prepareMusic,
  setMusicEnabled,
  setMusicVolume,
  stopMusic,
} from './music.js';
import {
  isSoundEnabled,
  playComboSound,
  playCatBonusSound,
  playItemCollectSound,
  playItemDropSound,
  playBombSound,
  playClockSound,
  playCloverSound,
  playFreezeSound,
  playCountdownTick,
  playFailSound,
  playGameOverSound,
  playHintSound,
  playRoundClearSound,
  playShuffleSound,
  playSuccessSound,
  playWideClearSound,
  playMegaBombSound,
  playGoSound,
  playReadyCountSound,
  setSoundEnabled,
  unlockAudio,
} from './audio.js';
import {
  failHaptic,
  bombHaptic,
  clockHaptic,
  cloverHaptic,
  freezeHaptic,
  gameOverHaptic,
  countdownHaptic,
  isHapticEnabled,
  itemHaptic,
  megaBombHaptic,
  roundHaptic,
  readyCountHaptic,
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
    if (this.runtime.testMode) {
      window.OING_TELEMETRY = Object.freeze({
        summary: () => getLocalTelemetrySummary(),
        runs: () => readTelemetryRuns(),
        clear: () => clearTelemetryRuns(),
      });
    }
    this.settings = storageAdapter.getSettings();
    configureMusic(document.querySelector('#bgm-audio'), {
      enabled: this.settings.music,
      volume: this.settings.musicVolume,
    });
    this.inventory = createRunInventory();
    this.boardItems = new BoardItemField();
    this.itemTapCandidate = null;
    this.timer = null;
    this.endAt = 0;
    this.freezeEndsAt = 0;
    this.frozenTimeLeft = 0;
    this.pauseStartedAt = 0;
    this.lowTimeSpoken = false;
    this.lastCountdownSecond = null;
    this.inputGuardUntil = 0;
    this.tutorialActive = false;
    this.waitingForFirstDrag = false;
    this.lastCatMessage = '';
    this.lastResultSummary = null;
    this.startSequenceId = 0;
    this.startCountdownInProgress = false;
    this.resumeNeedsCountdown = false;
    this.restartConfirmUntil = 0;
    this.restartConfirmTimer = null;
    this.lastInteractionAt = performance.now();
    this.beginnerAutoHintShown = false;
    this.activeResolution = false;
    this.finishPending = false;
    this.finishing = false;
    this.telemetry = null;
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
      },
      onTapAnchor: (cell) => {
        this.beginFirstInteraction();
        this.ui.showTapAnchor(cell);
        this.showCatMessage('tapEnd');
      },
      onTapAnchorExpired: () => this.ui.clearSelection(),
    });
    this.bindEvents();
    this.applySettings();
    this.renderBoard();
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
      round: this.runtime?.forcedRound || 1,
      progress: 0,
      timeLeft: this.runtime?.duration || GAME_DURATION_SECONDS,
      comboExpiresAt: 0,
      successCount: 0,
      maxClearCells: 0,
      catsCollected: 0,
      catBonusScore: 0,
      boardDropsEarned: 0,
      lastBoardDropType: null,
      cloverDropped: false,
      items: this.inventory.snapshot(),
    };
  }

  bindEvents() {
    const playButtons = [
      document.querySelector('#start-button'),
      document.querySelector('#retry-button'),
      document.querySelector('#ranking-play-button'),
    ];
    const primePlay = () => { preloadPlayAssets({ urgent: true }); };
    playButtons.forEach((button) => {
      button.addEventListener('pointerdown', primePlay, { passive: true });
      button.addEventListener('pointerenter', primePlay, { passive: true, once: true });
      button.addEventListener('focus', primePlay, { passive: true, once: true });
    });
    document.querySelector('#start-button').addEventListener('click', () => this.start());
    document.querySelector('#retry-button').addEventListener('click', () => this.start());
    document.querySelector('#restart-button').addEventListener('click', () => this.requestRestart());
    document.querySelector('#home-button').addEventListener('click', () => this.goHome());
    document.querySelector('#pause-button').addEventListener('click', () => this.pause());
    document.querySelector('#resume-button').addEventListener('click', () => this.resume());
    document.querySelector('#pause-home-button').addEventListener('click', () => this.goHome());
    document.querySelector('#hint-button').addEventListener('click', () => this.useHint());
    document.querySelector('#shuffle-button').addEventListener('click', () => this.useShuffle());
    document.querySelector('#bomb-button').addEventListener('click', () => this.useBomb());
    document.querySelector('#clock-button').addEventListener('click', () => this.useClock());
    this.ui.board.addEventListener('pointerdown', (event) => this.beginBoardItemTap(event), { capture: true, passive: false });
    this.ui.board.addEventListener('pointermove', (event) => this.moveBoardItemTap(event), { capture: true, passive: false });
    this.ui.board.addEventListener('pointerup', (event) => this.endBoardItemTap(event), { capture: true, passive: false });
    this.ui.board.addEventListener('pointercancel', (event) => this.cancelBoardItemTap(event), { capture: true, passive: false });
    this.ui.board.addEventListener('lostpointercapture', (event) => this.cancelBoardItemTap(event), { capture: true });
    this.ui.board.addEventListener('keydown', (event) => this.handleBoardItemKey(event), { capture: true });
    document.querySelector('#home-settings-button').addEventListener('click', () => this.ui.setOverlay('settings-overlay', true));
    document.querySelector('#settings-close').addEventListener('click', () => this.ui.setOverlay('settings-overlay', false));
    document.querySelector('#home-ranking-button').addEventListener('click', () => this.openRanking());
    document.querySelector('#result-ranking-button').addEventListener('click', () => this.openRanking());
    document.querySelector('#share-button').addEventListener('click', () => this.shareResult());
    document.querySelector('#ranking-close').addEventListener('click', () => this.ui.setOverlay('ranking-overlay', false));
    document.querySelector('#ranking-play-button').addEventListener('click', () => {
      this.ui.setOverlay('ranking-overlay', false);
      this.start();
    });
    document.querySelector('#sound-toggle').addEventListener('click', () => {
      this.settings.sound = !this.settings.sound;
      this.applySettings();
    });
    const toggleMusic = () => {
      this.settings.music = !this.settings.music;
      this.applySettings();
    };
    document.querySelector('#music-button').addEventListener('click', toggleMusic);
    document.querySelector('#music-toggle').addEventListener('click', toggleMusic);
    document.querySelector('#music-volume').addEventListener('input', (event) => {
      this.settings.musicVolume = Number(event.target.value) / 100;
      this.applySettings();
    });
    document.querySelector('#haptic-toggle').addEventListener('click', () => {
      this.settings.haptic = !this.settings.haptic;
      this.applySettings();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.pause('background');
    });
    window.addEventListener('pagehide', (event) => {
      this.pause('background');
      if (!event.persisted && this.telemetry && !this.telemetry.closed) this.telemetry.finish(this.state, 'pagehide');
    });
  }

  applySettings() {
    setSoundEnabled(this.settings.sound);
    setHapticEnabled(this.settings.haptic);
    setMusicVolume(this.settings.musicVolume);
    setMusicEnabled(this.settings.music);
    storageAdapter.saveSettings(this.settings);
    this.ui.updateToggle(document.querySelector('#sound-toggle'), isSoundEnabled());
    this.ui.updateToggle(document.querySelector('#haptic-toggle'), isHapticEnabled());
    this.ui.updateMusicControls(this.settings.music, this.settings.musicVolume);
  }

  async start() {
    if (this.telemetry && !this.telemetry.closed) this.telemetry.finish(this.state, 'restart');
    preloadPlayAssets({ urgent: true });
    this.stopTimer();
    stopMusic();
    const sequenceId = ++this.startSequenceId;
    this.ui.cancelStartCountdown();
    this.startCountdownInProgress = false;
    this.resumeNeedsCountdown = false;
    this.resetRestartConfirmation();
    const audioReady = this.settings.sound ? unlockAudio() : Promise.resolve(false);
    if (this.settings.music) prepareMusic();
    this.inventory = createRunInventory();
    this.state = this.freshState();
    this.telemetry = new RunTelemetry({ viewport: { width: window.innerWidth, height: window.innerHeight } });
    this.boardItems.reset();
    this.itemTapCandidate = null;
    this.inputGuardUntil = 0;
    this.freezeEndsAt = 0;
    this.frozenTimeLeft = 0;
    this.ui.setFreezeActive(false);
    this.state.running = true;
    this.state.inputLocked = true;
    this.lowTimeSpoken = false;
    this.beginnerAutoHintShown = false;
    this.lastInteractionAt = performance.now();
    this.activeResolution = false;
    this.finishPending = false;
    this.finishing = false;
    this.lastCountdownSecond = null;
    this.waitingForFirstDrag = Boolean(this.runtime.forceTutorial || !storageAdapter.hasSeenDragTutorial());
    this.ui.setOverlay('pause-overlay', false);
    this.buildRound();
    this.forceTestBoardItem();
    this.ui.updateItems(this.state.items);
    this.ui.showScreen('play');
    this.ui.setPlayCharacter('idle');
    this.showCatMessage('start');
    if (!this.settings.sound) this.ui.toast('설정에서 효과음을 ON으로 켜달라냥');
    preloadResultAssets();
    this.startCountdownInProgress = true;
    const ready = await audioReady;
    if (sequenceId !== this.startSequenceId || !this.state.running || this.state.paused) {
      if (sequenceId === this.startSequenceId) this.startCountdownInProgress = false;
      if (this.state.paused) this.resumeNeedsCountdown = true;
      return;
    }
    if (this.settings.sound && !ready) this.ui.toast('휴대폰의 미디어 소리를 확인해달라냥');
    await this.runStartCountdown(sequenceId);
  }

  async runStartCountdown(sequenceId) {
    this.startCountdownInProgress = true;
    const completed = await this.ui.animateStartCountdown(START_COUNTDOWN_STEPS, (step) => {
      if (step === 'GO!') {
        playGoSound();
        playMusic({ restart: true });
      }
      else playReadyCountSound(step);
      readyCountHaptic(step);
    });
    const isCurrentSequence = sequenceId === this.startSequenceId;
    if (isCurrentSequence) this.startCountdownInProgress = false;
    if (!completed || !isCurrentSequence || !this.state.running) return false;
    if (this.state.paused) {
      this.resumeNeedsCountdown = true;
      return false;
    }
    if (this.runtime.forcedCombo > 0) {
      this.state.combo = this.runtime.forcedCombo;
      this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
      this.state.comboExpiresAt = 0;
      this.updateHUD();
    }
    this.telemetry?.playReady();
    this.state.inputLocked = false;
    this.inputGuardUntil = performance.now() + 100;
    if (this.waitingForFirstDrag) window.setTimeout(() => this.maybeShowTutorial(), 120);
    else this.beginCountdown();
    return true;
  }

  beginCountdown() {
    if (this.timer || !this.state.running) return;
    this.lastInteractionAt = performance.now();
    this.endAt = performance.now() + this.state.timeLeft * 1000;
    this.timer = window.setInterval(() => this.tick(), 100);
    this.tick();
  }

  beginFirstInteraction() {
    this.lastInteractionAt = performance.now();
    this.telemetry?.firstInput();
    if (!this.waitingForFirstDrag) return;
    this.waitingForFirstDrag = false;
    this.tutorialActive = false;
    this.ui.hideTutorial();
    storageAdapter.markDragTutorialSeen();
    this.beginCountdown();
  }

  buildRound() {
    this.boardItems.carry();
    this.itemTapCandidate = null;
    const config = getRoundConfig(this.state.round);
    this.generateBoard(config.size, config.rows);
    const placed = this.boardItems.place(this.model.grid, this.model.bonusCats);
    this.renderBoard();
    this.updateHUD();
    return placed;
  }

  generateBoard(cols, rows = cols) {
    const grid = this.model.generate(cols, {
      cols,
      rows,
      round: this.state.round,
      assist: boardAssistForSuccessCount(this.state.successCount),
    });
    this.telemetry?.boardGenerated(this.model.findAnswers().length);
    return grid;
  }

  renderBoard() {
    this.ui.renderBoard(this.model, this.boardItems.items);
  }

  forceTestBoardItem() {
    const type = this.runtime.forcedItem;
    if (!type || !BOARD_DROP_ITEMS[type]?.implemented) return;
    for (let row = 0; row < this.model.rows; row += 1) {
      for (let col = 0; col < this.model.cols; col += 1) {
        if (this.model.grid[row][col] == null) continue;
        this.model.grid[row][col] = null;
        this.boardItems.set(type, row, col, { earnedAtCombo: 0 });
        this.renderBoard();
        return;
      }
    }
  }

  beginBoardItemTap(event) {
    const tile = event.target.closest?.('.tile[data-item]');
    if (this.itemTapCandidate || !tile || !this.canUseItem() || event.isPrimary === false || event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const row = Number(tile.dataset.row);
    const col = Number(tile.dataset.col);
    this.itemTapCandidate = {
      pointerId: event.pointerId,
      key: `${row}:${col}`,
      row,
      col,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    this.ui.pressBoardItem(row, col, true);
    try { this.ui.board.setPointerCapture(event.pointerId); } catch {}
  }

  moveBoardItemTap(event) {
    const candidate = this.itemTapCandidate;
    if (!candidate || event.pointerId !== candidate.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const distance = Math.hypot(event.clientX - candidate.startX, event.clientY - candidate.startY);
    if (distance > 10) {
      candidate.moved = true;
      this.ui.pressBoardItem(candidate.row, candidate.col, false);
    }
  }

  endBoardItemTap(event) {
    const candidate = this.itemTapCandidate;
    if (!candidate || event.pointerId !== candidate.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const tile = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.tile[data-item]');
    const endedOnSameItem = tile
      && `${tile.dataset.row}:${tile.dataset.col}` === candidate.key;
    this.clearBoardItemTap(candidate);
    if (!candidate.moved && endedOnSameItem) this.useBoardItem(candidate.key);
  }

  cancelBoardItemTap(event) {
    const candidate = this.itemTapCandidate;
    if (!candidate || (event.pointerId != null && event.pointerId !== candidate.pointerId)) return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    this.clearBoardItemTap(candidate);
  }

  clearBoardItemTap(candidate = this.itemTapCandidate) {
    if (!candidate) return;
    this.ui.pressBoardItem(candidate.row, candidate.col, false);
    this.itemTapCandidate = null;
    if (this.ui.board.hasPointerCapture?.(candidate.pointerId)) {
      try { this.ui.board.releasePointerCapture(candidate.pointerId); } catch {}
    }
  }

  handleBoardItemKey(event) {
    if (!['Enter', ' '].includes(event.key)) return;
    const tile = event.target.closest?.('.tile[data-item]');
    if (!tile || !this.canUseItem()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.useBoardItem(`${tile.dataset.row}:${tile.dataset.col}`);
  }

  advanceCombo(amount = 1) {
    const previousCombo = this.state.combo;
    this.state.combo = previousCombo + Math.max(1, Math.round(Number(amount) || 1));
    this.state.comboExpiresAt = 0;
    this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
    const reward = boardDropReward(previousCombo, this.state.combo);
    let earnedDrop = null;
    if (reward) {
      const drop = chooseBoardDrop(this.state.combo, Math.random, {
        cloverGiven: this.state.cloverDropped,
        previousType: this.state.lastBoardDropType,
        rewardIndex: this.state.boardDropsEarned,
      });
      if (drop) {
        earnedDrop = drop;
        this.boardItems.queue(drop.id, { earnedAtCombo: this.state.combo, reward });
        this.state.boardDropsEarned += 1;
        this.state.lastBoardDropType = drop.id;
        if (drop.id === 'clover') this.state.cloverDropped = true;
        this.telemetry?.itemEarned(drop.id);
      }
    }
    return { previousCombo, earnedDrop };
  }

  announceBoardItems(items, { playSound = true } = {}) {
    this.ui.showBoardItemDrops(items);
    this.showCatMessage('itemDrop');
    this.ui.setPlayCharacter('wave', 1000);
    if (playSound) {
      duckMusic(320, 0.68);
      playItemDropSound();
    }
    itemHaptic();
  }

  preview(rect, pointer) {
    if (!this.state.running || this.state.inputLocked) return;
    this.beginFirstInteraction();
    this.ui.previewSelection(rect, this.model.stats(rect), pointer);
  }

  maybeShowTutorial() {
    if (!this.state.running || (!this.runtime.forceTutorial && storageAdapter.hasSeenDragTutorial())) return;
    const answer = this.model.findEasyAnswer();
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
    this.activeResolution = true;
    try {
      if (stats.sum === 10) {
        this.telemetry?.selection({ correct: true, cellCount: stats.count + (stats.catCount || 0), catCount: stats.catCount || 0 });
        await this.handleSuccess(rect, stats);
      } else {
        this.telemetry?.selection({ correct: false, cellCount: stats.count });
        await this.handleFailure(rect);
      }
    } finally {
      this.activeResolution = false;
      if (this.finishPending) this.finish();
    }
  }

  async handleSuccess(rect, stats) {
    this.state.inputLocked = true;
    const catCount = stats.catCount || 0;
    const clearedCellCount = stats.count + catCount;
    const comboGain = comboGainForClear(clearedCellCount);
    const { previousCombo, earnedDrop } = this.advanceCombo(comboGain);
    const comboMilestone = comboMilestoneCrossed(previousCombo, this.state.combo);
    this.state.successCount += 1;
    this.state.maxClearCells = Math.max(this.state.maxClearCells, clearedCellCount);
    const clearPoints = scoreForClear(clearedCellCount, this.state.combo);
    const wideBonusPoints = scoreForWideClear(clearedCellCount, this.state.combo);
    const catBonusPoints = scoreForCatBonus(catCount, this.state.combo);
    const points = clearPoints + wideBonusPoints + catBonusPoints;
    this.state.score += points;
    this.state.catsCollected += catCount;
    this.state.catBonusScore += catBonusPoints;
    this.state.progress += 1;
    successHaptic(this.state.combo);
    duckMusic(comboGain > 1 ? 560 : 390, comboGain > 1 ? 0.48 : 0.64);
    if (comboGain > 1) playWideClearSound();
    else if (this.state.combo >= 2) playComboSound(this.state.combo);
    else playSuccessSound();
    if (catCount > 0) playCatBonusSound(comboGain > 1 ? 0.24 : 0.15);
    if (comboMilestone) {
      this.ui.showComboMoment(comboMilestone);
    }
    if (earnedDrop) this.ui.showComboReward(earnedDrop, comboMilestone ? 300 : 40);
    this.ui.showScoreBurst(points, rect, { rows: this.model.rows, cols: this.model.cols }, this.state.combo, clearedCellCount, {
      catCount,
      catBonusPoints,
      comboGain,
      wideBonusPoints,
    });
    this.updateHUD();
    this.ui.pulseGoal(this.state.combo);
    this.speakForSuccess(catCount, comboGain);
    await this.ui.animateSuccess(rect, this.state.combo);
    this.model.remove(rect);
    if (this.finishPending) {
      this.renderBoard();
      return;
    }

    const config = getRoundConfig(this.state.round);
    const remainingAnswer = this.model.findAnswer();
    const perfect = this.model.remainingPlayableCells() === 0;
    if (shouldAdvanceRound(this.state.progress, config.target, Boolean(remainingAnswer))) {
      this.renderBoard();
      if (comboMilestone) await delay(220);
      await this.clearRound({ perfect });
    } else if (!remainingAnswer) {
      const carried = this.buildRound();
      if (carried.length) this.announceBoardItems(carried, { playSound: this.state.combo % ITEM_REWARD_INTERVAL !== 0 });
      this.showCatMessage('shuffle');
    } else {
      const placed = this.boardItems.place(this.model.grid, this.model.bonusCats);
      this.renderBoard();
      if (placed.length) this.announceBoardItems(placed, { playSound: this.state.combo % ITEM_REWARD_INTERVAL !== 0 });
    }
    this.state.comboExpiresAt = 0;
    this.state.inputLocked = false;
    this.updateHUD();
  }

  async handleFailure(rect) {
    this.state.inputLocked = true;
    const previousCombo = this.state.combo;
    this.state.combo = comboAfterFailure(previousCombo);
    this.state.comboExpiresAt = 0;
    failHaptic();
    playFailSound();
    this.updateHUD();
    if (previousCombo > this.state.combo) this.ui.showComboLoss(previousCombo - this.state.combo);
    this.showCatMessage('fail');
    this.ui.setPlayCharacter('fail', 700);
    await this.ui.animateFailure(rect);
    this.state.inputLocked = false;
  }

  speakForSuccess(catCount = 0, comboGain = 1) {
    if (catCount > 0) {
      this.ui.setPlayCharacter('success', 950);
      this.showCatMessage('catBonus');
    } else if (comboGain > 1) {
      this.ui.setPlayCharacter('success', 1000);
      this.showCatMessage('wow');
    } else if (this.state.successCount === 1) {
      this.ui.setPlayCharacter('success', 800);
      this.showCatMessage('firstSuccess');
    } else if (this.state.combo === 3) {
      this.ui.setPlayCharacter('cheer', 900);
      this.showCatMessage('combo3');
    } else if (this.state.combo > 0 && this.state.combo % ITEM_REWARD_INTERVAL === ITEM_REWARD_INTERVAL - 1) {
      this.ui.setPlayCharacter('wave', 900);
      this.ui.previewItemReward();
      this.ui.showMessage('한 번만 더면 아이템 나온다냥!', 1700, 'rewardNear');
    } else if (this.state.combo >= 5) {
      this.ui.setPlayCharacter('success', 900);
      this.showCatMessage(this.state.combo >= 8 ? 'combo8' : 'combo5');
    } else {
      this.showCatMessage('success');
    }
  }

  async clearRound({ perfect = false } = {}) {
    this.telemetry?.roundCleared({ perfect });
    const timeBonus = roundTimeBonusSeconds(this.state.round);
    roundHaptic();
    duckMusic(680, 0.46);
    playRoundClearSound();
    this.ui.showRoundClear(timeBonus);
    this.ui.setPlayCharacter('cheer', 1000);
    this.showCatMessage('round');
    if (perfect) {
      this.grantItems({ hint: 1 }, { source: 'earned' });
      this.showCatMessage('perfect');
      this.ui.toast('PERFECT! 힌트 +1');
    }
    this.state.timeLeft = Math.min(999, this.state.timeLeft + timeBonus);
    if (this.freezeEndsAt > performance.now()) this.frozenTimeLeft = this.state.timeLeft;
    if (this.timer) this.endAt += timeBonus * 1000;
    this.updateHUD();
    const [storedItems] = await Promise.all([
      this.storeRoundItems({ soundDelay: 460 }),
      delay(500),
    ]);
    const nextRound = this.state.round + 1;
    this.state.round = nextRound;
    this.state.progress = 0;
    let carriedItems = [];
    await this.ui.animateRoundTransition(nextRound, () => {
      carriedItems = this.buildRound();
    });
    if (storedItems.length) this.ui.toast('남은 아이템은 보관함에 챙겼다냥!');
    if (carriedItems.length) this.announceBoardItems(carriedItems);
    this.inputGuardUntil = performance.now() + 420;
    this.ui.showRoundReady(420);
  }

  async storeRoundItems({ soundDelay = 0 } = {}) {
    const sourceItems = this.boardItems.snapshot().visible
      .filter((item) => ['bomb', 'clock'].includes(item.type))
      .map((item) => ({
        item,
        sourceElement: this.ui.tileAt(item.row, item.col),
      }));
    const stored = this.boardItems.extractTypes(new Set(['bomb', 'clock']));
    if (!stored.length) return stored;
    if (soundDelay > 0) await delay(soundDelay);
    duckMusic(360, 0.64);
    playItemCollectSound();
    await Promise.all(sourceItems.map(({ item, sourceElement }) => (
      this.ui.animateItemCollect(item, sourceElement)
    )));
    const grants = stored.reduce((result, item) => {
      result[item.type] = (result[item.type] || 0) + 1;
      return result;
    }, {});
    this.grantItems(grants);
    return stored;
  }

  async useHint() {
    if (!this.canUseItem() || !this.inventory.canConsume('hint')) return;
    this.input.cancel();
    this.beginFirstInteraction();
    const answer = this.model.findHintAnswer();
    if (!answer) {
      this.buildRound();
      this.ui.toast('가능한 보드를 준비했어!');
      return;
    }
    if (!this.inventory.consume('hint').ok) return;
    this.telemetry?.itemUsed('hint');
    this.telemetry?.hint('manual');
    this.syncInventory();
    this.state.inputLocked = true;
    const center = this.ui.tileAt(
      Math.floor((answer.r1 + answer.r2) / 2),
      Math.floor((answer.c1 + answer.c2) / 2),
    );
    const cast = this.ui.animateItemCast('hint', center || this.ui.boardFrame);
    await delay(135);
    this.ui.showHint(answer);
    this.showCatMessage('hint');
    this.ui.setPlayCharacter('wave', 900);
    duckMusic(360, 0.7);
    playHintSound();
    itemHaptic();
    await cast;
    this.inputGuardUntil = performance.now() + 80;
    this.state.inputLocked = false;
  }

  async useShuffle() {
    if (!this.canUseItem() || !this.inventory.canConsume('shuffle')) return;
    this.input.cancel();
    this.beginFirstInteraction();
    this.state.inputLocked = true;
    const success = this.model.shuffleRemaining();
    if (!success) {
      this.buildRound();
    }
    if (!this.inventory.consume('shuffle').ok) {
      this.state.inputLocked = false;
      return;
    }
    this.telemetry?.itemUsed('shuffle');
    this.syncInventory();
    this.showCatMessage('shuffle');
    duckMusic(420, 0.66);
    playShuffleSound();
    itemHaptic();
    const cast = this.ui.animateItemCast('shuffle');
    await delay(135);
    await this.ui.animateShuffleOut();
    this.renderBoard();
    await this.ui.animateShuffleIn();
    await cast;
    this.state.inputLocked = false;
  }

  async useBomb() {
    if (!this.canUseItem() || !this.inventory.canConsume('bomb')) return;
    this.beginFirstInteraction();
    this.input.cancel();
    this.state.inputLocked = true;
    const target = this.model.bestBombTarget();
    if (!target) {
      this.ui.toast('터뜨릴 숫자가 없어!');
      this.state.inputLocked = false;
      return;
    }
    if (!this.inventory.consume('bomb').ok) {
      this.state.inputLocked = false;
      return;
    }
    this.telemetry?.itemUsed('bomb');

    this.syncInventory();
    const center = this.ui.tileAt(
      Math.floor((target.rect.r1 + target.rect.r2) / 2),
      Math.floor((target.rect.c1 + target.rect.c2) / 2),
    );
    const cast = this.ui.animateItemCast('bomb', center || this.ui.boardFrame);
    await delay(175);
    await this.resolveBomb(target);
    await cast;
  }

  async resolveBomb({ rect, stats }, boardItemKey = null) {
    const points = scoreForBomb(stats.sum);
    this.state.score += points;
    this.updateHUD();
    this.ui.showItemScoreBurst(points, rect, 'bomb');
    this.showCatMessage('bomb');
    this.ui.setPlayCharacter(this.state.combo >= 3 ? 'cheer' : 'success', 950);
    duckMusic(620, 0.44);
    playBombSound();
    bombHaptic();
    await this.ui.animateBomb(rect);
    this.model.remove(rect);
    await this.finishBlast(boardItemKey);
  }

  async resolveMegaBomb({ row, col, rect, cells, stats }, boardItemKey) {
    const points = scoreForMegaBomb(stats.sum);
    this.state.score += points;
    this.updateHUD();
    this.ui.showItemScoreBurst(points, rect, 'megabomb');
    this.showCatMessage('megabomb');
    this.ui.setPlayCharacter('success', 1100);
    duckMusic(780, 0.36);
    playMegaBombSound();
    megaBombHaptic();
    await this.ui.animateMegaBomb(cells, { row, col });
    this.model.removeCells(cells);
    await this.finishBlast(boardItemKey);
  }

  async finishBlast(boardItemKey = null) {
    if (boardItemKey) this.boardItems.delete(boardItemKey);
    const config = getRoundConfig(this.state.round);
    const remainingAnswer = this.model.findAnswer();
    if (shouldAdvanceRound(this.state.progress, config.target, Boolean(remainingAnswer))) {
      this.renderBoard();
      await this.clearRound();
    } else if (!remainingAnswer) {
      const carried = this.buildRound();
      if (carried.length) this.announceBoardItems(carried);
      this.ui.toast('새 보드로 바로 이어갈게!');
    } else {
      const placed = this.boardItems.place(this.model.grid, this.model.bonusCats);
      this.renderBoard();
      if (placed.length) this.announceBoardItems(placed);
    }
    this.inputGuardUntil = performance.now() + 180;
    this.state.inputLocked = false;
    this.updateHUD();
  }

  async useClock() {
    if (!this.canUseItem() || !this.inventory.canConsume('clock')) return;
    this.input.cancel();
    this.beginFirstInteraction();
    if (!this.inventory.consume('clock').ok) return;
    this.telemetry?.itemUsed('clock');
    this.syncInventory();
    await this.resolveClock();
  }

  async resolveClock(boardItemKey = null, sourceElement = this.ui.elements.clockButton) {
    this.state.inputLocked = true;
    const now = performance.now();
    this.state.timeLeft = Math.min(999, this.state.timeLeft + 8);
    if (this.freezeEndsAt > now) this.frozenTimeLeft = this.state.timeLeft;
    if (this.timer) this.endAt += 8000;
    if (this.state.timeLeft > 10) {
      this.lowTimeSpoken = false;
      this.lastCountdownSecond = null;
    }
    this.updateHUD();
    this.showCatMessage('clock');
    this.ui.setPlayCharacter('cheer', 900);
    duckMusic(650, 0.58);
    playClockSound();
    clockHaptic();
    const animation = this.ui.animateClock(8, sourceElement);
    if (boardItemKey) {
      this.boardItems.delete(boardItemKey);
      this.renderBoard();
    }
    await animation;
    this.inputGuardUntil = performance.now() + 100;
    this.state.inputLocked = false;
  }

  async resolveFreeze(boardItemKey, sourceElement) {
    this.state.inputLocked = true;
    const now = performance.now();
    const currentTimeLeft = this.freezeEndsAt > now
      ? this.frozenTimeLeft
      : Math.max(0, this.timer ? (this.endAt - now) / 1000 : this.state.timeLeft);
    const timeline = freezeTimeline(now, currentTimeLeft, TIME_FREEZE_SECONDS);
    this.freezeEndsAt = timeline.freezeEndsAt;
    this.frozenTimeLeft = timeline.frozenTimeLeft;
    this.endAt = timeline.endAt;
    this.state.timeLeft = this.frozenTimeLeft;
    this.lastCountdownSecond = null;
    this.ui.setFreezeActive(true);
    this.updateHUD();
    this.showCatMessage('freeze');
    this.ui.setPlayCharacter('cheer', 1050);
    duckMusic(680, 0.52);
    playFreezeSound();
    freezeHaptic();
    const animation = this.ui.animateFreeze(TIME_FREEZE_SECONDS, sourceElement);
    this.boardItems.delete(boardItemKey);
    this.renderBoard();
    await animation;
    this.inputGuardUntil = performance.now() + 80;
    this.state.inputLocked = false;
  }

  async resolveClover(boardItemKey, sourceElement) {
    this.state.inputLocked = true;
    const answer = this.model.findAnswer();
    const animation = this.ui.animateClover(sourceElement);
    this.boardItems.delete(boardItemKey);
    this.renderBoard();
    if (answer) this.ui.showCloverHint(answer);
    this.showCatMessage('clover');
    this.ui.setPlayCharacter('success', 1100);
    duckMusic(680, 0.56);
    playCloverSound();
    cloverHaptic();
    await animation;
    this.inputGuardUntil = performance.now() + 80;
    this.state.inputLocked = false;
  }

  async useBoardItem(key) {
    if (!this.canUseItem()) return;
    const item = this.boardItems.get(key);
    if (!item || !BOARD_DROP_ITEMS[item.type]?.implemented) return;
    this.telemetry?.itemUsed(item.type);
    this.beginFirstInteraction();
    this.input.cancel();
    this.state.inputLocked = true;
    if (item.type === 'bomb') {
      await this.resolveBomb(this.model.bombTarget(item.row, item.col), key);
      return;
    }
    if (item.type === 'megabomb') {
      await this.resolveMegaBomb(this.model.megaBombTarget(item.row, item.col), key);
      return;
    }
    if (item.type === 'clock') {
      const sourceElement = this.ui.tileAt(item.row, item.col);
      await this.resolveClock(key, sourceElement);
      return;
    }
    if (item.type === 'freeze') {
      const sourceElement = this.ui.tileAt(item.row, item.col);
      await this.resolveFreeze(key, sourceElement);
      return;
    }
    if (item.type === 'clover') {
      const sourceElement = this.ui.tileAt(item.row, item.col);
      await this.resolveClover(key, sourceElement);
      return;
    }
    this.state.inputLocked = false;
    this.ui.toast('이 아이템은 다음 업데이트에서 열려!');
  }

  canUseItem() {
    return this.state.running && !this.state.paused && !this.state.inputLocked;
  }

  syncInventory() {
    this.state.items = this.inventory.snapshot();
    this.ui.updateItems(this.state.items);
  }

  grantItems(grants, metadata = {}) {
    const result = this.inventory.grantBundle(grants, metadata);
    if (result.ok) this.syncInventory();
    return result;
  }

  tick() {
    if (!this.state.running || this.state.paused) return;
    const now = performance.now();
    this.maybeShowBeginnerAutoHint(now);
    const isFrozen = this.freezeEndsAt > now;
    if (isFrozen) {
      this.state.timeLeft = this.frozenTimeLeft;
    } else {
      if (this.freezeEndsAt > 0) {
        this.freezeEndsAt = 0;
        this.frozenTimeLeft = 0;
        this.ui.setFreezeActive(false);
      }
      this.state.timeLeft = Math.max(0, (this.endAt - now) / 1000);
    }
    if (!isFrozen && this.state.timeLeft <= 10 && !this.lowTimeSpoken) {
      this.lowTimeSpoken = true;
      this.showCatMessage('lowTime');
      this.ui.setPlayCharacter('cheer', 1800);
    }
    const countdownSecond = Math.ceil(this.state.timeLeft);
    if (!isFrozen && countdownSecond > 0 && countdownSecond <= 10 && countdownSecond !== this.lastCountdownSecond) {
      this.lastCountdownSecond = countdownSecond;
      playCountdownTick(countdownSecond);
      countdownHaptic(countdownSecond);
      if (countdownSecond <= 3) this.ui.showFinalSecond(countdownSecond);
    }
    this.updateHUD();
    if (this.state.timeLeft <= 0) this.requestFinish();
  }

  requestFinish() {
    if (!this.state.running || this.finishing || this.finishPending) return;
    if (this.activeResolution) {
      this.finishPending = true;
      this.state.timeLeft = 0;
      this.stopTimer();
      this.updateHUD();
      return;
    }
    this.finish();
  }

  maybeShowBeginnerAutoHint(now = performance.now()) {
    if (!shouldShowBeginnerAutoHint({
      running: this.state.running && !this.state.paused,
      inputLocked: this.state.inputLocked,
      tutorialActive: this.tutorialActive || this.waitingForFirstDrag,
      alreadyShown: this.beginnerAutoHintShown,
      timeLeft: this.state.timeLeft,
      idleMs: now - this.lastInteractionAt,
      bestScore: storageAdapter.getBestScore(),
      completedRuns: storageAdapter.getRecentScores().length,
    })) return false;
    const answer = this.model.findHintAnswer();
    if (!answer) return false;
    this.beginnerAutoHintShown = true;
    this.telemetry?.hint('auto');
    this.lastInteractionAt = now;
    this.ui.showHint(answer);
    this.ui.setPlayCharacter('wave', 1000);
    this.showCatMessage('autoHint');
    return true;
  }

  pause(reason = 'manual') {
    if (!this.state.running || this.state.paused) return;
    this.state.paused = true;
    this.telemetry?.pause();
    this.pauseStartedAt = performance.now();
    if (this.startCountdownInProgress) {
      this.resumeNeedsCountdown = true;
      this.startCountdownInProgress = false;
      this.startSequenceId += 1;
      this.ui.cancelStartCountdown();
    }
    this.input.cancel();
    pauseMusic();
    this.ui.setPauseReason(reason);
    this.ui.setOverlay('pause-overlay', true);
  }

  resume() {
    if (!this.state.running || !this.state.paused) return;
    const timeline = rebasePausedTimeline({
      endAt: this.endAt,
      freezeEndsAt: this.freezeEndsAt,
      comboExpiresAt: this.state.comboExpiresAt,
      pauseStartedAt: this.pauseStartedAt,
      resumedAt: performance.now(),
    });
    this.endAt = timeline.endAt;
    this.freezeEndsAt = timeline.freezeEndsAt;
    this.state.comboExpiresAt = timeline.comboExpiresAt;
    this.state.paused = false;
    this.telemetry?.resume();
    this.resetRestartConfirmation();
    this.ui.setOverlay('pause-overlay', false);
    if (this.resumeNeedsCountdown) {
      this.resumeNeedsCountdown = false;
      this.state.inputLocked = true;
      const sequenceId = ++this.startSequenceId;
      this.runStartCountdown(sequenceId);
      return;
    }
    playMusic();
  }

  requestRestart() {
    const now = performance.now();
    if (now <= this.restartConfirmUntil) {
      this.resetRestartConfirmation();
      this.start();
      return;
    }
    this.restartConfirmUntil = now + 2200;
    this.ui.setRestartConfirm(true);
    clearTimeout(this.restartConfirmTimer);
    this.restartConfirmTimer = window.setTimeout(() => this.resetRestartConfirmation(), 2200);
  }

  resetRestartConfirmation() {
    this.restartConfirmUntil = 0;
    clearTimeout(this.restartConfirmTimer);
    this.restartConfirmTimer = null;
    this.ui.setRestartConfirm(false);
  }

  async finish() {
    if (!this.state.running || this.finishing) return;
    this.finishing = true;
    this.finishPending = false;
    this.state.running = false;
    this.state.inputLocked = true;
    this.state.timeLeft = 0;
    this.freezeEndsAt = 0;
    this.frozenTimeLeft = 0;
    this.ui.setFreezeActive(false);
    this.stopTimer();
    this.input.cancel();
    this.tutorialActive = false;
    this.waitingForFirstDrag = false;
    this.ui.hideTutorial();
    this.ui.showMessage('시간 끝! 끝까지 멋졌다냥!');
    this.ui.setPlayCharacter(this.state.score >= 1200 ? 'success' : 'cheer');
    const oldBest = storageAdapter.getBestScore();
    const previousScore = storageAdapter.getLastScore();
    const newRecord = this.state.score > oldBest;
    this.telemetry?.finish(this.state, 'timer');
    fadeOutMusic();
    playGameOverSound();
    gameOverHaptic(newRecord);
    await this.ui.animateGameEnd({ score: this.state.score, maxCombo: this.state.maxCombo, newRecord });
    if (newRecord) storageAdapter.saveBestScore(this.state.score);
    this.ui.updateBestScore(Math.max(oldBest, this.state.score));
    this.lastResultSummary = {
      score: this.state.score,
      maxCombo: this.state.maxCombo,
      round: this.state.round,
      maxClearCells: this.state.maxClearCells,
      newRecord,
      previousBest: oldBest,
      previousScore,
    };
    this.ui.showResult(this.lastResultSummary);
    storageAdapter.saveRunScore(this.state.score);
    this.finishing = false;
  }

  goHome() {
    if (this.telemetry && !this.telemetry.closed) this.telemetry.finish(this.state, 'home');
    this.startSequenceId += 1;
    this.ui.cancelStartCountdown();
    this.startCountdownInProgress = false;
    this.resumeNeedsCountdown = false;
    this.resetRestartConfirmation();
    this.stopTimer();
    stopMusic();
    this.state.running = false;
    this.finishPending = false;
    this.finishing = false;
    this.freezeEndsAt = 0;
    this.frozenTimeLeft = 0;
    this.ui.setFreezeActive(false);
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
    const records = await rankingAdapter.open();
    this.ui.updateBestScore(storageAdapter.getBestScore());
    this.ui.renderRanking(records);
    this.ui.setOverlay('ranking-overlay', true);
  }

  async shareResult() {
    if (!this.lastResultSummary) return;
    const button = document.querySelector('#share-button');
    if (button?.disabled) return;
    if (button) button.disabled = true;
    const result = await shareAdapter.shareResult(this.lastResultSummary);
    if (button) button.disabled = false;
    if (result.ok && result.method === 'clipboard') this.ui.toast('점수와 링크를 복사했다냥!');
    else if (result.ok) this.ui.toast('공유창을 열었다냥!');
    else if (result.reason !== 'cancelled') this.ui.toast('이 브라우저에선 공유가 어렵다냥');
  }

  updateHUD() {
    const config = getRoundConfig(this.state.round);
    this.ui.updateHUD({
      ...this.state,
      rewardRemaining: itemRewardCountdown(this.state.combo),
      target: config.target,
      duration: this.runtime?.duration || GAME_DURATION_SECONDS,
      freezeRemaining: Math.max(0, (this.freezeEndsAt - performance.now()) / 1000),
    });
  }

  showCatMessage(type) {
    const message = pickMessage(type, this.lastCatMessage);
    this.lastCatMessage = message;
    const duration = ['itemDrop', 'lowTime', 'freeze', 'clover'].includes(type) ? 1800 : 1500;
    this.ui.showMessage(message, duration, type);
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
    getBoardItems: () => game.boardItems.snapshot(),
    findAnswer: () => game.model.findAnswer(),
    setCombo: (combo) => {
      game.state.combo = Math.max(0, Math.floor(Number(combo) || 0));
      game.state.comboExpiresAt = 0;
      game.updateHUD();
      return game.state.combo;
    },
    forceBoardItem: (type = 'bomb', row = 0, col = 0) => {
      if (!BOARD_DROP_ITEMS[type]?.implemented || !game.model.grid[row]?.[col]) return null;
      game.model.grid[row][col] = null;
      const item = game.boardItems.set(type, row, col, { earnedAtCombo: game.state.combo });
      game.renderBoard();
      return { ...item };
    },
    forceFreeze: (seconds = TIME_FREEZE_SECONDS) => {
      const timeline = freezeTimeline(performance.now(), game.state.timeLeft, seconds);
      game.freezeEndsAt = timeline.freezeEndsAt;
      game.frozenTimeLeft = timeline.frozenTimeLeft;
      game.endAt = timeline.endAt;
      game.ui.setFreezeActive(true);
      game.updateHUD();
      return game.freezeEndsAt;
    },
    setTimeLeft: (seconds = 3) => {
      game.state.timeLeft = Math.max(0, Number(seconds) || 0);
      game.endAt = performance.now() + game.state.timeLeft * 1000;
      game.updateHUD();
      return game.state.timeLeft;
    },
  };
}
