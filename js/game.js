import {
  BOARD_DROP_ITEMS,
  GAME_DURATION_SECONDS,
  COMBO_WINDOW_MS,
  START_COUNTDOWN_STEPS,
  boardDropInventoryGrant,
  boardDropReward,
  chooseBoardDrop,
  getRoundConfig,
  pickMessage,
  scoreForBomb,
  scoreForCatBonus,
  scoreForClear,
  scoreForMegaBomb,
} from './data.js';
import { BoardModel } from './board.js';
import { BoardItemField } from './board-items.js';
import { createRunInventory } from './inventory.js';
import { attachStickyRectangleInput } from './input.js';
import { GameUI } from './ui.js';
import { storageAdapter, rankingAdapter, shareAdapter, runtimeConfig, useFutureItem } from './adapters.js';
import { preloadResultAssets, schedulePlayAssetsPreload } from './preload.js';
import {
  isSoundEnabled,
  playComboSound,
  playCatBonusSound,
  playItemCollectSound,
  playItemDropSound,
  playBombSound,
  playClockSound,
  playCountdownTick,
  playFailSound,
  playGameOverSound,
  playHintSound,
  playRoundClearSound,
  playShuffleSound,
  playSuccessSound,
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
const EARLY_ASSIST_SUCCESSES = 5;

class OingGame {
  constructor() {
    this.ui = new GameUI();
    this.model = new BoardModel(4);
    this.runtime = runtimeConfig();
    this.settings = storageAdapter.getSettings();
    this.inventory = createRunInventory();
    this.boardItems = new BoardItemField();
    this.itemTapCandidate = null;
    this.timer = null;
    this.endAt = 0;
    this.pauseStartedAt = 0;
    this.lowTimeSpoken = false;
    this.lastCountdownSecond = null;
    this.inputGuardUntil = 0;
    this.tutorialActive = false;
    this.waitingForFirstDrag = false;
    this.lastCatMessage = '';
    this.lastResultSummary = null;
    this.startSequenceId = 0;
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
      round: 1,
      progress: 0,
      timeLeft: this.runtime?.duration || GAME_DURATION_SECONDS,
      comboExpiresAt: 0,
      successCount: 0,
      maxClearCells: 0,
      catsCollected: 0,
      catBonusScore: 0,
      boardDropsEarned: 0,
      items: this.inventory.snapshot(),
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

  async start() {
    this.stopTimer();
    const sequenceId = ++this.startSequenceId;
    this.ui.cancelStartCountdown();
    const audioReady = this.settings.sound ? unlockAudio() : Promise.resolve(false);
    this.inventory = createRunInventory();
    this.state = this.freshState();
    this.boardItems.reset();
    this.itemTapCandidate = null;
    this.inputGuardUntil = 0;
    this.state.running = true;
    this.state.inputLocked = true;
    this.lowTimeSpoken = false;
    this.lastCountdownSecond = null;
    this.waitingForFirstDrag = Boolean(this.runtime.forceTutorial || !storageAdapter.hasSeenDragTutorial());
    this.ui.setOverlay('pause-overlay', false);
    this.buildRound();
    this.ui.updateItems(this.state.items);
    this.ui.showScreen('play');
    this.ui.setPlayCharacter('idle');
    this.showCatMessage('start');
    if (!this.settings.sound) this.ui.toast('설정에서 효과음을 ON으로 켜달라냥');
    preloadResultAssets();
    const ready = await audioReady;
    if (this.settings.sound && !ready) this.ui.toast('휴대폰의 미디어 소리를 확인해달라냥');
    const completed = await this.ui.animateStartCountdown(START_COUNTDOWN_STEPS, (step) => {
      if (step === 'GO!') playGoSound();
      else playReadyCountSound(step);
      readyCountHaptic(step);
    });
    if (!completed || sequenceId !== this.startSequenceId || !this.state.running) return;
    this.state.inputLocked = false;
    this.inputGuardUntil = performance.now() + 100;
    if (this.waitingForFirstDrag) window.setTimeout(() => this.maybeShowTutorial(), 120);
    else this.beginCountdown();
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
    this.boardItems.carry();
    this.itemTapCandidate = null;
    const config = getRoundConfig(this.state.round);
    this.generateBoard(config.size);
    this.renderBoard();
    this.updateHUD();
  }

  generateBoard(size) {
    return this.model.generate(size, { easy: this.state.successCount < EARLY_ASSIST_SUCCESSES });
  }

  renderBoard() {
    this.ui.renderBoard(this.model, this.boardItems.items);
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

  advanceCombo() {
    const now = performance.now();
    const previousCombo = this.state.combo > 0 && this.state.comboExpiresAt >= now
      ? this.state.combo
      : 0;
    this.state.combo = previousCombo + 1;
    this.state.comboExpiresAt = now + COMBO_WINDOW_MS;
    this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
    const reward = boardDropReward(previousCombo, this.state.combo, this.state.boardDropsEarned);
    if (reward) {
      const drop = reward === 'starter'
        ? BOARD_DROP_ITEMS.bomb
        : chooseBoardDrop(this.state.combo);
      if (drop) {
        this.boardItems.queue(drop.id, { earnedAtCombo: this.state.combo, reward });
        this.state.boardDropsEarned += 1;
      }
    }
    return previousCombo;
  }

  announceBoardItems(items) {
    this.ui.showBoardItemDrops(items);
    this.showCatMessage('itemDrop');
    this.ui.setPlayCharacter('wave', 1000);
    playItemDropSound();
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
    if (stats.sum === 10) await this.handleSuccess(rect, stats);
    else await this.handleFailure(rect);
  }

  async handleSuccess(rect, stats) {
    this.state.inputLocked = true;
    this.advanceCombo();
    this.state.successCount += 1;
    this.state.maxClearCells = Math.max(this.state.maxClearCells, stats.count);
    const clearPoints = scoreForClear(stats.count, this.state.combo);
    const catCount = stats.catCount || 0;
    const catBonusPoints = scoreForCatBonus(catCount, this.state.combo);
    const points = clearPoints + catBonusPoints;
    this.state.score += points;
    this.state.catsCollected += catCount;
    this.state.catBonusScore += catBonusPoints;
    this.state.progress += 1;
    successHaptic(this.state.combo);
    if (this.state.combo >= 2) playComboSound(this.state.combo);
    else playSuccessSound();
    if (catCount > 0) playCatBonusSound();
    if ([3, 5, 8].includes(this.state.combo)) {
      this.ui.showComboMoment(this.state.combo);
    }
    this.ui.showScoreBurst(points, rect, this.model.size, this.state.combo, stats.count, {
      catCount,
      catBonusPoints,
    });
    if (catCount > 0) this.ui.showCatBonus(catBonusPoints, rect, catCount);
    this.updateHUD();
    this.ui.pulseGoal(this.state.combo);
    this.speakForSuccess(catCount);
    if (this.state.boardDropsEarned === 0 && this.state.combo === 1) {
      window.setTimeout(() => {
        if (this.state.running && !this.state.paused && this.state.boardDropsEarned === 0) {
          this.ui.showItemTease('bomb');
        }
      }, catCount > 0 ? 500 : 300);
    }

    await this.ui.animateSuccess(rect, this.state.combo);
    this.model.remove(rect);

    const config = getRoundConfig(this.state.round);
    if (this.state.progress >= config.target) {
      this.renderBoard();
      if ([3, 5, 8].includes(this.state.combo)) await delay(220);
      await this.clearRound();
    } else if (!this.model.findAnswer()) {
      this.boardItems.carry();
      this.generateBoard(config.size);
      this.renderBoard();
      this.ui.toast('새 보드로 바로 이어갈게!');
    } else {
      const placed = this.boardItems.place(this.model.grid, this.model.bonusCats);
      this.renderBoard();
      if (placed.length) this.announceBoardItems(placed);
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

  speakForSuccess(catCount = 0) {
    if (catCount > 0) {
      this.ui.setPlayCharacter('success', 950);
      this.showCatMessage('catBonus');
    } else if (this.state.successCount === 1) {
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

  async useHint() {
    if (!this.canUseItem() || !this.inventory.canConsume('hint')) return;
    this.beginFirstInteraction();
    const answer = this.model.findEasyAnswer();
    if (!answer) {
      this.buildRound();
      this.ui.toast('가능한 보드를 준비했어!');
      return;
    }
    if (!this.inventory.consume('hint').ok) return;
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
    playHintSound();
    itemHaptic();
    await cast;
    this.inputGuardUntil = performance.now() + 80;
    this.state.inputLocked = false;
  }

  async useShuffle() {
    if (!this.canUseItem() || !this.inventory.canConsume('shuffle')) return;
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
    this.syncInventory();
    this.showCatMessage('shuffle');
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
    const previousCombo = this.advanceCombo();
    const points = scoreForBomb(stats.sum);
    this.state.score += points;
    this.updateHUD();
    this.ui.showItemScoreBurst(points, rect, 'bomb');
    this.showCatMessage('bomb');
    this.ui.setPlayCharacter(this.state.combo >= 3 ? 'cheer' : 'success', 950);
    playBombSound();
    bombHaptic();
    if ([3, 5, 8].includes(this.state.combo) && this.state.combo !== previousCombo) {
      this.ui.showComboMoment(this.state.combo);
      playComboSound(this.state.combo);
    }

    await this.ui.animateBomb(rect);
    this.model.remove(rect);
    this.finishBlast(boardItemKey);
  }

  async resolveMegaBomb({ row, col, rect, cells, stats }, boardItemKey) {
    const previousCombo = this.advanceCombo();
    const points = scoreForMegaBomb(stats.sum);
    this.state.score += points;
    this.updateHUD();
    this.ui.showItemScoreBurst(points, rect, 'megabomb');
    this.showCatMessage('megabomb');
    this.ui.setPlayCharacter('success', 1100);
    playMegaBombSound();
    megaBombHaptic();
    if ([3, 5, 8].includes(this.state.combo) && this.state.combo !== previousCombo) {
      this.ui.showComboMoment(this.state.combo);
      playComboSound(this.state.combo);
    }

    await this.ui.animateMegaBomb(cells, { row, col });
    this.model.removeCells(cells);
    this.finishBlast(boardItemKey);
  }

  finishBlast(boardItemKey = null) {
    if (boardItemKey) this.boardItems.delete(boardItemKey);
    const config = getRoundConfig(this.state.round);
    if (!this.model.findAnswer()) {
      this.boardItems.carry();
      this.generateBoard(config.size);
      this.renderBoard();
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
    this.beginFirstInteraction();
    if (!this.inventory.consume('clock').ok) return;
    this.syncInventory();
    await this.resolveClock();
  }

  async resolveClock(boardItemKey = null, sourceElement = this.ui.elements.clockButton) {
    this.state.inputLocked = true;
    this.state.timeLeft = Math.min(999, this.state.timeLeft + 8);
    if (this.timer) this.endAt += 8000;
    if (this.state.timeLeft > 10) {
      this.lowTimeSpoken = false;
      this.lastCountdownSecond = null;
    }
    this.updateHUD();
    this.showCatMessage('clock');
    this.ui.setPlayCharacter('cheer', 900);
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

  async useBoardItem(key) {
    if (!this.canUseItem()) return;
    const item = this.boardItems.get(key);
    if (!item || !BOARD_DROP_ITEMS[item.type]?.implemented) return;
    this.beginFirstInteraction();
    this.input.cancel();
    this.state.inputLocked = true;
    const grant = boardDropInventoryGrant(item.type);
    if (grant) {
      const sourceElement = this.ui.tileAt(item.row, item.col);
      await this.ui.animateItemCollect(item, sourceElement);
      const granted = this.inventory.grant(grant.itemId, grant.quantity, { source: 'earned' });
      if (!granted.ok) {
        this.state.inputLocked = false;
        this.ui.toast('아이템을 담지 못했다냥');
        return;
      }
      this.boardItems.delete(key);
      this.renderBoard();
      this.syncInventory();
      this.showCatMessage(item.type === 'clock' ? 'clockCollected' : 'bombCollected');
      this.ui.setPlayCharacter('wave', 900);
      playItemCollectSound();
      itemHaptic();
      this.inputGuardUntil = performance.now() + 120;
      this.state.inputLocked = false;
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
      if (countdownSecond <= 3) this.ui.showFinalSecond(countdownSecond);
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
    this.ui.showMessage('시간 끝! 끝까지 멋졌다냥!');
    this.ui.setPlayCharacter(this.state.score >= 1200 ? 'success' : 'cheer');
    playGameOverSound();
    await this.ui.animateGameEnd({ score: this.state.score, maxCombo: this.state.maxCombo });
    const oldBest = storageAdapter.getBestScore();
    const previousScore = storageAdapter.getLastScore();
    const newRecord = this.state.score > oldBest;
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
  }

  goHome() {
    this.startSequenceId += 1;
    this.ui.cancelStartCountdown();
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
    getBoardItems: () => game.boardItems.snapshot(),
    findAnswer: () => game.model.findAnswer(),
    setCombo: (combo) => {
      game.state.combo = Math.max(0, Math.floor(Number(combo) || 0));
      game.state.comboExpiresAt = performance.now() + COMBO_WINDOW_MS;
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
  };
}
