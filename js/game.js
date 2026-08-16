import {
  BOARD_DROP_ITEMS,
  FINAL_GESTURE_GRACE_MS,
  GAME_DURATION_SECONDS,
  ITEM_REWARD_INTERVAL,
  STAGE_TRANSITION_INPUT_GUARD_MS,
  START_COUNTDOWN_STEPS,
  TIME_FREEZE_SECONDS,
  TIME_ITEM_CAP_SCORE,
  availableItemTimeBonus,
  boardDropRewardForRun,
  buildResultReaction,
  cappedSessionTime,
  chooseBoardDrop,
  comboAfterIdle,
  comboAfterIncorrectSelection,
  comboGainForClear,
  comboMilestoneCrossed,
  comboWindowMsForStage,
  freezeTimeline,
  getRoundConfig,
  itemUnlockGrantForStage,
  itemRewardCountdown,
  nextBoardDropPity,
  pickMessage,
  rebasePausedTimeline,
  gardenRevealPercent,
  nextGardenRevealBest,
  recordEligibleForStartStage,
  roundTimeBonusSeconds,
  specialTilePlanForStage,
  successFeedbackLevel,
  stageShowcaseBoardDrop,
  stageIntroForStage,
  stageClearBonus,
  scoreForBomb,
  scoreForCatBonus,
  scoreForClear,
  scoreForClutch,
  scoreForCloverBonus,
  scoreForWideClear,
  scoreForMegaBomb,
  shouldOfferStruggleHint,
  shouldShowBeginnerAutoHint,
  shouldAdvanceRound,
  isWowClear,
} from './data.js';
import { BoardModel, boardAssistForPerformance } from './board.js';
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
  unlockMusic,
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
  isHapticSupported,
  itemHaptic,
  megaBombHaptic,
  roundHaptic,
  readyCountHaptic,
  selectionTick,
  setHapticEnabled,
  successHaptic,
} from './haptic.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RETRY_COUNTDOWN_STEPS = Object.freeze(['READY', 'GO!']);
// Drops worth taking the lead of a moment. Bomb and clock are the everyday
// rewards; these three are the ones a player should stop and look at.
// The garden only shows through from STAGE 3, so earlier boards cannot
// uncover any of it and must not count toward the reveal record.
const GARDEN_REVEAL_FIRST_STAGE = 3;

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
    this.activeGesture = false;
    this.finishGraceTimer = null;
    this.finishPending = false;
    this.finishing = false;
    this.selectionWasPerfect = false;
    this.telemetry = null;
    this.stageDuration = 0;
    this.retryStage = 1;
    this.runPreviousHighestStage = storageAdapter.getHighestStage();
    this.state = this.freshState();
    this.input = attachStickyRectangleInput({
      boardEl: this.ui.board,
      isEnabled: () => this.state.running
        && !this.state.paused
        && !this.state.inputLocked
        && performance.now() >= this.inputGuardUntil,
      onPreview: (rect, pointer) => this.preview(rect, pointer),
      onCommit: (rect) => {
        this.activeGesture = false;
        return this.commit(rect);
      },
      onCancel: () => {
        this.activeGesture = false;
        this.selectionWasPerfect = false;
        this.ui.clearSelection();
      },
      onSelectionStep: (rect) => {
        const stats = this.model.stats(rect);
        const isPerfect = stats.sum === 10;
        if (isPerfect !== this.selectionWasPerfect) {
          this.selectionWasPerfect = isPerfect;
          this.ui.selectionSnap(isPerfect);
          selectionTick(isPerfect);
        }
      },
      onPointerStart: () => {
        this.activeGesture = true;
        this.ui.clearSelection();
      },
      onTapAnchor: (cell) => {
        this.activeGesture = false;
        this.beginFirstInteraction();
        this.ui.showTapAnchor(cell);
        this.showCatMessage('tapEnd');
      },
      onTapAnchorExpired: () => {
        this.activeGesture = false;
        this.ui.clearSelection();
        if (this.tutorialActive && !storageAdapter.hasSeenDragTutorial()) this.maybeShowTutorial();
      },
    });
    this.bindEvents();
    this.applySettings();
    this.renderBoard();
    this.ui.updateBestScore(storageAdapter.getBestScore());
    this.ui.updateHighestStage(storageAdapter.getHighestStage());
    this.ui.updateCatsRescued(storageAdapter.getCatsRescued());
    this.ui.showScreen('home');
    schedulePlayAssetsPreload();
  }

  freshState(startStage = this.runtime?.forcedRound || 1, { recordEligible } = {}) {
    const stage = Math.max(1, Math.round(Number(startStage) || 1));
    const rareShowcaseCount = storageAdapter.getRareShowcaseCount();
    const eligible = typeof recordEligible === 'boolean'
      ? recordEligible
      : recordEligibleForStartStage(stage);
    return {
      running: false,
      paused: false,
      inputLocked: false,
      score: 0,
      combo: 0,
      maxCombo: 0,
      round: stage,
      startStage: stage,
      recordEligible: eligible,
      timeLeft: this.runtime?.duration || GAME_DURATION_SECONDS,
      comboExpiresAt: 0,
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      maxClearCells: 0,
      maxGardenReveal: 0,
      catsCollected: 0,
      catBonusScore: 0,
      cloverBoostPending: false,
      cloverBonusScore: 0,
      clutchBonusScore: 0,
      itemTimeBonusUsed: 0,
      boardDropsEarned: 0,
      boardDropPity: { megabomb: 0, clover: 0, freeze: 0 },
      lastBoardDropType: null,
      cloverDropped: false,
      stageShowcaseGiven: false,
      stageShowcaseEligible: this.runtime?.testMode || rareShowcaseCount < 3,
      stageShowcaseIndex: this.runtime?.testMode ? 0 : rareShowcaseCount,
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
    document.querySelector('#start-button').addEventListener('click', () => this.start(this.runtime.forcedRound || 1));
    document.querySelector('#retry-button').addEventListener('click', () => this.start(this.runtime.forcedRound || 1, { quickCountdown: true }));
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
      this.start(this.runtime.forcedRound || 1);
    });
    document.querySelector('#home-garden-button').addEventListener('click', () => this.openGarden());
    document.querySelector('#garden-close').addEventListener('click', () => this.ui.setOverlay('garden-overlay', false));
    document.querySelector('#garden-play-button').addEventListener('click', () => {
      this.ui.setOverlay('garden-overlay', false);
      this.start(this.runtime.forcedRound || 1);
    });
    const toggleSound = () => {
      this.settings.sound = !this.settings.sound;
      this.applySettings();
      if (this.settings.sound) unlockAudio();
    };
    document.querySelector('#sound-toggle').addEventListener('click', toggleSound);
    document.querySelector('#sound-button').addEventListener('click', toggleSound);
    const toggleMusic = async () => {
      if (!this.settings.music && this.settings.musicVolume <= 0) this.settings.musicVolume = 0.4;
      this.settings.music = !this.settings.music;
      this.applySettings();
      if (this.settings.music) await unlockMusic();
    };
    document.querySelector('#music-button').addEventListener('click', toggleMusic);
    document.querySelector('#music-toggle').addEventListener('click', toggleMusic);
    document.querySelector('#hud-music-button').addEventListener('click', toggleMusic);
    document.querySelector('#music-volume').addEventListener('input', (event) => {
      this.settings.musicVolume = Number(event.target.value) / 100;
      this.settings.music = this.settings.musicVolume > 0;
      this.applySettings();
      if (this.settings.music) unlockMusic();
    });
    document.querySelector('#haptic-toggle').addEventListener('click', () => {
      if (!isHapticSupported()) return;
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
    this.ui.updateSoundControls(isSoundEnabled());
    const hapticToggle = document.querySelector('#haptic-toggle');
    const hapticSupported = isHapticSupported();
    this.ui.updateToggle(hapticToggle, hapticSupported && isHapticEnabled());
    hapticToggle.disabled = !hapticSupported;
    hapticToggle.textContent = hapticSupported ? (isHapticEnabled() ? 'ON' : 'OFF') : '미지원';
    hapticToggle.setAttribute('aria-label', hapticSupported ? '진동 설정' : '이 브라우저는 진동을 지원하지 않음');
    this.ui.updateMusicControls(this.settings.music, this.settings.musicVolume);
  }

  async start(startStage = this.runtime?.forcedRound || 1, options = {}) {
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
    const musicReady = this.settings.music ? unlockMusic() : Promise.resolve(false);
    this.runPreviousHighestStage = storageAdapter.getHighestStage();
    this.inventory = createRunInventory();
    this.ui.resetItemAvailabilityHistory();
    this.state = this.freshState(startStage, options);
    this.retryStage = 1;
    this.stageDuration = this.runtime?.duration || GAME_DURATION_SECONDS;
    this.state.timeLeft = this.stageDuration;
    this.telemetry = new RunTelemetry({ viewport: { width: window.innerWidth, height: window.innerHeight } });
    this.boardItems.reset();
    this.itemTapCandidate = null;
    this.inputGuardUntil = 0;
    this.freezeEndsAt = 0;
    this.frozenTimeLeft = 0;
    this.ui.setFreezeActive(false);
    this.ui.updateItems({ ...this.state.items, stage: this.state.round, clockAvailable: this.stageDuration > 0 });
    this.state.running = true;
    this.state.inputLocked = true;
    this.lowTimeSpoken = false;
    this.beginnerAutoHintShown = false;
    this.lastInteractionAt = performance.now();
    this.activeResolution = false;
    this.activeGesture = false;
    clearTimeout(this.finishGraceTimer);
    this.finishGraceTimer = null;
    this.finishPending = false;
    this.finishing = false;
    this.lastCountdownSecond = null;
    this.waitingForFirstDrag = Boolean(this.runtime.forceTutorial || !storageAdapter.hasSeenDragTutorial());
    this.ui.setOverlay('pause-overlay', false);
    this.buildRound();
    this.forceTestBoardItem();
    this.ui.updateItems({ ...this.state.items, stage: this.state.round, clockAvailable: this.stageDuration > 0 });
    this.ui.showScreen('play');
    this.ui.setPlayCharacter('wave');
    this.showCatMessage('start');
    if (!this.settings.sound) this.ui.toast('설정에서 효과음을 ON으로 켜달라냥');
    preloadResultAssets();
    this.startCountdownInProgress = true;
    const [ready] = await Promise.all([audioReady, musicReady]);
    if (sequenceId !== this.startSequenceId || !this.state.running || this.state.paused) {
      if (sequenceId === this.startSequenceId) this.startCountdownInProgress = false;
      if (this.state.paused) this.resumeNeedsCountdown = true;
      return;
    }
    if (this.settings.sound && !ready) this.ui.toast('휴대폰의 미디어 소리를 확인해달라냥');
    await this.runStartCountdown(sequenceId, options.quickCountdown === true);
  }

  async runStartCountdown(sequenceId, quickCountdown = false) {
    this.startCountdownInProgress = true;
    const steps = quickCountdown ? RETRY_COUNTDOWN_STEPS : START_COUNTDOWN_STEPS;
    const completed = await this.ui.animateStartCountdown(steps, (step) => {
      if (step === 'GO!') {
        playGoSound();
        playMusic({ restart: true });
      }
      else playReadyCountSound(step);
      readyCountHaptic(step);
    }, { compact: quickCountdown });
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
      this.refreshComboDeadline();
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
    if (this.timer || !this.state.running || this.stageDuration <= 0) return;
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
    this.ui.hideTutorial();
    this.beginCountdown();
  }

  completeTutorial() {
    if (storageAdapter.hasSeenDragTutorial()) return;
    this.tutorialActive = false;
    this.waitingForFirstDrag = false;
    this.ui.hideTutorial();
    if (!this.runtime.testMode) storageAdapter.markDragTutorialSeen();
  }

  buildRound() {
    this.boardItems.carry();
    this.itemTapCandidate = null;
    const config = getRoundConfig(this.state.round);
    this.generateBoard(config.size, config.rows);
    this.model.assignSpecialTiles(specialTilePlanForStage(this.state.round));
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
      assist: boardAssistForPerformance({
        stage: this.state.round,
        successCount: this.state.successCount,
        failureCount: this.state.failureCount,
        maxCombo: this.state.maxCombo,
      }),
    });
    this.telemetry?.boardGenerated(this.model.findAnswers().length);
    return grid;
  }

  renderBoard(options = {}) {
    this.ui.renderBoard(this.model, this.boardItems.items, options);
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
    const previousMaxCombo = this.state.maxCombo;
    this.state.combo = previousCombo + Math.max(1, Math.round(Number(amount) || 1));
    this.refreshComboDeadline();
    this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
    if (!this.runtime.testMode) storageAdapter.saveBestCombo(this.state.maxCombo);
    // Each seven-combo boundary pays once per run; see boardDropRewardForRun
    // for why the step is measured from the run's high-water mark. The rule
    // is covered by regression tests in tests/board-items.test.mjs.
    const reward = boardDropRewardForRun({
      previousCombo,
      nextCombo: this.state.combo,
      bestComboBefore: previousMaxCombo,
    });
    let earnedDrop = null;
    if (reward && this.state.round >= 3) {
      const drop = chooseBoardDrop(this.state.combo, Math.random, {
        cloverGiven: this.state.cloverDropped,
        pity: this.state.boardDropPity,
        previousType: this.state.lastBoardDropType,
        rewardIndex: this.state.boardDropsEarned,
        stage: this.state.round,
        timeBonusCapped: availableItemTimeBonus(this.state.itemTimeBonusUsed, 1) <= 0,
      });
      if (drop) {
        earnedDrop = drop;
        this.boardItems.queue(drop.id, { earnedAtCombo: this.state.combo, reward });
        this.state.boardDropsEarned += 1;
        this.state.lastBoardDropType = drop.id;
        this.state.boardDropPity = nextBoardDropPity(this.state.boardDropPity, drop.id, {
          stage: this.state.round,
          combo: this.state.combo,
        });
        if (drop.id === 'clover') this.state.cloverDropped = true;
        this.telemetry?.itemEarned(drop.id);
      }
    }
    return { previousCombo, earnedDrop };
  }

  refreshComboDeadline(now = performance.now()) {
    this.state.comboExpiresAt = this.state.combo > 0
      ? now + comboWindowMsForStage(this.state.round)
      : 0;
  }

  announceBoardItems(items, { playSound = true } = {}) {
    this.ui.showBoardItemDrops(items);
    const showcase = items.find((item) => item.showcase);
    if (showcase) {
      const label = BOARD_DROP_ITEMS[showcase.type]?.label || '희귀 아이템';
      this.ui.showMessage(`${label} 등장이다냥! 톡 눌러봐.`, 2200, 'itemDrop');
    } else {
      this.showCatMessage('itemDrop');
    }
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
    this.selectionWasPerfect = false;
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
        this.telemetry?.selection({ correct: false, cellCount: stats.count, sum: stats.sum });
        await this.handleFailure(rect, stats);
      }
    } finally {
      this.activeResolution = false;
      if (this.finishPending) this.finish();
    }
  }

  // A second thing to chase besides the score, built from what the board
  // already knows: on the stages where the garden shows through, how much of
  // it did this run manage to uncover at once? Kept deliberately small — one
  // number per run and one personal best, no new screen.
  trackGardenReveal() {
    if (this.state.round < GARDEN_REVEAL_FIRST_STAGE) return;
    const cells = this.model.rows * this.model.cols;
    if (cells <= 0) return;
    const cleared = cells - this.model.remainingPlayableCells();
    const percent = gardenRevealPercent(cleared, cells);
    this.state.maxGardenReveal = nextGardenRevealBest(this.state.maxGardenReveal, percent);
  }

  async handleSuccess(rect, stats) {
    this.state.inputLocked = true;
    const specials = stats.specials || [];
    const bombSpecials = specials.filter(({ type }) => type === 'bomb');
    const blastCells = this.model.specialBombCells(bombSpecials, rect, 4);
    const blastValue = blastCells.reduce((sum, { r, c }) => sum + this.model.valueAt(r, c), 0);
    const catCount = stats.catCount || 0;
    const clearedCellCount = stats.count + catCount;
    const comboGain = comboGainForClear(clearedCellCount);
    const { previousCombo, earnedDrop } = this.advanceCombo(comboGain);
    const comboMilestone = comboMilestoneCrossed(previousCombo, this.state.combo);
    this.state.successCount += 1;
    this.state.consecutiveFailures = 0;
    this.state.maxClearCells = Math.max(this.state.maxClearCells, clearedCellCount);
    const clearPoints = scoreForClear(clearedCellCount, this.state.combo);
    const wideBonusPoints = scoreForWideClear(clearedCellCount, this.state.combo);
    const catBonusPoints = scoreForCatBonus(catCount, this.state.combo);
    const specialBonusPoints = blastCells.length ? scoreForBomb(blastValue, blastCells.length) : 0;
    const cloverBasePoints = clearPoints + wideBonusPoints + catBonusPoints + specialBonusPoints;
    const cloverBonusPoints = this.state.cloverBoostPending ? scoreForCloverBonus(cloverBasePoints) : 0;
    const clutchBonusPoints = this.freezeEndsAt > performance.now()
      ? 0
      : scoreForClutch(this.state.timeLeft, this.state.combo);
    this.state.cloverBoostPending = false;
    this.state.cloverBonusScore += cloverBonusPoints;
    this.state.clutchBonusScore += clutchBonusPoints;
    const points = clearPoints + wideBonusPoints + catBonusPoints + specialBonusPoints
      + cloverBonusPoints + clutchBonusPoints;
    this.state.score += points;
    this.state.catsCollected += catCount;
    this.state.catBonusScore += catBonusPoints;
    // Cells still on the board once this clear (and any bomb blast) is gone.
    // Emptying the board outright is the run's peak moment now that stages
    // have no target to hit, so it takes the top rank.
    const emptiesBoard = this.model.remainingPlayableCells() - clearedCellCount - blastCells.length <= 0;
    const wow = isWowClear(clearedCellCount);

    // One rank for the whole moment, so the celebrations stop competing.
    // Every system used to fire independently, which made the best clears the
    // busiest frames on screen — measured at nine simultaneous effects. The
    // rank decides who is the lead and who steps back; it never suppresses a
    // number, so score and combo keep updating in the HUD regardless.
    const successLevel = successFeedbackLevel({
      emptiesBoard,
      wow,
      earnedDrop,
      comboMilestone,
      catCount,
    });
    this.completeTutorial();
    successHaptic(this.state.combo);
    duckMusic(wow ? 560 : 390, wow ? 0.48 : 0.64);
    // playWideClearSound is a port of the original's WOW fanfare — a rising
    // three-chord arpeggio and a sparkle — so it fires on the same five-cell
    // threshold the original used, alongside the centred WOW! card.
    if (wow) {
      playWideClearSound();
      this.ui.showWowMoment();
    } else if (this.state.combo >= 2) playComboSound(this.state.combo);
    else playSuccessSound();
    if (catCount > 0) {
      const catSoundOffset = blastCells.length
        ? 0.36
        : wow ? 0.25 : 0.17;
      playCatBonusSound(catSoundOffset);
    }
    const scoreFeedback = () => this.ui.showScoreBurst(
      points,
      rect,
      { rows: this.model.rows, cols: this.model.cols },
      this.state.combo,
      clearedCellCount,
    );
    this.updateHUD();
    this.ui.pulseGoal(this.state.combo);
    this.speakForSuccess(catCount, wow, successLevel);
    if (cloverBonusPoints > 0) {
      this.showCatMessage('cloverSuccess');
    } else if (clutchBonusPoints > 0) {
      this.showCatMessage('clutch');
    }
    if (blastCells.length) {
      playBombSound();
      bombHaptic();
    }
    // "딱 10!" belongs to the quiet clears. From rank 3 up something louder
    // is already confirming the success over the same tiles.
    if (successLevel <= 2) this.ui.showMatchConfirmation(rect, this.state.combo);
    const successAnimation = this.ui.animateSuccess(rect, this.state.combo);
    const specialAnimation = this.ui.animateSpecialTiles(specials, blastCells);
    await delay(96);
    scoreFeedback();
    if (this.state.combo >= 2) {
      await delay(this.state.combo >= 5 ? 90 : 68);
      // The chip always punches — that is the combo's own escalation. The
      // banner across the board is held back for rank 3 and below, so a rare
      // item or a stage clear is never fighting a COMBO card for the centre.
      // `comboMilestone` is the same crossing check successLevel used, so
      // the banner and the rank can never disagree about this success.
      this.ui.showComboMoment(this.state.combo, { allowCelebration: successLevel <= 3, milestone: comboMilestone });
    }
    await Promise.all([successAnimation, specialAnimation]);
    this.model.remove(rect);
    if (blastCells.length) this.model.removeCells(blastCells);
    // Read after every cell from this success (including a bomb blast) is
    // actually gone, and before the board is rebuilt for the next stage —
    // this is the one moment the model reflects what the run just revealed.
    this.trackGardenReveal();
    if (this.finishPending) {
      this.renderBoard({ preserveScoreBurst: true });
      return;
    }

    const remainingAnswer = this.model.findAnswer();
    const perfect = this.model.remainingPlayableCells() === 0;
    if (shouldAdvanceRound({ hasAnswer: Boolean(remainingAnswer), boardEmpty: perfect })) {
      this.renderBoard({ preserveScoreBurst: true });
      if (comboMilestone) await delay(220);
      await this.clearRound({ perfect });
    } else {
      const placed = this.boardItems.place(this.model.grid, this.model.bonusCats);
      this.renderBoard({ preserveScoreBurst: true });
      if (placed.length) this.announceBoardItems(placed, { playSound: this.state.combo % ITEM_REWARD_INTERVAL !== 0 });
    }
    this.state.inputLocked = false;
    this.updateHUD();
  }

  addStageTime(seconds = 5) {
    if (this.stageDuration <= 0) return false;
    const amount = availableItemTimeBonus(this.state.itemTimeBonusUsed, seconds);
    const source = this.ui.board.querySelector('.tile.is-clock-triggered')
      || this.ui.board.querySelector('.tile[data-special="clock"]');
    const previousTime = this.state.timeLeft;
    this.state.timeLeft = cappedSessionTime(previousTime, amount);
    const gainedTime = this.state.timeLeft - previousTime;
    this.state.itemTimeBonusUsed += Math.min(amount, Math.max(0, gainedTime));
    if (this.freezeEndsAt > performance.now()) this.frozenTimeLeft = this.state.timeLeft;
    if (this.timer) this.endAt += gainedTime * 1000;
    this.lowTimeSpoken = this.state.timeLeft <= 10;
    this.updateHUD();
    if (source && gainedTime > 0) this.ui.animateClock(gainedTime, source);
    return gainedTime > 0;
  }

  async handleFailure(rect, stats = {}) {
    this.state.inputLocked = true;
    const previousCombo = this.state.combo;
    this.state.failureCount += 1;
    this.state.consecutiveFailures += 1;
    this.state.combo = comboAfterIncorrectSelection(previousCombo, stats.sum);
    this.refreshComboDeadline();
    failHaptic();
    playFailSound();
    this.updateHUD();
    if (previousCombo > this.state.combo) this.ui.showComboLoss(previousCombo - this.state.combo);
    this.showCatMessage(Math.abs((Number(stats.sum) || 0) - 10) === 1 ? 'nearMiss' : 'fail');
    this.ui.setPlayCharacter('fail', 700);
    await this.ui.animateFailure(rect);
    if (!this.tutorialActive && shouldOfferStruggleHint(this.state.round, this.state.consecutiveFailures)) {
      const answer = this.model.findEasyAnswer();
      if (answer) {
        this.state.consecutiveFailures = 0;
        this.telemetry?.hint('assist');
        this.ui.showHint(answer);
        this.ui.setPlayCharacter('wave', 1000);
        this.showCatMessage('struggleHint');
      }
    }
    if (this.tutorialActive && !storageAdapter.hasSeenDragTutorial()) {
      window.setTimeout(() => this.maybeShowTutorial(), 120);
    }
    this.state.inputLocked = false;
  }

  speakForSuccess(catCount = 0, wow = false, successLevel = 1) {
    // The cat used to have a line for literally every clear, which measured
    // at 3.67 message changes per success — it talked over the game instead
    // of reacting to it. It now speaks for moments with feeling behind them:
    // the first clear, a big or lucky one, the step before a reward, and the
    // combo milestones. An ordinary clear passes in silence, which is what
    // makes the next line worth reading.
    if (catCount > 0) {
      this.ui.setPlayCharacter('success', 950);
      this.showCatMessage('catBonus');
    } else if (wow) {
      this.ui.setPlayCharacter('success', 1000);
      this.showCatMessage('wow');
    } else if (this.state.successCount === 1) {
      this.ui.setPlayCharacter('success', 800);
      this.showCatMessage('firstSuccess');
    } else if (this.state.combo === 3) {
      this.ui.setPlayCharacter('cheer', 900);
      this.showCatMessage('combo3');
    } else if (this.state.round >= 3
      && this.state.combo > 0
      && this.state.combo % ITEM_REWARD_INTERVAL === ITEM_REWARD_INTERVAL - 1) {
      this.ui.setPlayCharacter('wave', 900);
      this.ui.previewItemReward();
      this.ui.showMessage('한 번만 더면 아이템 나온다냥!', 1700, 'rewardNear');
    } else if (this.state.combo === 5 || this.state.combo === 8) {
      this.ui.setPlayCharacter('success', 900);
      this.showCatMessage(this.state.combo >= 8 ? 'combo8' : 'combo5');
    } else if (successLevel >= 3) {
      // A milestone or a reward landed; a short line is earned.
      this.showCatMessage('success');
    }
  }

  async clearRound({ perfect = false } = {}) {
    this.state.inputLocked = true;
    this.telemetry?.roundCleared({ perfect });
    this.stopTimer();
    const clearedStage = this.state.round;
    const nextRound = clearedStage + 1;
    const clearedConfig = getRoundConfig(clearedStage);
    const nextConfig = getRoundConfig(nextRound);
    const timeBonus = roundTimeBonusSeconds(clearedStage);
    const awardedTimeBonus = Math.max(0, Math.round(cappedSessionTime(this.state.timeLeft, timeBonus) - this.state.timeLeft));
    const scoreBonus = stageClearBonus(clearedStage, this.state.timeLeft, perfect);
    this.state.score += scoreBonus;
    roundHaptic();
    duckMusic(680, 0.46);
    playRoundClearSound();
    this.ui.showRoundClear({
      scoreBonus,
      timeBonus: awardedTimeBonus,
      stage: clearedStage,
      nextStage: nextRound,
      rows: nextConfig.rows,
      cols: nextConfig.cols,
      boardGrew: nextConfig.rows !== clearedConfig.rows || nextConfig.cols !== clearedConfig.cols,
    });
    this.ui.setPlayCharacter('cheer', 1000);
    this.showCatMessage('stage');
    if (perfect) {
      this.grantItems({ hint: 1 }, { source: 'earned' });
      this.showCatMessage('perfect');
      this.ui.toast('PERFECT! 힌트 +1');
    }
    this.updateHUD();
    const [storedItems] = await Promise.all([
      this.storeRoundItems({ soundDelay: 260 }),
      delay(760),
    ]);
    this.state.round = nextRound;
    this.retryStage = nextRound;
    if (!this.runtime.testMode) storageAdapter.saveHighestStage(nextRound);
    this.ui.updateHighestStage(this.runtime.testMode ? nextRound : storageAdapter.getHighestStage());
    const unlockGrant = itemUnlockGrantForStage(nextRound);
    if (unlockGrant) this.grantItems(unlockGrant, { source: 'earned' });
    const showcaseDrop = this.state.stageShowcaseEligible
      ? stageShowcaseBoardDrop(
        nextRound,
        () => (Math.min(2, this.state.stageShowcaseIndex) + 0.5) / 3,
        this.state.stageShowcaseGiven,
      )
      : null;
    if (showcaseDrop) {
      this.boardItems.queue(showcaseDrop.id, { earnedAtCombo: this.state.combo, showcase: true });
      this.state.stageShowcaseGiven = true;
      if (!this.runtime.testMode) storageAdapter.markRareShowcaseSeen();
      this.state.lastBoardDropType = showcaseDrop.id;
      if (showcaseDrop.id === 'clover') this.state.cloverDropped = true;
      this.telemetry?.itemEarned(showcaseDrop.id);
    }
    this.state.timeLeft = cappedSessionTime(this.state.timeLeft, timeBonus);
    this.updateHUD();
    this.ui.showStageTimeBonus(awardedTimeBonus);
    if (this.state.timeLeft > 10) {
      this.lowTimeSpoken = false;
      this.lastCountdownSecond = null;
    }
    this.freezeEndsAt = 0;
    this.frozenTimeLeft = 0;
    this.ui.setFreezeActive(false);
    this.ui.updateItems({ ...this.state.items, stage: this.state.round, clockAvailable: this.stageDuration > 0 });
    let carriedItems = [];
    await this.ui.animateRoundTransition(nextRound, () => {
      carriedItems = this.buildRound();
    }, {
      ...stageIntroForStage(nextRound),
      boardGrew: nextConfig.rows !== clearedConfig.rows || nextConfig.cols !== clearedConfig.cols,
    });
    this.state.inputLocked = false;
    if (unlockGrant?.bomb) this.ui.toast('폭탄을 쓸 수 있게 됐다냥!');
    if (unlockGrant?.clock) this.ui.toast('시계 아이템이 열렸다냥!');
    if (storedItems.length) this.ui.toast('남은 아이템은 보관함에 챙겼다냥!');
    if (carriedItems.length) this.announceBoardItems(carriedItems);
    this.inputGuardUntil = performance.now() + STAGE_TRANSITION_INPUT_GUARD_MS;
    this.refreshComboDeadline(this.inputGuardUntil);
    this.ui.showRoundReady(360);
    this.beginCountdown();
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
    this.inputGuardUntil = performance.now() + 120;
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
    await delay(170);
    await this.ui.animateShuffleOut();
    this.renderBoard();
    await this.ui.animateShuffleIn();
    itemHaptic();
    await cast;
    this.inputGuardUntil = performance.now() + 280;
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
    this.ui.previewBombTarget(target.rect);
    const cast = this.ui.animateItemCast('bomb', center || this.ui.boardFrame);
    await delay(175);
    await this.resolveBomb({ ...target, stats: this.model.stats(target.rect) });
    await cast;
  }

  async resolveBomb({ rect, stats }, boardItemKey = null) {
    if (!this.ui.hasBombTargetPreview()) {
      this.ui.previewBombTarget(rect);
      await delay(130);
    }
    const catCount = Number(stats.catCount) || 0;
    const catBonusPoints = scoreForCatBonus(catCount, Math.max(1, this.state.combo));
    const points = scoreForBomb(stats.sum, stats.count) + catBonusPoints;
    this.state.score += points;
    this.state.catsCollected += catCount;
    this.state.catBonusScore += catBonusPoints;
    this.telemetry?.itemBlast({ type: 'bomb', cellCount: stats.count, catCount });
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
    const catCount = cells.reduce((count, cell) => count + (this.model.hasBonusCat(cell.r, cell.c) ? 1 : 0), 0);
    const catBonusPoints = scoreForCatBonus(catCount, Math.max(1, this.state.combo));
    const points = scoreForMegaBomb(stats.sum, stats.count) + catBonusPoints;
    this.state.score += points;
    this.state.catsCollected += catCount;
    this.state.catBonusScore += catBonusPoints;
    this.telemetry?.itemBlast({ type: 'megabomb', cellCount: stats.count, catCount });
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
    const remainingAnswer = this.model.findAnswer();
    const perfect = this.model.remainingPlayableCells() === 0;
    if (shouldAdvanceRound({ hasAnswer: Boolean(remainingAnswer), boardEmpty: perfect })) {
      this.renderBoard();
      await this.clearRound({ perfect });
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
    if (this.stageDuration <= 0) {
      this.ui.toast('시간 스테이지에서 쓸 수 있다냥!');
      return;
    }
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
    const previousTime = this.state.timeLeft;
    const requestedTime = availableItemTimeBonus(this.state.itemTimeBonusUsed, 5);
    if (requestedTime <= 0) {
      this.state.score += TIME_ITEM_CAP_SCORE;
      if (boardItemKey) {
        this.boardItems.delete(boardItemKey);
        this.renderBoard();
      }
      this.updateHUD();
      this.ui.toast(`시간 보너스 MAX · +${TIME_ITEM_CAP_SCORE}점`);
      this.inputGuardUntil = performance.now() + 100;
      this.state.inputLocked = false;
      return;
    }
    this.state.timeLeft = cappedSessionTime(previousTime, requestedTime);
    const gainedTime = this.state.timeLeft - previousTime;
    this.state.itemTimeBonusUsed += Math.min(requestedTime, Math.max(0, gainedTime));
    if (this.freezeEndsAt > now) this.frozenTimeLeft = this.state.timeLeft;
    if (this.timer) this.endAt += gainedTime * 1000;
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
    const animation = gainedTime > 0
      ? this.ui.animateClock(gainedTime, sourceElement, { urgent: previousTime <= 15 })
      : Promise.resolve();
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
    const freezeSeconds = availableItemTimeBonus(this.state.itemTimeBonusUsed, TIME_FREEZE_SECONDS);
    if (freezeSeconds <= 0) {
      this.state.score += TIME_ITEM_CAP_SCORE;
      this.boardItems.delete(boardItemKey);
      this.renderBoard();
      this.updateHUD();
      this.ui.toast(`시간 보너스 MAX · +${TIME_ITEM_CAP_SCORE}점`);
      this.inputGuardUntil = performance.now() + 80;
      this.state.inputLocked = false;
      return;
    }
    const timeline = freezeTimeline(now, currentTimeLeft, freezeSeconds);
    this.state.itemTimeBonusUsed += freezeSeconds;
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
    const animation = freezeSeconds > 0
      ? this.ui.animateFreeze(freezeSeconds, sourceElement)
      : Promise.resolve();
    this.boardItems.delete(boardItemKey);
    this.renderBoard();
    await animation;
    this.inputGuardUntil = performance.now() + 80;
    this.state.inputLocked = false;
  }

  async resolveClover(boardItemKey, sourceElement) {
    this.state.inputLocked = true;
    const answer = this.model.findAnswer();
    this.state.cloverBoostPending = true;
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
    return this.state.running
      && !this.state.paused
      && !this.state.inputLocked
      && performance.now() >= this.inputGuardUntil;
  }

  syncInventory() {
    this.state.items = this.inventory.snapshot();
    this.ui.updateItems({ ...this.state.items, stage: this.state.round, clockAvailable: this.stageDuration > 0 });
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
    if (!this.state.inputLocked
      && this.state.combo > 0
      && this.state.comboExpiresAt > 0
      && now >= this.state.comboExpiresAt) {
      const previousCombo = this.state.combo;
      this.state.combo = comboAfterIdle(previousCombo, this.state.round);
      this.refreshComboDeadline(now);
      if (previousCombo > this.state.combo) this.ui.showComboLoss(previousCombo - this.state.combo);
    }
    if (!this.startCountdownInProgress
      && !this.state.inputLocked
      && !isFrozen
      && this.state.timeLeft <= 10
      && !this.lowTimeSpoken) {
      // The cat says it once; the timer already turns red and pulses, and
      // the banner that used to appear here covered the clock itself.
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
    if (this.activeGesture) {
      this.finishPending = true;
      this.state.timeLeft = 0;
      this.stopTimer();
      this.updateHUD();
      clearTimeout(this.finishGraceTimer);
      this.finishGraceTimer = window.setTimeout(() => {
        this.finishGraceTimer = null;
        this.activeGesture = false;
        if (this.finishPending && !this.activeResolution) this.finish();
      }, FINAL_GESTURE_GRACE_MS);
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
      this.start(this.runtime?.forcedRound || 1);
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
    clearTimeout(this.finishGraceTimer);
    this.finishGraceTimer = null;
    this.activeGesture = false;
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
    const config = getRoundConfig(this.state.round);
    const endAnswers = this.model.findAnswers();
    this.ui.showMessage('이번 판 기록을 정리한다냥!', 1300, 'result');
    this.ui.setPlayCharacter(this.state.maxCombo >= 5 ? 'success' : 'cheer');
    const oldBest = storageAdapter.getBestScore();
    const previousScore = storageAdapter.getLastScore();
    const previousBestCombo = storageAdapter.getBestCombo();
    const previousHighestStage = this.runPreviousHighestStage;
    const recentScores = storageAdapter.getRecentScores();
    const recordEligible = this.state.recordEligible !== false;
    const newRecord = recordEligible && this.state.score > oldBest;
    const resultReaction = buildResultReaction({
      score: this.state.score,
      newRecord,
      previousBest: oldBest,
      previousScore,
      recentScores,
      maxCombo: this.state.maxCombo,
      previousBestCombo,
      round: this.state.round,
      previousHighestStage,
    }, {
      recentMessages: storageAdapter.getRecentResultMessages(),
    });
    this.telemetry?.finish(this.state, 'timer');
    fadeOutMusic();
    playGameOverSound(newRecord);
    gameOverHaptic(newRecord);
    await this.ui.animateGameEnd({ answers: endAnswers });
    if (!this.runtime.testMode && newRecord) storageAdapter.saveBestScore(this.state.score);
    if (!this.runtime.testMode && recordEligible) storageAdapter.saveBestCombo(this.state.maxCombo);
    if (!this.runtime.testMode) storageAdapter.saveHighestStage(this.state.round);
    // Rescued cats accumulate across runs — the result card's per-run count
    // reads as part of a growing collection instead of a number that
    // evaporates when the screen closes.
    const catsRescuedTotal = this.runtime.testMode
      ? this.state.catsCollected
      : storageAdapter.addCatsRescued(this.state.catsCollected);
    // The garden reveal is the run's second scoreboard. Capture the previous
    // best before saving so the result card can tell the player they beat it.
    const gardenReveal = Math.max(0, Math.round(this.state.maxGardenReveal || 0));
    const previousGardenBest = storageAdapter.getBestGardenReveal();
    if (!this.runtime.testMode && gardenReveal > 0) storageAdapter.saveBestGardenReveal(gardenReveal);
    this.ui.updateBestScore(recordEligible ? Math.max(oldBest, this.state.score) : oldBest);
    this.ui.updateCatsRescued(catsRescuedTotal);
    this.lastResultSummary = {
      score: this.state.score,
      maxCombo: this.state.maxCombo,
      round: this.state.round,
      successCount: this.state.successCount,
      maxClearCells: this.state.maxClearCells,
      catsCollected: this.state.catsCollected,
      catsRescuedTotal,
      gardenReveal,
      gardenRevealRecord: gardenReveal > 0 && gardenReveal > previousGardenBest,
      newRecord,
      previousBest: oldBest,
      previousScore,
      recordEligible,
      resultMessage: resultReaction.message,
    };
    this.retryStage = 1;
    this.ui.showResult(this.lastResultSummary);
    if (!this.runtime.testMode && recordEligible) {
      storageAdapter.saveRunScore(this.state.score);
      storageAdapter.rememberResultMessage(resultReaction.message);
    }
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
    this.ui.updateHighestStage(storageAdapter.getHighestStage());
    this.ui.showScreen('home');
  }

  async openRanking() {
    const records = await rankingAdapter.open();
    this.ui.updateBestScore(storageAdapter.getBestScore());
    this.ui.renderRanking(records);
    this.ui.updateCatsRescued(storageAdapter.getCatsRescued());
    this.ui.setOverlay('ranking-overlay', true);
  }

  openGarden() {
    const total = storageAdapter.getCatsRescued();
    this.ui.updateCatsRescued(total);
    this.ui.renderGarden(total, storageAdapter.getBestGardenReveal());
    this.ui.setOverlay('garden-overlay', true);
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
    const comboWindowMs = comboWindowMsForStage(this.state.round);
    this.ui.updateHUD({
      ...this.state,
      rewardRemaining: itemRewardCountdown(this.state.combo, this.state.round),
      comboRemainingMs: this.state.combo > 0
        ? Math.max(0, this.state.comboExpiresAt - performance.now())
        : 0,
      comboWindowMs,
      duration: this.stageDuration,
      timed: this.stageDuration > 0,
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
    startImmediate: async (stage = 1) => {
      const countdown = game.ui.animateStartCountdown;
      game.ui.animateStartCountdown = async (_steps, onStep = () => {}) => {
        onStep('GO!');
        return true;
      };
      try {
        await game.start(stage);
      } finally {
        game.ui.animateStartCountdown = countdown;
      }
      return structuredClone(game.state);
    },
    getState: () => structuredClone(game.state),
    getBoard: () => game.model.grid.map((row) => row.slice()),
    getBoardItems: () => game.boardItems.snapshot(),
    findAnswer: () => game.model.findAnswer(),
    findAnswers: () => game.model.findAnswers(),
    setCombo: (combo) => {
      game.state.combo = Math.max(0, Math.floor(Number(combo) || 0));
      game.refreshComboDeadline();
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
    finish: () => game.finish(),
    setStage: (stage = 1) => {
      game.stopTimer();
      game.state.round = Math.max(1, Math.floor(Number(stage) || 1));
      game.buildRound();
      game.state.inputLocked = false;
      game.beginCountdown();
      return game.state.round;
    },
    commit: (rect) => game.commit(rect),
  };
}
