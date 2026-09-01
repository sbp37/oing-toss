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
  buildClassicResultReaction,
  cappedSessionTime,
  chooseBoardDrop,
  classicBoardChangeSeconds,
  classicBoardForIndex,
  classicBoardRuleForIndex,
  classicRefundWithFatigue,
  CLASSIC_REFUND_FATIGUE,
  classicChapterArtUrl,
  classicChapterCollected,
  classicChapterForBoard,
  classicChapterGallery,
  nextGoalLine,
  oingCardRows,
  newlyUnlockedOingCards,
  unseenRareBoardItemTypes,
  RARE_BOARD_ITEM_INTROS,
  CLASSIC_CHAPTERS,
  CLASSIC_THIN_BOARD_ANSWERS,
  CLASSIC_THIN_BOARD_MAX_FILL,
  OING_CARDS,
  classicComboAfterFailure,
  classicComboGain,
  classicDropStage,
  classicRoundForBoard,
  classicScoreForBlast,
  classicScoreForClear,
  classicStartBoardIndex,
  classicTimeAfterBoardChange,
  comboAfterIdle,
  comboAfterIncorrectSelection,
  comboGainForClear,
  comboMilestoneCrossed,
  comboWindowMsForStage,
  freezeTimeline,
  getRoundConfig,
  itemUnlockGrantForStage,
  itemRewardStatus,
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
  shouldShowClassicAutoHint,
  shouldShowClassicSparseHint,
  stageEndDecision,
  normalClearThresholdForStage,
  isWowClear,
  isNiceClear,
  AD_CONTINUE_OFFER_MS,
  AD_CONTINUE_SECONDS,
  AD_HELP_PACK,
  AD_HELP_PACK_MIN_SECONDS,
  candyForRun,
  CANDY_STARTER_MINIMUM,
} from './data.js';
import { adReady, adsAvailable, onAdReadyChange, preloadAd, showAd } from './ads.js';
import { installCandyFeeding } from './candy.js';
import { SHARE_REWARD_MODULE_ID } from './data.js';
import { challengeScore, clearChallengeIfWon, isFreshChallenge, markChallengeSeen, receiveChallenge } from './challenge.js';
import {
  BoardModel, answerReadabilityClass, boardAssistForPerformance, closestReadableAnswer,
} from './board.js';
import { BoardItemField } from './board-items.js';
import { createRunInventory } from './inventory.js';
import { attachStickyRectangleInput } from './input.js';
import { GameUI } from './ui.js';
import { storageAdapter, rankingAdapter, shareAdapter, runtimeConfig, useFutureItem } from './adapters.js';
import { gameLeaderboardAdapter } from './leaderboard.js';
import { OingLeaderboardView, oingOnlineAdapter } from './oing-online.js';
import { RunTelemetry, clearTelemetryRuns, getLocalTelemetrySummary, readTelemetryRuns } from './telemetry.js';
import { preloadPlayAssets, preloadResultAssets, schedulePlayAssetsPreload } from './preload.js';
import { installBackNavigation, pauseFamilyOpen } from './navigation.js';
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
  playTimeWarnBeeps,
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
  finalRushHaptic,
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

// 시작 커튼은 오디오 언락을 가리려고 첫 숫자를 미리 띄워둔다. 그 기다림에
// 상한이 없어서, 첫 접속처럼 언락이 느린 판에서는 "3"이 멈춰 있다가
// 카운트다운이 처음부터 다시 도는 것처럼 보였다(실기기 제보). 상한을 두고,
// 미리 띄운 숫자가 제 박자를 이미 채웠으면 그 다음 숫자부터 이어간다.
const COUNTDOWN_AUDIO_WAIT_CAP_MS = 900;
// 미리 띄운 첫 박이 한 박을 채웠는지 재는 기준.
const COUNTDOWN_BEAT_MS = Object.freeze({ normal: 650, compact: 420 });
// 재시작은 짧게 두 박이다. 판을 또 하려고 누른 사람에게 3·2·1을 매번
// 다시 세게 하면 그것이 벌이 된다. 다만 글씨와 색은 첫 시작과 같다 -
// 실기기 제보: "레디 고는 맘에 드는데 폰트랑 컬러를 첫 시작이랑 맞춰줘."
const RETRY_COUNTDOWN_STEPS = Object.freeze(['READY', 'GO!']);
// Drops worth taking the lead of a moment. Bomb and clock are the everyday
// rewards; these three are the ones a player should stop and look at.
// The garden only shows through from STAGE 3, so earlier boards cannot
// uncover any of it and must not count toward the reveal record.
const GARDEN_REVEAL_FIRST_STAGE = 3;

// A thumb rolls while it presses; anything under this is still a tap.
const ITEM_TAP_SLOP = 18;

// 잠금·입력 가드 동안 눌린 아이템 탭을 들고 있는 창. 폭탄 한 번이 터지고
// (연출 약 0.5초) 그 뒤 가드 180ms까지 지나야 다음 탭이 실행 가능해지므로,
// 그보다 넉넉해야 연타가 살아난다. 이 창을 넘기면 사용자가 이미 다른 것을
// 보고 있다고 보고 조용히 버린다. 판이 바뀌면 창과 무관하게 버린다.
const BOARD_ITEM_TAP_GRACE_MS = 1500;

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
    this.pendingBoardItemTap = null;
    this.timer = null;
    this.endAt = 0;
    this.freezeEndsAt = 0;
    this.frozenTimeLeft = 0;
    this.pauseStartedAt = 0;
    this.lowTimeSpoken = false;
    this.timeWarned = false;
    this.lastCountdownSecond = null;
    this.inputGuardUntil = 0;
    this.tutorialActive = false;
    this.waitingForFirstDrag = false;
    this.lastCatMessage = '';
    this.lastResultSummary = null;
    this.startSequenceId = 0;
    this.runId = 0;
    this.activeRunId = 0;
    this.activeOnlineRunId = '';
    this.oingOnline = oingOnlineAdapter;
    this.oingLeaderboardView = new OingLeaderboardView(document.querySelector('#online-ranking-overlay'));
    this.oingLeaderboardView.onModeChange = () => this.refreshOingLeaderboard();
    this.oingLeaderboardView.onFriendToggle = (entry) => this.toggleOingFriend(entry);
    this.startCountdownInProgress = false;
    this.resumeNeedsCountdown = false;
    this.activePauseOverlay = 'pause-overlay';
    this.restartConfirmUntil = 0;
    this.restartConfirmTimer = null;
    this.lastInteractionAt = performance.now();
    this.beginnerAutoHintShown = false;
    this.classicAutoHints = 0;
    this.classicAutoHintAt = -Infinity;
    this.openingGiftShown = false;
    this.classicSparseHintBoard = -1;
    this.classicAutoHintBoard = -1;
    this.adContinueUsed = false;
    this.adContinueOffering = false;
    this.adStampedTimeUp = false;
    this.adHelpPackUsed = false;
    this.adShowing = false;
    this.adFlowActive = false;
    this.adRefillShowing = false;
    this.pendingShareHints = 0;
    this.inviteOpening = false;
    // 친구 초대 버튼은 토스 안 + 모듈 ID가 있을 때만 존재한다.
    const inviteButton = document.querySelector('#result-invite-button');
    if (inviteButton) {
      inviteButton.hidden = !(SHARE_REWARD_MODULE_ID && gameLeaderboardAdapter.isTossEnvironment());
    }
    this.activeResolution = false;
    this.activeGesture = false;
    this.finishGraceTimer = null;
    this.finishPending = false;
    this.finishing = false;
    this.selectionWasPerfect = false;
    this.telemetry = null;
    this.stageDuration = 0;
    this.classic = null;
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
        // 손을 댄 순간이 "마지막 조작"이다. 이 갱신이 없어서 idleMs가 사실은
        // "마지막 힌트 이후 시간"이었고, 열심히 지우는 중에도 힌트가 떴다.
        this.lastInteractionAt = performance.now();
        // A hint has finished its job as soon as the player acts. Leaving it
        // under the live sum marquee showed two competing answers at once.
        this.ui.clearHint();
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
    this.configureGameLeaderboard();
    this.applySettings();
    this.renderBoard();
    this.refreshClassicRecordSurfaces();
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
      // 도감 카드가 보는 값들. 한 판 동안 세었다가 판이 끝날 때 평생 누적에
      // 더한다 - 판 중간에 저장하면 앱이 죽었을 때 반만 쌓인 값이 남는다.
      bigClears: 0,
      cellsCleared: 0,
      maxGardenReveal: 0,
      rescueShuffles: 0,
      stageRescues: 0,
      normalClears: 0,
      stageNormalClears: 0,
      stageBombUsed: false,
      initialPlayableCells: 0,
      cleanClears: 0,
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
      document.querySelector('#garden-play-button'),
    ].filter(Boolean);
    const primePlay = () => { preloadPlayAssets({ urgent: true }); };
    playButtons.forEach((button) => {
      button.addEventListener('pointerdown', primePlay, { passive: true });
      button.addEventListener('pointerenter', primePlay, { passive: true, once: true });
      button.addEventListener('focus', primePlay, { passive: true, once: true });
    });
    // Classic is the only mode reachable from the UI now — every "play"
    // entry point launches it. The stage ladder stays in the codebase (test
    // harness, tests/) but nothing on screen starts it any more.
    document.querySelector('#start-button').addEventListener('click', () => this.start(1, { classic: true }));
    document.querySelector('#retry-button').addEventListener('click', () => this.startCurrentMode({ quickCountdown: true }));
    document.querySelector('#restart-button').addEventListener('click', () => this.requestRestart());
    document.querySelector('#home-button').addEventListener('click', () => this.goHome());
    document.querySelector('#pause-button').addEventListener('click', () => this.pause());
    document.querySelector('#resume-button').addEventListener('click', () => this.resume());
    document.querySelector('#play-help-button').addEventListener('click', () => this.openHelp());
    document.querySelector('#help-close').addEventListener('click', () => this.resume());
    document.querySelector('#help-resume-button').addEventListener('click', () => this.resume());
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
    document.querySelector('#record-tab-stats')?.addEventListener('click', () => this.ui.setRecordTab('stats'));
    document.querySelector('#record-tab-cards')?.addEventListener('click', () => this.ui.setRecordTab('cards'));
    document.querySelector('#home-ranking-button').addEventListener('click', () => this.openRanking());
    document.querySelector('#home-leaderboard-button').addEventListener('click', () => this.openOingLeaderboard());
    document.querySelector('#result-leaderboard-button')?.addEventListener('click', () => this.openOingLeaderboard());
    document.querySelector('#result-invite-button')?.addEventListener('click', () => this.openContactsInviteReward());
    document.querySelector('#result-ranking-button').addEventListener('click', () => this.openRanking());
    document.querySelector('#share-button').addEventListener('click', () => this.shareResult());
    document.querySelector('#ranking-close').addEventListener('click', () => {
      this.ui.setOverlay('ranking-overlay', false);
      this.setResultTucked(false);
    });
    document.querySelector('#ranking-play-button').addEventListener('click', () => {
      this.ui.setOverlay('ranking-overlay', false);
      this.setResultTucked(false);
      this.start(1, { classic: true });
    });
    document.querySelector('#online-ranking-close')?.addEventListener('click', () => {
      this.ui.setOverlay('online-ranking-overlay', false);
      this.setResultTucked(false);
    });
    document.querySelector('#oing-native-rank-button')?.addEventListener('click', () => this.openGameLeaderboard());
    document.querySelector('#oing-my-rank-previous')?.addEventListener('click', () => {
      this.ui.setOverlay('online-ranking-overlay', false);
      this.openRanking();
    });
    document.querySelector('#home-garden-button').addEventListener('click', () => this.openGarden());
    document.querySelector('#garden-close').addEventListener('click', () => this.ui.setOverlay('garden-overlay', false));
    document.querySelector('#chapter-viewer-close').addEventListener('click', () => this.ui.setOverlay('chapter-viewer', false));
    document.querySelector('#chapter-viewer-share')?.addEventListener('click', () => this.shareChapter());
    document.querySelector('#garden-play-button').addEventListener('click', () => {
      this.ui.setOverlay('garden-overlay', false);
      this.start(1, { classic: true });
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
    // 상단 HUD의 음악 토글은 랭킹 버튼에 자리를 내줬다 - 음악·효과음은
    // 일시정지 안에 그대로 있다.
    document.querySelector('#hud-leaderboard-button')?.addEventListener('click', () => this.openLeaderboardFromPlay());
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
    // Best-effort privacy screen for the OS app switcher: the cover swaps in
    // synchronously the moment the tab goes background, so the snapshot the
    // switcher takes shows the logo instead of the board. Browsers give no
    // hard guarantee about snapshot timing - a real guarantee needs a native
    // wrapper - but in practice the swap wins the race.
    const privacyCover = document.querySelector('#privacy-cover');
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (privacyCover) privacyCover.hidden = false;
        // 광고 창이 덮으면 hidden이 오지만 그건 자리 비움이 아니다.
        if (!this.adShowing) this.pause('background');
      } else if (privacyCover) {
        privacyCover.hidden = true;
      }
    });
    window.addEventListener('pagehide', (event) => {
      if (privacyCover) privacyCover.hidden = false;
      if (!this.adShowing) this.pause('background');
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

  // 랭킹 버튼은 어디서나 보인다. 실제로 열리는 것은 토스 게임센터가 있을
  // 때고(ait 빌드로 토스 안에서 실행), 그 밖(웹·원스토어)에서는 준비 중
  // 안내를 띄운다 - 버튼이 안 보이면 기능이 있는지조차 검수할 수 없다는
  // 실사용 피드백을 따랐다.
  //
  // 자리는 셋: 홈(판 시작 전), 결과(방금 낸 점수를 견주는 자리), 플레이
  // 상단. 상단 버튼은 누르면 먼저 게임을 일시정지시키고 연다 - 시계가
  // 도는 채로 네이티브 창이 열리면 안 된다. 일시정지 안에도 뒀었지만
  // "너무 여기저기 다 있다"는 피드백으로 뺐다.
  async configureGameLeaderboard() {
    const actions = document.querySelector('.home-actions');
    const home = document.querySelector('#home-leaderboard-button');
    if (home) home.hidden = false;
    actions?.classList.add('has-online-leaderboard');
    this.leaderboardAvailable = gameLeaderboardAdapter.isSupportedEnvironment()
      ? await gameLeaderboardAdapter.isAvailable()
      : false;
    const nativeButton = document.querySelector('#oing-native-rank-button');
    if (nativeButton) {
      nativeButton.hidden = !this.leaderboardAvailable;
      const label = nativeButton.querySelector('span');
      if (label) label.textContent = gameLeaderboardAdapter.isTossEnvironment()
        ? '기존 토스 랭킹 보기'
        : 'Google Play 랭킹 보기';
    }
    void this.oingOnline.bootstrap().then((result) => {
      const jelly = document.querySelector('#oing-rank-jelly');
      if (!jelly || !result?.ok) return;
      jelly.textContent = Number(result.player?.jelly || 0).toLocaleString('ko-KR');
      jelly.hidden = false;
    });
  }

  // 플레이 상단의 랭킹: 시계부터 멈춘다. 일시정지 오버레이가 함께 열리므로
  // 네이티브 창에서 돌아와도 '계속하기'가 기다리고 있다.
  openLeaderboardFromPlay() {
    // The custom sheet is in-app, but reading it must not consume the clock.
    // The existing pause flow remains underneath so closing the sheet leaves
    // an explicit continue choice instead of silently restarting the timer.
    if (this.state.running && !this.state.paused) this.pause('leaderboard');
    this.openOingLeaderboard();
  }

  // Retry/restart keep whatever mode is on screen — a classic run retries
  // as classic (same board size), a stage run as stage mode.
  startCurrentMode(options = {}) {
    return this.start(this.runtime?.forcedRound || 1, this.classic
      ? { ...options, classic: true }
      : options);
  }

  // The scene behind the board for the board the run is on. Reaching it is
  // what unlocks it in the gallery, so the mark happens here — at the moment
  // the player actually sees it — not when a run ends.
  applyClassicChapter() {
    const chapter = classicChapterForBoard(this.classic.boardIndex);
    if (this.classic.chapterKey === chapter.key) return chapter;
    this.classic.chapterKey = chapter.key;
    this.classic.chapterLabel = chapter.label;
    this.ui.setChapter(chapter.key, classicChapterArtUrl(chapter));
    // Arriving is not collecting; markChapterCollected does that, and only
    // once the board has actually been opened up.
    return chapter;
  }

  // A scene enters the album when the board carrying it was cleared to the
  // collect ratio - the same work that opens the painting on the board. The
  // chapter read here is the one still on screen, so this must run before
  // boardIndex advances.
  markChapterCollected(clearedRatio) {
    if (!this.classic || this.runtime.testMode) return false;
    if (!classicChapterCollected(clearedRatio)) return false;
    const chapter = classicChapterForBoard(this.classic.boardIndex);
    const alreadySeen = storageAdapter.getSeenChapters().includes(chapter.key);
    storageAdapter.markChapterSeen(chapter.key);
    // Only a first-time collect is this run's news; the result sheet reads
    // the list so the album progress lands where the retry decision is made.
    if (!alreadySeen) (this.classic.collectedLabels ||= []).push(chapter.label);
    return true;
  }

  // Classic hides the ladder's item unlock schedule: bomb/clock stay at
  // stage-1 locked art, and the clock is out of play entirely.
  // Item payouts have to speak the same currency as a clear, or a bomb reads
  // as a different game. Classic pays blasts on its own cells×combo scale;
  // the stage mode keeps its tuned figures.
  // Classic scores sit an order of magnitude below the stage mode's, so the
  // consolation for a time item that can no longer add time scales with it.
  timeItemCapScore() {
    return this.classic ? Math.round(TIME_ITEM_CAP_SCORE * 0.1) : TIME_ITEM_CAP_SCORE;
  }

  classicBlastScore(cellCount, catCount) {
    return classicScoreForBlast(cellCount, catCount, this.state.combo);
  }

  itemHudState() {
    return {
      ...this.state.items,
      stage: this.classic ? classicDropStage(this.classic.boardIndex) : this.state.round,
      clockAvailable: this.stageDuration > 0,
      // 0개여도 광고 리필이 남아 있으면 버튼이 죽지 않고 광고 배지를 단다.
      //
      // adsAvailable(환경과 ID만 봄)이 아니라 adReady(실제로 불러왔는가)를
      // 본다. 예전에는 로드가 실패해도 배지가 떴고, 누르면 watchItemRefillAd가
      // adReady에서 조용히 되돌아가 아무 일도 일어나지 않았다 - 안내조차
      // 없어서 버튼이 먹통인 것으로 읽혔다. 약속은 지킬 수 있을 때만 한다.
      adRefill: { pack: adReady('helpPack') && !this.adHelpPackUsed },
    };
  }

  async start(startStage = this.runtime?.forcedRound || 1, options = {}) {
    if (this.telemetry && !this.telemetry.closed) this.telemetry.finish(this.state, 'restart');
    preloadPlayAssets({ urgent: true });
    this.stopTimer();
    stopMusic();
    const sequenceId = ++this.startSequenceId;
    this.activeRunId = ++this.runId;
    this.activeOnlineRunId = `${Date.now().toString(36)}-${this.activeRunId}-${Math.random().toString(36).slice(2, 8)}`;
    this.ui.cancelStartCountdown();
    this.startCountdownInProgress = false;
    this.resumeNeedsCountdown = false;
    this.resetRestartConfirmation();
    const audioReady = this.settings.sound ? unlockAudio() : Promise.resolve(false);
    const musicReady = this.settings.music ? unlockMusic() : Promise.resolve(false);
    this.runPreviousHighestStage = storageAdapter.getHighestStage();
    this.snapshotUnlockedCards();
    this.inventory = createRunInventory();
    this.ui.resetItemAvailabilityHistory();
    // 광고는 판 단위 기회다. 판이 시작될 때 미리 불러 둬야 누른 순간 뜬다.
    this.adContinueUsed = false;
    this.adContinueOffering = false;
    this.adStampedTimeUp = false;
    this.adHelpPackUsed = false;
    // 순차로 불러온다. 공식 문서가 한 번에 하나씩 load -> show -> 다음 load를
    // 권하고, 여러 그룹을 연달아 부르면 이벤트가 누락되던 사례가 안드로이드
    // 특정 버전에 기록돼 있다. 병렬로 얻을 것도 없다 - 이어하기는 판 끝,
    // 도움팩은 아이템이 떨어진 뒤라 둘 다 급하지 않다.
    //
    // 도움팩은 준비돼야 배지가 뜨므로, 다 불러온 뒤 HUD를 다시 그린다.
    void (async () => {
      for (const kind of ['continue', 'helpPack']) {
        await preloadAd(kind);
      }
      if (this.state.running) this.updateHUD();
    })();
    // 친구 초대로 약속한 힌트. 읽고 - 지급하고 - 지급이 끝난 뒤에 덜어낸다.
    // 순서가 중요하다. 먼저 비우면 지급이 실패했을 때 보상이 사라진다.
    const pendingHints = this.runtime.testMode
      ? this.pendingShareHints
      : storageAdapter.getPendingShareHints();
    if (pendingHints > 0) {
      this.grantItems({ hint: pendingHints }, { source: 'earned' });
      if (!this.runtime.testMode) storageAdapter.consumePendingShareHints(pendingHints);
      this.pendingShareHints = 0;
      this.ui.toast(`친구 초대 보너스! 힌트 +${pendingHints}다냥`);
    }
    // Classic mode: state.round is the generation depth ramp, not a stage —
    // the ladder machinery is bypassed at every branch below.
    // A personal best buys a later starting board, permanently — the only
    // progress in the game that outlives a run. boardsPlayed is tracked
    // separately from boardIndex so an unlocked start does not inflate the
    // result sheet's 판갈이 count.
    this.classic = options.classic
      ? {
        /* TODO: to bring back score-gated start boards, restore
           classicStartBoardIndex(storageAdapter.getClassicBestScore()) here. */
        boardIndex: 0,
        startBoardIndex: 0,
        boardsPlayed: 1,
        chapterKey: null,
        chapterLabel: '',
      }
      : null;
    if (this.classic && !this.runtime.testMode) void this.oingOnline.startRun(this.activeOnlineRunId);
    if (!this.classic) this.ui.setChapter(null);
    this.state = this.freshState(
      this.classic ? classicRoundForBoard(this.classic.boardIndex) : startStage,
      options,
    );
    if (this.classic) this.state.recordEligible = true;
    this.retryStage = 1;
    this.stageDuration = this.runtime?.duration || GAME_DURATION_SECONDS;
    this.state.timeLeft = this.stageDuration;
    this.telemetry = new RunTelemetry({ viewport: { width: window.innerWidth, height: window.innerHeight } });
    this.boardItems.reset();
    this.itemTapCandidate = null;
    this.pendingBoardItemTap = null;
    this.inputGuardUntil = 0;
    this.freezeEndsAt = 0;
    this.frozenTimeLeft = 0;
    this.ui.setFreezeActive(false);
    this.ui.updateItems(this.itemHudState());
    this.state.running = true;
    this.state.inputLocked = true;
    this.lowTimeSpoken = false;
    this.timeWarned = false;
    this.beginnerAutoHintShown = false;
    this.classicAutoHints = 0;
    this.classicAutoHintAt = -Infinity;
    this.openingGiftShown = false;
    this.classicSparseHintBoard = -1;
    this.classicAutoHintBoard = -1;
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
    this.ui.setOverlay('help-overlay', false);
    this.activePauseOverlay = 'pause-overlay';
    this.buildRound();
    this.forceTestBoardItem();
    this.ui.updateItems(this.itemHudState());
    this.ui.showScreen('play');
    // Paint the dark curtain and its first beat in the same frame as the
    // play screen. Mobile audio/media unlock can take a noticeable moment;
    // it must happen behind the countdown instead of exposing a bright board.
    this.ui.primeStartCountdown(options.quickCountdown ? 'READY' : START_COUNTDOWN_STEPS[0]);
    this.ui.setPlayCharacter('wave');
    this.showCatMessage('start');
    if (!this.settings.sound) this.ui.toast('설정에서 효과음을 ON으로 켜달라냥');
    preloadResultAssets();
    this.startCountdownInProgress = true;
    const primedAt = performance.now();
    const settled = await Promise.race([
      Promise.all([audioReady, musicReady]),
      delay(COUNTDOWN_AUDIO_WAIT_CAP_MS).then(() => null),
    ]);
    if (sequenceId !== this.startSequenceId || !this.state.running || this.state.paused) {
      if (sequenceId === this.startSequenceId) this.startCountdownInProgress = false;
      if (this.state.paused) this.resumeNeedsCountdown = true;
      return;
    }
    // 상한에 걸려 아직 결과를 모르는 경우에는 경고를 띄우지 않는다.
    if (settled && this.settings.sound && !settled[0]) this.ui.toast('휴대폰의 미디어 소리를 확인해달라냥');
    // 미리 띄운 숫자가 한 박자를 채웠으면 다음 숫자부터 이어간다. 빨리
    // 준비된 판에서는 지금까지처럼 전체 3·2·1이 그대로 돈다.
    const beat = options.quickCountdown ? COUNTDOWN_BEAT_MS.compact : COUNTDOWN_BEAT_MS.normal;
    const skipPrimedStep = performance.now() - primedAt >= beat;
    await this.runStartCountdown(sequenceId, options.quickCountdown === true, { skipPrimedStep });
  }

  async runStartCountdown(sequenceId, quickCountdown = false, { skipPrimedStep = false } = {}) {
    this.startCountdownInProgress = true;
    // 이번 판의 목표를 카운트다운에 걸어둔다. 결과창과 같은 고르기를 쓰되
    // 말투만 다르다 - 여기서는 남은 몫이 아니라 넘어야 할 수를 말한다.
    // 아직 0점이라 이번 판 점수로는 아무것도 못 재므로, 그 사람이 이미 낼 수
    // 있는 점수(최고기록)에서 잰다.
    this.ui.setStartCountdownGoal(nextGoalLine({
      totals: this.currentCardTotals(),
      previousBest: storageAdapter.getClassicBestScore(),
      challengeTarget: challengeScore(),
      phase: 'start',
    }));
    const all = quickCountdown ? RETRY_COUNTDOWN_STEPS : START_COUNTDOWN_STEPS;
    const steps = skipPrimedStep && all.length > 1 ? all.slice(1) : all;
    const completed = await this.ui.animateStartCountdown(steps, (step) => {
      if (step === 'GO!') {
        playGoSound();
        playMusic({ restart: true });
      }
      else playReadyCountSound(step);
      readyCountHaptic(step);
    }, { quick: quickCountdown });
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
    // 첫 판 튜토리얼이 뜰 차례면 출발 안내는 건너뛴다. 둘 다 "슥 이어봐"를
    // 가르치는 물건이라 겹치면 라벨이 두 개 쌓여 어지럽다. 튜토리얼이 손을
    // 잡아주는 쪽이 더 친절하므로 그쪽에 자리를 넘긴다.
    if (this.waitingForFirstDrag) window.setTimeout(() => this.maybeShowTutorial(), 120);
    else {
      this.showOpeningGiftHint();
      this.beginCountdown();
    }
    return true;
  }

  // 판이 열리는 순간 첫 답 하나를 모두에게 보여준다. 초보 보조 힌트와는
  // 다른 물건이다 - 실력과 무관한 "출발 선물"이고, 첫 판은 원래 쉬운
  // 구간이라 난도를 건드리지 않는다. 실기기 피드백: 잘하는 사람에게도
  // 시작 표시가 있으면 기분 좋게 출발한다.
  showOpeningGiftHint() {
    if (!this.classic || this.runtime.testMode) return false;
    if (this.classic.boardIndex !== this.classic.startBoardIndex) return false;
    if (this.openingGiftShown) return false;
    const answer = this.model.findHintAnswer();
    if (!answer) return false;
    this.openingGiftShown = true;
    this.telemetry?.hint('opening-gift');
    // 노란색으로, 그리고 "정답 여기"가 아니라 "이렇게 하는 거야"로 말한다.
    // 2026-08 실기기 제보: 시작하자마자 정답을 알려주니 김샌다는 것. 같은
    // 표시라도 가르치는 말투면 출발 안내로 읽힌다.
    this.ui.showHint(answer, { tone: 'coach' });
    this.ui.setPlayCharacter('wave', 900);
    this.showCatMessage('openingGift', { force: true });
    return true;
  }

  // 판이 말라붙으면 고양이가 한 개를 비춰 준다. 판마다 한 번, 공짜다.
  //
  // 지워갈수록 답이 주는 건 당연한데, "바로 보이는 답"(두 칸짜리)이 먼저
  // 사라지는 게 문제다. 판을 반쯤 지우면 남은 답이 전부 세 칸 이상이라
  // 앞부분은 패턴 찾기였다가 뒷부분은 암산 노동이 된다(data.js의 실측표).
  //
  // 유료 힌트와 겹치지 않는다. 저건 아무 때나 쓰는 것이고 이건 꼬리 전용이라,
  // 광고를 보고 힌트를 산 사람의 손해가 되지 않는다. 잘하는 사람은 이 지점을
  // 이미 지나쳐 있어 혜택이 거의 없다 - 초보만 받는 도움이다.
  maybeCoachThinBoard(remainingCells = 0) {
    if (this.thinBoardCoached) return false;
    if (!this.state.running || this.state.paused) return false;
    // 판이 아직 많이 남았으면 세어 보지도 않는다 - findAnswers는 비싸고,
    // 답이 마르는 일은 판이 꽤 지워진 뒤에만 일어난다.
    const initial = Math.max(1, this.state.initialPlayableCells);
    if (remainingCells > initial * CLASSIC_THIN_BOARD_MAX_FILL) return false;
    const answers = this.model.findAnswers();
    if (!answers.length || answers.length > CLASSIC_THIN_BOARD_ANSWERS) return false;
    this.thinBoardCoached = true;
    // 두 칸짜리가 있으면 그것부터. 초보에게 가장 읽히는 형태다.
    const pick = answers.find((a) => (a.r2 - a.r1 + 1) * (a.c2 - a.c1 + 1) === 2) || answers[0];
    this.telemetry?.hint('thin-board');
    this.ui.showHint(pick, { tone: 'coach' });
    this.showCatMessage('thinBoard', { force: true });
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
    // 새 판에서는 이전 판 좌표로 눌러둔 탭이 의미가 없다.
    this.pendingBoardItemTap = null;
    // 꼬리 구제는 판마다 한 번이다. 새 판이 서면 다시 쓸 수 있다.
    this.thinBoardCoached = false;
    const classicBoard = this.classic ? classicBoardForIndex(this.classic.boardIndex) : null;
    if (this.classic) this.applyClassicChapter();
    const config = classicBoard
      ? { size: classicBoard.cols, cols: classicBoard.cols, rows: classicBoard.rows }
      : getRoundConfig(this.state.round);
    this.generateBoard(config.size, config.rows);
    // Classic keeps the numbers themselves clean — no special tiles baked
    // into the grid — but earned board drops land on it like they do in the
    // stage mode, so a combo past the score cap still buys something.
    if (!this.classic) this.model.assignSpecialTiles(specialTilePlanForStage(this.state.round));
    // A fresh classic board has no empty cells except the cat seats, so an
    // item carried over a 판갈이 would sit invisible in the queue until the
    // first clear - which read as the bomb simply vanishing. Instead the
    // carried item buys its seat from a cat: one reserved cat cell (max two)
    // opens up and the item lands there immediately, exactly where a player
    // expects their saved bomb to be waiting.
    if (this.classic && this.boardItems.pending.length && this.model.bonusCats.size > 1) {
      const yield_ = Math.min(2, this.boardItems.pending.length, this.model.bonusCats.size - 1);
      const seats = [...this.model.bonusCats].slice(0, yield_);
      seats.forEach((key) => this.model.bonusCats.delete(key));
    }
    const placed = this.placeBoardItems();
    this.renderBoard();
    this.updateHUD();
    return placed;
  }

  generateBoard(cols, rows = cols) {
    const classicRule = this.classic ? classicBoardRuleForIndex(this.classic.boardIndex) : null;
    const grid = this.classic
      ? this.model.generateClassic(cols, rows, this.state.round, {
        catMultiplier: classicRule?.catMultiplier,
      })
      : this.model.generate(cols, {
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
    this.state.initialPlayableCells = this.model.remainingPlayableCells();
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
    if (this.itemTapCandidate || !tile || event.isPrimary === false || event.button !== 0) return;
    // 정답 처리 중(inputLocked)이나 입력 가드 안에 들어온 탭은 지금까지
    // 아무 흔적 없이 버려졌다 - 실기기에서 "폭탄이 잘 안 눌린다, 딜레이가
    // 있는 것 같다"의 정체다. 이제는 누른 것을 눈에 보이게 받아두고,
    // 잠금이 풀리는 순간 대신 실행한다. 성공 처리 경로에 await를 더하지
    // 않으므로 #25의 드래그 잠금 규칙은 그대로다.
    if (!this.canUseItem()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.queueBoardItemTap(tile);
      return;
    }
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
    // 누른 순간 손끝에 답이 온다. 터짐(bombHaptic)보다 약한 톡 하나라
    // 실제 폭발과 겹쳐 들리지 않는다.
    itemHaptic();
    try { this.ui.board.setPointerCapture(event.pointerId); } catch {}
  }

  // 잠금 중에 눌린 아이템을 짧은 창 동안만 들고 있는다. 창을 넘기면 버린다 -
  // 한참 전에 누른 폭탄이 뒤늦게 터지는 편이 안 터지는 것보다 나쁘다.
  queueBoardItemTap(tile) {
    const row = Number(tile.dataset.row);
    const col = Number(tile.dataset.col);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return;
    const key = `${row}:${col}`;
    if (!this.boardItems.get(key)) return;
    this.pendingBoardItemTap = { key, row, col, at: performance.now() };
    this.ui.pressBoardItem(row, col, true);
    itemHaptic();
    window.setTimeout(() => this.ui.pressBoardItem(row, col, false), 160);
  }

  // 잠금이 풀린 뒤 게임 루프가 부른다. 그 사이 판이 바뀌어 아이템이
  // 사라졌으면 useBoardItem이 알아서 아무 일도 하지 않는다.
  flushPendingBoardItemTap() {
    const pending = this.pendingBoardItemTap;
    if (!pending) return;
    this.pendingBoardItemTap = null;
    if (performance.now() - pending.at > BOARD_ITEM_TAP_GRACE_MS) return;
    if (!this.boardItems.get(pending.key)) return;
    this.useBoardItem(pending.key);
  }

  moveBoardItemTap(event) {
    const candidate = this.itemTapCandidate;
    if (!candidate || event.pointerId !== candidate.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const distance = Math.hypot(event.clientX - candidate.startX, event.clientY - candidate.startY);
    // 10px is a mouse's slop. A thumb on a ~60dp cell rolls further than that
    // just pressing down, so every slightly imprecise tap was being read as a
    // drag and thrown away - the "안 눌린다" feel.
    if (distance > ITEM_TAP_SLOP) {
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
    // A press that never travelled is a tap, full stop. Also demanding the
    // release land back on the same element let a board re-render (a drop
    // landing, a veil update) eat the tap: elementFromPoint then answers with
    // a node that is no longer the one the press started on.
    if (!candidate.moved || endedOnSameItem) this.useBoardItem(candidate.key);
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
    // Classic combos ride an uncapped-feeling ramp on a different clock —
    // they stay out of the stage mode's best-combo record.
    if (!this.runtime.testMode && !this.classic) storageAdapter.saveBestCombo(this.state.maxCombo);
    // Each seven-combo boundary pays once per run; see boardDropRewardForRun
    // for why the step is measured from the run's high-water mark. The rule
    // is covered by regression tests in tests/board-items.test.mjs.
    const reward = boardDropRewardForRun({
      previousCombo,
      nextCombo: this.state.combo,
      bestComboBefore: previousMaxCombo,
    });
    let earnedDrop = null;
    // The original paid an item at every seventh combo, which is what kept a
    // combo above the score cap worth having. Classic dropped items to keep
    // the score scale clean and lost that valve with them; it is back, gated
    // on board depth rather than on the number mix so an unlocked start does
    // not open the late-run rarities on its first board.
    if (reward && this.state.round >= 3) {
      const dropStage = this.classic
        ? classicDropStage(this.classic.boardIndex)
        : this.state.round;
      const drop = chooseBoardDrop(this.state.combo, Math.random, {
        cloverGiven: this.state.cloverDropped,
        pity: this.state.boardDropPity,
        previousType: this.state.lastBoardDropType,
        rewardIndex: this.state.boardDropsEarned,
        stage: dropStage,
        timeBonusCapped: availableItemTimeBonus(this.state.itemTimeBonusUsed, 1) <= 0,
        // Same line the refund fatigue charges from: boardsPlayed counts the
        // board being played, so board 7 is the first one past it.
        lateRun: Boolean(this.classic && this.classic.boardsPlayed > CLASSIC_REFUND_FATIGUE.fromBoard),
      });
      if (drop) {
        earnedDrop = drop;
        this.boardItems.queue(drop.id, { earnedAtCombo: this.state.combo, reward });
        this.state.boardDropsEarned += 1;
        this.state.lastBoardDropType = drop.id;
        this.state.boardDropPity = nextBoardDropPity(this.state.boardDropPity, drop.id, {
          stage: dropStage,
          combo: this.state.combo,
        });
        if (drop.id === 'clover') this.state.cloverDropped = true;
        this.telemetry?.itemEarned(drop.id);
      }
    }
    return { previousCombo, earnedDrop };
  }

  queueStageShowcase(stage) {
    if (!this.state.stageShowcaseEligible) return null;
    const showcaseDrop = stageShowcaseBoardDrop(
      stage,
      () => (Math.min(2, this.state.stageShowcaseIndex) + 0.5) / 3,
      this.state.stageShowcaseGiven,
    );
    if (!showcaseDrop) return null;
    this.boardItems.queue(showcaseDrop.id, { earnedAtCombo: this.state.combo, showcase: true });
    this.state.stageShowcaseGiven = true;
    if (!this.runtime.testMode) storageAdapter.markRareShowcaseSeen();
    this.state.lastBoardDropType = showcaseDrop.id;
    if (showcaseDrop.id === 'clover') this.state.cloverDropped = true;
    this.telemetry?.itemEarned(showcaseDrop.id);
    return showcaseDrop;
  }

  refreshComboDeadline(now = performance.now()) {
    // Classic combo never times out — only a wrong answer cuts it (원조 규칙).
    this.state.comboExpiresAt = this.state.combo > 0 && !this.classic
      ? now + comboWindowMsForStage(this.state.round)
      : 0;
  }

  announceBoardItems(items, { playSound = true } = {}) {
    this.ui.showBoardItemDrops(items);
    // 처음 보는 희귀 아이템이면 그 한 번은 "무엇을 하는 물건인지"가 인사를
    // 대신한다. 기존 등장 문구는 누르는 법만 말해주고 효과는 말해주지 않는데,
    // 이 셋은 눌렀을 때 벌어지는 일이 화면 밖(시간, 다음 점수)에 있어 처음 본
    // 사람은 그냥 지나친다.
    //
    // 말풍선이 아니라 토스트로 내보내는 이유는 판이 깊어지면(8줄 이상) 말풍선
    // 자리가 접히기 때문이다. 대신 같은 순간에 말풍선까지 뜨면 두 글자 덩어리가
    // 겹치므로, 이 한 번은 말풍선을 양보한다. 소리와 진동, 반짝임, 고양이가
    // 손 흔드는 반응은 그대로 남는다 - 사라지는 것은 겹치는 말뿐이다.
    const introType = this.pendingRareBoardItemIntro(items);
    if (introType) {
      storageAdapter.markRareItemSeen(introType);
      this.ui.toast(RARE_BOARD_ITEM_INTROS[introType], 1600);
    } else {
      const showcase = items.find((item) => item.showcase);
      if (showcase) {
        const label = BOARD_DROP_ITEMS[showcase.type]?.label || '희귀 아이템';
        this.ui.showMessage(`${label} 등장이다냥! 톡 눌러봐.`, 2200, 'itemDrop');
      } else {
        this.showCatMessage('itemDrop');
      }
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

  // 정답 처리는 한 번에 하나씩만 돈다.
  //
  // 연출이 끝나기 전에 손가락을 놓아주면서, 앞 정답의 뒷정리가 남아 있는 채로
  // 다음 정답이 들어올 수 있게 됐다. 그렇다고 그 정답을 버리면 예전과 똑같이
  // 손가락이 무시되는 것이라, 버리는 대신 줄을 세운다. 기다렸다가 도는 쪽은
  // 판이 바뀐 뒤의 최신 상태로 합을 다시 계산하므로 앞뒤가 어긋나지 않는다.
  commit(rect) {
    this.commitChain = (this.commitChain || Promise.resolve())
      .then(() => this.resolveCommit(rect))
      .catch(() => {});
    return this.commitChain;
  }

  async resolveCommit(rect) {
    if (!this.state.running || this.state.paused || this.state.inputLocked) return;
    this.lastInteractionAt = performance.now();
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

  // 판 하나가 끝났다. 도감이 보는 평생 누적값을 여기서 한 번에 올린다.
  // 끝나는 자리가 스테이지와 클래식 둘이라 흩어놓으면 한쪽만 고치게 된다.
  // 테스트 모드는 저장하지 않는다 - 자동 실행이 사람의 기록을 밀어내면 안 된다.
  commitLifetimeTotals() {
    if (this.runtime.testMode) return;
    storageAdapter.addRunPlayed();
    storageAdapter.addPlayDay();
    storageAdapter.addBigClears(this.state.bigClears);
    storageAdapter.addCellsCleared(this.state.cellsCleared);
    if (this.classic) storageAdapter.saveClassicBestCombo(this.state.maxCombo);
  }

  // 도감이 보는 누적값 한 벌. 기록 창과 결과 화면이 같은 자리에서 읽어야
  // 갤러리에 잠겨 보이는 카드가 결과 화면에서 열렸다고 뜨는 일이 없다.
  currentCardTotals() {
    return {
      runs: storageAdapter.getRunsPlayed(),
      cats: storageAdapter.getCatsRescued(),
      bigClears: storageAdapter.getBigClears(),
      cellsCleared: storageAdapter.getCellsCleared(),
      playDays: storageAdapter.getPlayDays().length,
      bestScore: storageAdapter.getClassicBestScore(),
    };
  }

  unlockedCardKeys() {
    return oingCardRows(this.currentCardTotals())
      .filter((card) => card.unlocked)
      .map((card) => card.key);
  }

  // 판이 시작될 때 열려 있던 카드를 기억해둔다. 저장소가 아니라 메모리에만
  // 두는 값이다 - 이 판이 끝나면 쓸모가 없고, 남겨두면 저장된 사실과
  // 실제 누적값이 갈라질 자리가 하나 더 생긴다.
  snapshotUnlockedCards() {
    this.cardKeysAtRunStart = this.runtime.testMode ? null : new Set(this.unlockedCardKeys());
  }

  // 이번 판에 처음 열린 카드들. 시작 스냅샷이 없으면(테스트 모드 등) 빈 결과.
  cardsUnlockedThisRun() {
    if (this.runtime.testMode || !this.cardKeysAtRunStart) return null;
    const award = newlyUnlockedOingCards(this.currentCardTotals(), [...this.cardKeysAtRunStart]);
    return award.fresh.length ? award : null;
  }

  // 아이템 배치는 여섯 군데에서 일어난다. 첫 등장 판정을 각 자리에 흩어놓으면
  // 한 곳을 빠뜨리고, 빠뜨린 경로로 처음 만난 사람은 영영 설명을 못 듣는다.
  placeBoardItems() {
    return this.boardItems.place(this.model.grid, this.model.bonusCats);
  }

  // 이번에 놓인 것 중 처음 보는 희귀 아이템 한 종류. 없으면 null.
  //
  // 여기서는 고르기만 하고 "봤다"고 적지는 않는다. 배치와 안내가 같은 자리에서
  // 일어나지 않는 경로가 있어서(판갈이는 배치 뒤 애니메이션을 한 번 거친다),
  // 놓자마자 적어버리면 아무 말도 못 한 채 기회를 잃는다.
  pendingRareBoardItemIntro(items = []) {
    if (this.runtime.testMode || !Array.isArray(items) || !items.length) return null;
    // 아이템이 떨어질 때마다 도는 자리다. 희귀한 것이 하나도 없으면 저장소를
    // 아예 읽지 않는다 - 폭탄과 시계 때문에 JSON을 파싱할 이유는 없다.
    const types = items.map((item) => item?.type);
    if (!types.some((type) => RARE_BOARD_ITEM_INTROS[type])) return null;
    return unseenRareBoardItemTypes(types, storageAdapter.getSeenRareItems())[0] || null;
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
    // The hint is spent the moment its answer is played — drop the veil now
    // rather than leaving it over the clear animation and the next move.
    this.ui.clearHint();
    const specials = stats.specials || [];
    const bombSpecials = specials.filter(({ type }) => type === 'bomb');
    const blastCells = this.model.specialBombCells(bombSpecials, rect, 4);
    const blastValue = blastCells.reduce((sum, { r, c }) => sum + this.model.valueAt(r, c), 0);
    const catCount = stats.catCount || 0;
    const clearedCellCount = stats.count + catCount;
    const comboGain = this.classic
      ? classicComboGain(clearedCellCount)
      : comboGainForClear(clearedCellCount);
    const { previousCombo, earnedDrop } = this.advanceCombo(comboGain);
    const comboMilestone = comboMilestoneCrossed(previousCombo, this.state.combo);
    this.state.successCount += 1;
    if (!this.runtime.testMode) this.oingOnline.recordSuccess();
    this.state.consecutiveFailures = 0;
    this.state.maxClearCells = Math.max(this.state.maxClearCells, clearedCellCount);
    // 5칸 이상은 WOW와 같은 기준이다 - 도감의 "한 번에 크게 지우기" 카드가
    // 화면에서 WOW가 터진 횟수와 어긋나지 않도록 같은 수를 쓴다.
    if (clearedCellCount >= 5) this.state.bigClears += 1;
    this.state.cellsCleared += clearedCellCount + blastCells.length;
    // Classic pays the original's single formula — cats and wide clears are
    // folded in, and no side bonus (clutch/clover) touches the scale.
    const clearPoints = this.classic
      ? classicScoreForClear(clearedCellCount, catCount, this.state.combo)
      : scoreForClear(clearedCellCount, this.state.combo);
    const wideBonusPoints = this.classic ? 0 : scoreForWideClear(clearedCellCount, this.state.combo);
    const catBonusPoints = this.classic ? 0 : scoreForCatBonus(catCount, this.state.combo);
    const specialBonusPoints = blastCells.length ? scoreForBomb(blastValue, blastCells.length) : 0;
    const cloverBasePoints = clearPoints + wideBonusPoints + catBonusPoints + specialBonusPoints;
    const cloverBonusPoints = this.state.cloverBoostPending ? scoreForCloverBonus(cloverBasePoints) : 0;
    const clutchBonusPoints = this.classic || this.freezeEndsAt > performance.now()
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
    const nice = isNiceClear(clearedCellCount);

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
    const completedFirstTutorial = this.tutorialActive && !storageAdapter.hasSeenDragTutorial();
    this.completeTutorial();
    successHaptic(this.state.combo);
    duckMusic(wow ? 560 : 390, wow ? 0.48 : 0.64);
    // playWideClearSound is a port of the original's WOW fanfare — a rising
    // three-chord arpeggio and a sparkle — so it fires on the same five-cell
    // threshold the original used, alongside the centred WOW! card.
    if (wow) {
      playWideClearSound();
      this.ui.showWowMoment(points);
    } else if (this.state.combo >= 2) playComboSound(this.state.combo);
    else playSuccessSound();
    if (catCount > 0) {
      const catSoundOffset = blastCells.length
        ? 0.36
        : wow ? 0.25 : 0.17;
      playCatBonusSound(catSoundOffset);
    }
    // The NICE tag steps aside for the ranks that own the frame outright —
    // emptying the board (5) and WOW or a rare drop (4) — so it only ever
    // decorates a moment that would otherwise pass with just a number.
    const scoreFeedback = () => this.ui.showScoreBurst(
      points,
      rect,
      { rows: this.model.rows, cols: this.model.cols },
      this.state.combo,
      clearedCellCount,
      { nice: nice && successLevel < 4 },
    );
    this.updateHUD();
    if (comboGain > 1) this.ui.showComboGain(comboGain);
    this.ui.pulseGoal(this.state.combo);
    if (completedFirstTutorial) {
      this.ui.setPlayCharacter('success', 900);
      this.ui.showMessage('오잉! 사각형 안의 합이 10!', 1900, 'firstSuccess');
    } else {
      this.speakForSuccess(catCount, wow, successLevel, comboMilestone);
    }
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
    if (!completedFirstTutorial && successLevel <= 2) this.ui.showMatchConfirmation(rect, this.state.combo);
    // 판에서 칸을 먼저 지우고, 그 다음에 축하 연출을 튼다.
    //
    // 예전에는 연출이 다 끝난 뒤에야 칸을 지우고 입력을 풀었다. 그동안 화면을
    // 누른 손가락은 무시됐다 - 지연이 아니라 통째로 버려졌다. 콤보를 이어
    // 붙이는 사람은 정답을 맞힌 즉시 다음 사각형을 그리기 시작하는데, 그
    // 드래그의 처음 300ms 가까이가 없던 일이 되니 판이 버벅이는 것처럼 느껴진다.
    // 콤보가 높을수록 연출이 길어져서 잘 될수록 더 답답해지는 구조였다.
    //
    // 칸은 이미 사라졌고 남은 것은 축하뿐이라, 여기서 손가락을 놓아준다.
    // 겹쳐 들어오는 정답은 commit이 차례로 세워주므로 두 처리가 서로를
    // 밟지 않는다.
    const caughtItems = this.boardItemsInRect(rect);
    this.model.remove(rect);
    if (blastCells.length) this.model.removeCells(blastCells);
    this.ui.revealClearedCells(rect, blastCells);
    this.trackGardenReveal();
    this.state.inputLocked = false;

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
    if (this.finishPending) {
      this.renderBoard({ preserveScoreBurst: true });
      return;
    }

    const remainingAnswer = this.model.findAnswer();
    const remaining = this.model.remainingPlayableCells();
    if (this.classic) {
      // Drops land on cells the player has cleared, and a freshly generated
      // board has none — so the placement pass belongs here, after every
      // success, not only at 판갈이.
      const placed = this.placeBoardItems();
      this.renderBoard({ preserveScoreBurst: true });
      if (placed.length) {
        this.announceBoardItems(placed, { playSound: this.state.combo % ITEM_REWARD_INTERVAL !== 0 });
      }
      if (remainingAnswer) this.maybeCoachThinBoard(remaining);
      else await this.classicBoardChange({ emptied: remaining === 0 });
      this.state.inputLocked = false;
      this.updateHUD();
      await this.fireCaughtBoardItems(caughtItems);
      return;
    }
    const decision = stageEndDecision({
      hasAnswer: Boolean(remainingAnswer),
      boardEmpty: remaining === 0,
      remaining,
      initialPlayable: this.state.initialPlayableCells,
      stageRescues: this.state.stageRescues,
      threshold: normalClearThresholdForStage(this.state.round),
    });
    if (decision === 'advance') {
      this.renderBoard({ preserveScoreBurst: true });
      if (comboMilestone) await delay(220);
      await this.clearRound();
    } else if (decision === 'normal') {
      this.renderBoard({ preserveScoreBurst: true });
      await this.normalDryClear();
    } else if (decision === 'rescue') {
      this.renderBoard({ preserveScoreBurst: true });
      await this.rescueShuffle();
    } else {
      const placed = this.placeBoardItems();
      this.renderBoard({ preserveScoreBurst: true });
      if (placed.length) this.announceBoardItems(placed, { playSound: this.state.combo % ITEM_REWARD_INTERVAL !== 0 });
    }
    this.state.inputLocked = false;
    this.updateHUD();
    await this.fireCaughtBoardItems(caughtItems);
  }

  boardItemsInRect(rect) {
    if (!rect) return [];
    return this.boardItems.snapshot().visible
      .filter(({ row, col }) => row >= rect.r1 && row <= rect.r2 && col >= rect.c1 && col <= rect.c2)
      .map(({ row, col }) => `${row}:${col}`);
  }

  // Run one after another, each awaited: every blast resolves the board on
  // its own (판갈이 included), so overlapping them would have a second item
  // firing at coordinates the first one already rewrote.
  async fireCaughtBoardItems(keys = []) {
    for (const key of keys) {
      if (!this.state.running || this.state.paused) return;
      if (!this.boardItems.get(key)) continue;
      await this.useBoardItem(key);
    }
  }

  // The stage never ends with tiles on the board. When the answers run out
  // instead, the cat quietly rearranges what is left — and if the values
  // themselves can no longer make ten (a bomb blast is the usual culprit),
  // the model repairs the smallest possible pair. Cleared cells are never
  // refilled, and the shuffle item's count is never touched. If fewer than
  // two numbers remain, nothing can ever sum to ten again: the leftovers
  // are swept off as blast debris and the stage completes.
  // The normal clear: the tens ran out, so the stage is over — that is the
  // rule, not an assist. The clear is confirmed FIRST (haptic + the stage
  // sound land before anything moves), then the leftover tiles pop away as
  // part of the transition, then the garden and the banner follow. No cat
  // commentary, no score, no combo, no drops from the cleanup.
  async normalDryClear() {
    const numbers = this.model.grid.flat().filter((value) => value > 0).length;
    const reason = numbers <= 1 ? 'orphanTail' : this.state.stageBombUsed ? 'bombDeadEnd' : 'naturalDeadEnd';
    this.state.normalClears += 1;
    this.state.stageNormalClears += 1;
    this.telemetry?.normalClear?.(reason);
    await delay(220);
    roundHaptic();
    playRoundClearSound();
    const sweep = this.model.sweepRemaining();
    if (sweep.length) await this.ui.animateSweep(sweep);
    this.renderBoard({ preserveScoreBurst: true });
    this.trackGardenReveal();
    await this.clearRound({ clearAnnounced: true });
  }

  async rescueShuffle() {
    this.state.rescueShuffles += 1;
    this.state.stageRescues += 1;
    this.telemetry?.rescueShuffle?.();
    // The cat explains the first rescue of a stage; repeats stay wordless so
    // a tail that needs two nudges doesn't turn into a monologue.
    if (this.state.stageRescues === 1) {
      this.showCatMessage('rescue');
      this.ui.setPlayCharacter('wave', 1000);
    }
    duckMusic(420, 0.66);
    playShuffleSound();
    itemHaptic();
    const outcome = this.model.rescueRemaining();
    if (!outcome) {
      const sweep = this.model.sweepRemaining();
      if (sweep.length) await this.ui.animateSweep(sweep);
      this.renderBoard({ preserveScoreBurst: true });
      this.trackGardenReveal();
      await this.clearRound();
      return;
    }
    await this.ui.animateShuffleOut();
    this.renderBoard();
    await this.ui.animateShuffleIn();
    itemHaptic();
    this.inputGuardUntil = performance.now() + 140;
  }

  // 판갈이: the classic loop's only lifeline. The answers ran out — whether
  // the board was emptied or stranded — so a fresh board slides in and the
  // clock gains +15s, exactly like the original. The timer never stops and
  // the combo carries straight through.
  async classicBoardChange({ emptied = false } = {}) {
    // The bonus is earned by the board just finished — the opening 6×6 pays its
    // own small refund, not the full board's.
    const clearedBoard = classicBoardForIndex(this.classic.boardIndex);
    // How much of the board the player actually got through. This is what
    // the refund is paid on, so the stubborn last corner of a 6×8 is worth
    // real seconds and a tidy finish beats breaking a few and moving on.
    const initial = Math.max(1, this.state.initialPlayableCells);
    const clearedRatio = Math.min(1, Math.max(0, 1 - this.model.remainingPlayableCells() / initial));
    this.markChapterCollected(clearedRatio);
    // The board just finished is #boardsPlayed (it starts at 1); read it
    // before the counters advance, since fatigue is charged on it.
    const finishedBoardNumber = this.classic.boardsPlayed;
    this.classic.boardIndex += 1;
    this.classic.boardsPlayed += 1;
    const nextBoard = classicBoardForIndex(this.classic.boardIndex);
    const nextBoardRule = classicBoardRuleForIndex(this.classic.boardIndex);
    this.state.round = classicRoundForBoard(this.classic.boardIndex);
    const previousTime = this.state.timeLeft;
    this.state.timeLeft = classicTimeAfterBoardChange(
      previousTime,
      classicRefundWithFatigue(
        classicBoardChangeSeconds(clearedBoard, clearedRatio),
        finishedBoardNumber,
      ),
    );
    const gainedTime = Math.round(this.state.timeLeft - previousTime);
    const boardGrew = nextBoard.rows * nextBoard.cols > clearedBoard.rows * clearedBoard.cols;
    // buildRound applies the chapter further down; compare against the one
    // still on screen so a new scene can announce itself as it arrives.
    const nextChapter = classicChapterForBoard(this.classic.boardIndex);
    const enteredChapter = nextChapter.key !== this.classic.chapterKey ? nextChapter : null;
    if (this.timer) this.endAt += (this.state.timeLeft - previousTime) * 1000;
    if (this.state.timeLeft > 10) {
      this.lowTimeSpoken = false;
      this.lastCountdownSecond = null;
    }
    roundHaptic();
    playRoundClearSound();
    duckMusic(420, 0.6);
    // The reward belongs to the board that was emptied, even when the next
    // board has its own one-line rule and therefore owns the speech bubble.
    if (emptied) this.grantItems({ hint: 1 });
    if (nextBoardRule) {
      this.ui.showMessage(nextBoardRule.message, 1900, 'classicRule');
      this.ui.setPlayCharacter('cheer', 1000);
    } else if (emptied) {
      // A scaled-down take on the original's perfect-clear carry (3 hints):
      // emptying the board yourself earns one hint.
      this.ui.showMessage('싹 비웠다냥! 힌트 +1', 1800, 'classicClear');
      this.ui.setPlayCharacter('cheer', 1000);
    } else if (enteredChapter) {
      // A new scene is the run's own milestone — it outranks the board-grew
      // line, which the player can see for themselves.
      this.ui.showMessage(`${enteredChapter.label}에 도착했다냥!`, 1900, 'classicChapter');
      this.ui.setPlayCharacter('cheer', 1000);
    } else if (boardGrew) {
      this.ui.showMessage('판이 커졌다냥!', 1600, 'classicBoard');
      this.ui.setPlayCharacter('cheer', 900);
    } else if (!emptied) {
      // 다 비우지 않았는데 판이 바뀌는 경우다. 규칙상 남은 칸으로 더는 10을
      // 만들 수 없으면 새 판을 준다 - 못 푸는 판을 붙들고 있게 두지 않기
      // 위해서다. 그런데 여태 이 경우에만 아무 말이 없어서, 실기기에서
      // "답을 못 맞췄는데 넘어간다"는 버그 제보로 돌아왔다. 이유를 말해준다.
      this.ui.showMessage('더 만들 10이 없다냥! 새 판이다냥', 1800, 'classicBoard');
      this.ui.setPlayCharacter('wave', 900);
    } else {
      this.ui.showMessage('판갈이다냥!', 1600, 'classicBoard');
      this.ui.setPlayCharacter('wave', 900);
    }
    if (gainedTime > 0) this.ui.showStageTimeBonus(gainedTime);
    this.ui.flashBoardChange();
    this.updateHUD();
    await this.ui.animateShuffleOut();
    // The new scene's skin goes on before the fresh board arrives, but it is
    // never shown outright: a card that displays the whole painting is a
    // preview, and this picture is only supposed to be earned cell by cell.
    // The arrival still gets announced — in the speech bubble, in words.
    if (enteredChapter) this.applyClassicChapter();
    this.queueStageShowcase(classicDropStage(this.classic.boardIndex));
    const placedItems = this.buildRound();
    this.ui.showClassicBoardEntry(this.classic.boardsPlayed, gainedTime, boardGrew);
    await this.ui.animateShuffleIn();
    if (placedItems.length) this.announceBoardItems(placedItems);
    else itemHaptic();
    this.inputGuardUntil = performance.now() + 160;
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
    this.state.combo = this.classic
      ? classicComboAfterFailure(previousCombo)
      : comboAfterIncorrectSelection(previousCombo, stats.sum);
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

  speakForSuccess(catCount = 0, wow = false, successLevel = 1, comboMilestone = 0) {
    // The cat used to have a line for literally every clear, which measured
    // at 3.67 message changes per success — it talked over the game instead
    // of reacting to it. It now speaks for moments with feeling behind them:
    // the first clear, a big or lucky one, the step before a reward, and the
    // combo milestones. An ordinary clear passes in silence, which is what
    // makes the next line worth reading.
    const rewardStage = this.classic
      ? classicDropStage(this.classic.boardIndex)
      : this.state.round;
    const rewardStatus = itemRewardStatus(this.state.combo, this.state.maxCombo, rewardStage);
    if (catCount > 0) {
      this.ui.setPlayCharacter('success', 950);
      this.showCatMessage('catBonus');
    } else if (wow) {
      this.ui.setPlayCharacter('success', 1000);
      this.showCatMessage('wow');
    } else if (this.state.successCount === 1) {
      this.ui.setPlayCharacter('success', 800);
      this.showCatMessage('firstSuccess');
    } else if (comboMilestone >= 8) {
      // Wide clears can jump straight over a boundary (7 -> 9, for example).
      // React to the crossed milestone rather than only exact landing values.
      this.ui.setPlayCharacter('success', 1150);
      this.showCatMessage('combo8');
    } else if (comboMilestone >= 5) {
      this.ui.setPlayCharacter('success', 1000);
      this.showCatMessage('combo5');
    } else if (comboMilestone >= 3) {
      this.ui.setPlayCharacter('cheer', 900);
    } else if (rewardStatus.remaining === 1) {
      this.ui.setPlayCharacter('wave', 900);
      this.ui.previewItemReward();
      // The item gauge already fills in front of the player, so the bubble
      // does not narrate it a second time.
      // this.ui.showMessage('한 번만 더면 아이템 나온다냥!', 1700, 'rewardNear');
    } else if (successLevel >= 3) {
      // A milestone or a reward landed; a short line is earned.
      this.showCatMessage('success');
    }
  }

  async clearRound({ clearAnnounced = false } = {}) {
    // PERFECT means the player emptied the board alone — no rescue shuffle
    // and no transition cleanup of a dried-out tail.
    const perfect = this.state.stageRescues === 0 && this.state.stageNormalClears === 0;
    this.state.inputLocked = true;
    this.telemetry?.roundCleared({ perfect });
    this.stopTimer();
    if (perfect) this.state.cleanClears += 1;
    // The finished garden is the clear's reward: the board is empty, so the
    // art beneath it is fully visible for the first time — hold on it
    // briefly before anything covers it.
    await this.ui.celebrateFullGarden({ perfect });
    const clearedStage = this.state.round;
    const nextRound = clearedStage + 1;
    const clearedConfig = getRoundConfig(clearedStage);
    const nextConfig = getRoundConfig(nextRound);
    const timeBonus = roundTimeBonusSeconds(clearedStage);
    const awardedTimeBonus = Math.max(0, Math.round(cappedSessionTime(this.state.timeLeft, timeBonus) - this.state.timeLeft));
    const scoreBonus = stageClearBonus(clearedStage, this.state.timeLeft, perfect);
    this.state.score += scoreBonus;
    if (!clearAnnounced) roundHaptic();
    duckMusic(680, 0.46);
    if (!clearAnnounced) playRoundClearSound();
    this.ui.showRoundClear({
      scoreBonus,
      timeBonus: awardedTimeBonus,
      stage: clearedStage,
      nextStage: nextRound,
      rows: nextConfig.rows,
      cols: nextConfig.cols,
      perfect,
      boardGrew: nextConfig.rows !== clearedConfig.rows || nextConfig.cols !== clearedConfig.cols,
    });
    this.ui.setPlayCharacter('cheer', 1000);
    this.showCatMessage(perfect ? 'perfect' : 'stage');
    this.updateHUD();
    const [storedItems] = await Promise.all([
      this.storeRoundItems({ soundDelay: 260 }),
      delay(760),
    ]);
    this.state.round = nextRound;
    this.state.stageRescues = 0;
    this.state.stageNormalClears = 0;
    this.state.stageBombUsed = false;
    this.retryStage = nextRound;
    if (!this.runtime.testMode) storageAdapter.saveHighestStage(nextRound);
    const unlockGrant = itemUnlockGrantForStage(nextRound);
    if (unlockGrant) this.grantItems(unlockGrant, { source: 'earned' });
    this.queueStageShowcase(nextRound);
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
    this.ui.updateItems(this.itemHudState());
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
    if (!this.canUseItem()) return;
    if (!this.inventory.canConsume('hint')) {
      this.watchItemRefillAd();
      return;
    }
    this.input.cancel();
    this.beginFirstInteraction();
    const answer = this.model.findHintAnswer();
    if (!answer) {
      this.buildRound();
      this.ui.toast('가능한 보드를 준비했어!');
      return;
    }
    if (!this.inventory.consume('hint').ok) return;
    // 2026-08 실기기 제보: "누르는 느낌이 안 나고 반응이 느리다."
    // 소리와 진동이 135ms 뒤에야 울렸다 - 그 사이 손가락은 아무 대답도
    // 못 받는다. 손이 닿는 즉시 울리고, 답은 60ms 뒤에 뜬다.
    this.ui.flashItemPress('hint');
    itemHaptic();
    playHintSound();
    this.telemetry?.itemUsed('hint');
    this.telemetry?.hint('manual');
    this.syncInventory();
    this.state.inputLocked = true;
    const center = this.ui.tileAt(
      Math.floor((answer.r1 + answer.r2) / 2),
      Math.floor((answer.c1 + answer.c2) / 2),
    );
    const cast = this.ui.animateItemCast('hint', center || this.ui.boardFrame);
    await delay(60);
    this.ui.showHint(answer);
    this.showCatMessage('hint');
    this.ui.setPlayCharacter('wave', 900);
    duckMusic(360, 0.7);
    await cast;
    this.inputGuardUntil = performance.now() + 80;
    this.state.inputLocked = false;
  }

  async useShuffle() {
    if (!this.canUseItem()) return;
    if (!this.inventory.canConsume('shuffle')) {
      this.watchItemRefillAd();
      return;
    }
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
    // 셔플은 전체가 1.3초였다(대기 170 + 나감 400 + 들어옴 480 + 잠금 280).
    // 리듬은 그대로 두고 각 구간을 줄여 절반 가까이 당긴다.
    this.ui.flashItemPress('shuffle');
    itemHaptic();
    playShuffleSound();
    this.telemetry?.itemUsed('shuffle');
    this.syncInventory();
    this.showCatMessage('shuffle');
    duckMusic(420, 0.66);
    const cast = this.ui.animateItemCast('shuffle');
    await delay(60);
    await this.ui.animateShuffleOut();
    this.renderBoard();
    await this.ui.animateShuffleIn();
    itemHaptic();
    await cast;
    this.inputGuardUntil = performance.now() + 140;
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
    // 2026-08 실기기 제보: "폭탄 아이콘이 좀 길게 남아 느린 느낌."
    // 날아가는 시간을 줄여 터지는 순간을 앞당긴다.
    await delay(110);
    await this.resolveBomb({ ...target, stats: this.model.stats(target.rect) });
    await cast;
  }

  async resolveBomb({ rect, stats }, boardItemKey = null) {
    if (!this.ui.hasBombTargetPreview()) {
      this.ui.previewBombTarget(rect);
      // 보드 위 아이템을 직접 누른 경우엔 이미 눌림 연출이 손끝에서
      // 답을 했으므로, 조준을 보여주는 뜸을 절반으로 줄인다. 버튼에서
      // 쏘는 경로(조준이 처음 보이는 자리)는 기존 간격을 지킨다.
      await delay(boardItemKey ? 60 : 130);
    }
    const catCount = Number(stats.catCount) || 0;
    const catBonusPoints = this.classic ? 0 : scoreForCatBonus(catCount, Math.max(1, this.state.combo));
    const points = this.classic
      ? this.classicBlastScore(stats.count + catCount, catCount)
      : scoreForBomb(stats.sum, stats.count) + catBonusPoints;
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
    this.model.remove(rect);
    this.ui.revealClearedCells(rect, [], { includeItems: true });
    this.trackGardenReveal();
    await this.ui.animateBomb(rect);
    await this.finishBlast(boardItemKey);
  }

  async resolveMegaBomb({ row, col, rect, cells, stats }, boardItemKey) {
    const catCount = cells.reduce((count, cell) => count + (this.model.hasBonusCat(cell.r, cell.c) ? 1 : 0), 0);
    const catBonusPoints = this.classic ? 0 : scoreForCatBonus(catCount, Math.max(1, this.state.combo));
    const points = this.classic
      ? this.classicBlastScore(stats.count + catCount, catCount)
      : scoreForMegaBomb(stats.sum, stats.count) + catBonusPoints;
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
    this.model.removeCells(cells);
    this.ui.revealClearedCells({ r1: row, c1: col, r2: row, c2: col }, cells, { includeItems: true });
    this.trackGardenReveal();
    await this.ui.animateMegaBomb(cells, { row, col });
    await this.finishBlast(boardItemKey);
  }

  async finishBlast(boardItemKey = null) {
    if (boardItemKey) this.boardItems.delete(boardItemKey);
    this.state.stageBombUsed = true;
    const remainingAnswer = this.model.findAnswer();
    const remaining = this.model.remainingPlayableCells();
    if (this.classic) {
      const placed = this.placeBoardItems();
      this.renderBoard();
      if (placed.length) this.announceBoardItems(placed);
      if (!remainingAnswer) await this.classicBoardChange({ emptied: remaining === 0 });
      this.inputGuardUntil = performance.now() + 180;
      this.state.inputLocked = false;
      this.updateHUD();
      return;
    }
    const decision = stageEndDecision({
      hasAnswer: Boolean(remainingAnswer),
      boardEmpty: remaining === 0,
      remaining,
      initialPlayable: this.state.initialPlayableCells,
      stageRescues: this.state.stageRescues,
      threshold: normalClearThresholdForStage(this.state.round),
    });
    if (decision === 'advance') {
      this.renderBoard();
      await this.clearRound();
    } else if (decision === 'normal') {
      this.renderBoard();
      await this.normalDryClear();
    } else if (decision === 'rescue') {
      this.renderBoard();
      await this.rescueShuffle();
    } else {
      const placed = this.placeBoardItems();
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
      this.state.score += this.timeItemCapScore();
      if (boardItemKey) {
        this.boardItems.delete(boardItemKey);
        this.renderBoard();
      }
      this.updateHUD();
      this.ui.toast(`시간 보너스 MAX · +${this.timeItemCapScore()}점`);
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
    // 실기기 제보: 시계가 몇 초를 줬는지 안내가 없다. 판갈이 +초와 같은
    // 자리(시간 게이지)에 같은 연출로 띄운다.
    if (gainedTime > 0) this.ui.showStageTimeBonus(Math.round(gainedTime));
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
      this.state.score += this.timeItemCapScore();
      this.boardItems.delete(boardItemKey);
      this.renderBoard();
      this.updateHUD();
      this.ui.toast(`시간 보너스 MAX · +${this.timeItemCapScore()}점`);
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
    this.ui.showTimeNotice(`${Math.round(freezeSeconds)}초 멈춤!`);
    // 시간 게이지의 글자는 얇아서 실기기에서 안 읽혔다. 보드 한가운데에도
    // 세워 준다 - 시간이 멈추는 것은 그만한 사건이다.
    this.ui.showCenterNotice(`시간 ${Math.round(freezeSeconds)}초 멈춤!`, 1500);
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
    this.ui.updateItems(this.itemHudState());
  }

  grantItems(grants, metadata = {}) {
    const result = this.inventory.grantBundle(grants, metadata);
    if (result.ok) this.syncInventory();
    return result;
  }

  tick() {
    // 멈춰 있는데 화면에는 멈춤을 알리는 것이 하나도 없다면, 그건 있을 수
    // 없는 상태다. 유저 눈에는 판이 그대로인데 보드만 안 눌리고 시계도
    // 서 있다 - 실기기에서 "숫자판만 안 눌린다"로 제보된 모습이다.
    // 어느 경로로 그렇게 됐든 여기서 스스로 풀어준다. 오버레이가 떠 있는
    // 정상적인 일시정지는 건드리지 않는다.
    if (this.state.running && this.state.paused && !pauseFamilyOpen() && !this.adFlowActive) {
      this.resume();
      return;
    }
    if (!this.state.running || this.state.paused) return;
    const now = performance.now();
    // 잠금이 풀렸으면 그 사이 눌린 아이템을 대신 실행한다. 해제 지점이
    // 여러 곳(성공/블라스트/판갈이)이라 루프에서 한 번만 확인한다.
    if (this.pendingBoardItemTap && this.canUseItem()) this.flushPendingBoardItemTap();
    if (this.classic) {
      if (!this.maybeShowClassicSparseHint(now)) this.maybeShowClassicAutoHint(now);
    }
    else this.maybeShowBeginnerAutoHint(now);
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
    // The original sounds the alarm once as the clock crosses ten and then
    // leaves the player alone, re-arming only if a bonus lifts time back
    // above twelve. A tick every second was the part that grated.
    if (!isFrozen && this.state.timeLeft > 0 && this.state.timeLeft <= 10 && !this.timeWarned) {
      this.timeWarned = true;
      playTimeWarnBeeps();
      countdownHaptic(3);
    } else if (this.state.timeLeft > 12) {
      this.timeWarned = false;
    }
    const countdownSecond = Math.ceil(this.state.timeLeft);
    if (!isFrozen && countdownSecond > 0 && countdownSecond <= 10 && countdownSecond !== this.lastCountdownSecond) {
      this.lastCountdownSecond = countdownSecond;
      // 마지막 다섯을 세는 심장박동. carry cap 이후 모든 런이 0초 근처에서
      // 끝나므로, 이 다섯 초가 매 판의 클라이맥스다.
      if (countdownSecond <= 5) finalRushHaptic(countdownSecond);
    }
    // 가장자리 붉은 맥박은 클래스 하나로 켠다 - 켜져 있는 5초 동안만
    // 합성 전용(opacity) 애니메이션이 돌고, 꺼지면 비용이 0이다.
    this.ui.setFinalRush(!isFrozen && this.state.running && this.state.timeLeft > 0 && this.state.timeLeft <= 5);
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

  // The beginner's safety net in classic. Same idle trigger as the stage
  // mode's, but budgeted per run rather than once, because a classic run is
  // many boards long and a learner can stall on any of them.
  maybeShowClassicAutoHint(now = performance.now()) {
    if (!shouldShowClassicAutoHint({
      running: this.state.running && !this.state.paused,
      inputLocked: this.state.inputLocked,
      tutorialActive: this.tutorialActive || this.waitingForFirstDrag,
      shownCount: this.classicAutoHints || 0,
      sinceLastMs: now - (this.classicAutoHintAt || -Infinity),
      timeLeft: this.state.timeLeft,
      idleMs: now - this.lastInteractionAt,
      boardIndex: this.classic?.boardIndex ?? -1,
      lastShownBoard: this.classicAutoHintBoard,
      // Classic keeps its own record, so the beginner test has to read it.
      bestScore: storageAdapter.getClassicBestScore(),
      completedRuns: storageAdapter.getClassicRecentScores().length,
    })) return false;
    const answer = this.model.findHintAnswer();
    if (!answer) return false;
    this.classicAutoHints = (this.classicAutoHints || 0) + 1;
    this.classicAutoHintAt = now;
    this.classicAutoHintBoard = this.classic?.boardIndex ?? -1;
    this.telemetry?.hint('auto');
    this.lastInteractionAt = now;
    this.ui.showHint(answer);
    this.ui.setPlayCharacter('wave', 1000);
    this.showCatMessage('autoHint', { force: true });
    return true;
  }

  maybeShowClassicSparseHint(now = performance.now()) {
    const boardIndex = this.classic?.boardIndex ?? -1;
    const base = {
      running: this.state.running && !this.state.paused,
      inputLocked: this.state.inputLocked,
      tutorialActive: this.tutorialActive || this.waitingForFirstDrag,
      boardIndex,
      lastShownBoard: this.classicSparseHintBoard,
      timeLeft: this.state.timeLeft,
      idleMs: now - this.lastInteractionAt,
      remaining: this.model.remainingPlayableCells(),
      initialPlayable: this.state.initialPlayableCells,
      sinceLastShownMs: now - (this.classicSparseHintAt || -Infinity),
    };
    const firstOnThisBoard = boardIndex !== this.classicSparseHintBoard;
    let candidate = null;
    if (firstOnThisBoard) {
      if (!shouldShowClassicSparseHint(base)) return false;
    } else {
      // 같은 판 재발화는 정말 어려운 상태 - 읽기 쉬운 답이 하나도 없을 때 -
      // 로 한정한다(2026-08 실측: 꼬리 구간 수의 74%가 인접쌍 없음). 답
      // 전수 스캔은 공짜가 아니므로 싼 조건들을 먼저 통과시킨 뒤에만 잰다.
      if (!shouldShowClassicSparseHint({ ...base, bestReadability: 'large' })) return false;
      const answers = this.model.findAnswers();
      if (!answers.length) return false;
      candidate = closestReadableAnswer(answers);
      if (!shouldShowClassicSparseHint({ ...base, bestReadability: answerReadabilityClass(candidate) })) return false;
    }
    const answer = candidate || this.model.findHintAnswer();
    if (!answer) return false;
    this.classicSparseHintBoard = boardIndex;
    this.classicSparseHintAt = now;
    this.telemetry?.hint('sparse-tail');
    this.lastInteractionAt = now;
    this.ui.showHint(answer);
    this.ui.setPlayCharacter('wave', 900);
    // 첫 발화만 말을 얹는다 - 같은 판에서 같은 말이 반복되면 잔소리가 된다.
    if (firstOnThisBoard) this.showCatMessage('autoHint', { force: true });
    return true;
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

  // 방법 버튼은 이제 일시정지 안에 있다. 그 상태에서는 이미 paused라
  // pause()가 조기 반환하므로, 오버레이만 바꿔 끼운다. 방법을 닫으면
  // resume()이 불려 바로 판으로 돌아간다 - 일시정지로 되돌아가는 것보다
  // 단계가 하나 적다.
  openHelp() {
    if (this.state.running && this.state.paused) {
      this.ui.setOverlay(this.activePauseOverlay, false);
      this.activePauseOverlay = 'help-overlay';
      this.ui.setPauseReason('help');
      this.ui.setOverlay('help-overlay', true);
      return;
    }
    this.pause('help', 'help-overlay');
  }

  pause(reason = 'manual', overlayId = 'pause-overlay') {
    this.ui.setFinalRush(false);
    // 광고 제안·재생 중에는 일시정지가 끼어들 자리가 없다. 시계는 이미
    // 멈춰 있고, 오버레이가 겹치면 상태가 꼬인다.
    if (this.adContinueOffering || this.adShowing || this.adRefillShowing) return;
    if (!this.state.running || this.state.paused) return;
    this.state.paused = true;
    this.activePauseOverlay = overlayId;
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
    this.ui.setOverlay(overlayId, true);
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
    this.ui.setOverlay(this.activePauseOverlay, false);
    this.activePauseOverlay = 'pause-overlay';
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
      this.startCurrentMode();
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

  // TIME UP 순간의 광고 이어하기. 판당 1회, 토스 안에서 광고가 준비돼
  // 있을 때만 제안한다. true를 돌려주면 판이 되살아난 것이다.
  async maybeOfferAdContinue() {
    if (this.adContinueUsed || this.adContinueOffering) return false;
    if (!adsAvailable('continue') || !adReady('continue')) return false;
    if (!this.state.running || this.state.paused) return false;
    this.adContinueOffering = true;
    this.finishing = true;
    this.stopTimer();
    this.state.timeLeft = 0;
    this.state.inputLocked = true;
    this.input.cancel();
    this.ui.setFinalRush(false);
    this.updateHUD();

    // 끝을 먼저 보여주고 나서 제안한다.
    //
    // 예전에는 시간이 0이 되는 순간 제안 창부터 떴다. 게임이 끝났다는
    // 신호가 하나도 없어서 실기기에서 "툭 끊긴다, 광고 본 것도 아닌데
    // 광고 때문에 김샌다"는 말이 나왔다. TIME UP 도장과 이번 판 점수를
    // 1.2초 세우고 소리까지 낸 다음에 제안이 오면, 제안은 게임을 끊은
    // 것이 아니라 끝난 뒤에 온 덤이 된다.
    //
    // 결과 화면을 먼저 띄우고 제안하는 방법도 있지만 그건 더 나쁘다.
    // '한 판 더'와 '홈으로'를 본 순간 판은 이미 끝난 것이고, 거기서 광고를
    // 권하면 "이제 와서?"가 된다. 되살리려면 결과 화면을 도로 걷어내야
    // 하는 문제도 있다.
    playGameOverSound(false);
    gameOverHaptic(false);
    this.adStampedTimeUp = true;
    await this.ui.stampTimeUp(this.state.score);
    this.ui.clearTimeUpStamp();

    const choice = await this.ui.showContinueOffer(AD_CONTINUE_SECONDS, AD_CONTINUE_OFFER_MS);
    if (choice !== 'watch') {
      this.adContinueOffering = false;
      this.finishing = false;
      return false;
    }

    this.adContinueUsed = true;
    // 광고가 묵어서 다시 불러와야 할 수 있다. 그동안 화면이 멈춰 있으면
    // 눌렀는데 아무 일도 안 일어나는 것처럼 보인다.
    this.ui.showCenterNotice('광고 준비 중...', 2600);
    const { rewarded, amount, shown } = await this.runRewardedAd('continue');
    this.ui.hideCenterNotice();
    this.adContinueOffering = false;
    this.finishing = false;
    if (!rewarded) {
      // 광고가 아예 뜨지 않았다면 그건 우리 사정이다. 조용히 결과로
      // 보내면 "버튼이 먹통"으로 읽힌다(실기기 제보).
      //
      // 떴는데도 보상이 없는 경우가 더 나쁘다. 광고를 본 사람이 아무것도
      // 못 받고 아무 말도 못 듣는다 - 예전에는 여기가 통째로 비어 있었다.
      // 끝까지 안 봤을 수도, 보상 신호가 유실됐을 수도 있어서 누구 탓도
      // 하지 않는 말로 알린다.
      this.ui.toast(
        shown ? '광고 보상을 못 받았다냥... 미안하다냥!' : '광고를 못 불러왔다냥. 미안하다냥!',
        2200,
      );
      return false;
    }

    // 되살리기: 시계만 새로 감고 점수·콤보·판은 그대로 둔다. 지급량은
    // 광고가 알려준 콘솔 등록값을 우선한다 - 콘솔에서 바꾸면 그대로 반영.
    const seconds = amount > 0 ? amount : AD_CONTINUE_SECONDS;
    this.state.timeLeft = seconds;
    this.lowTimeSpoken = false;
    this.state.inputLocked = false;
    this.inputGuardUntil = performance.now() + 150;
    this.telemetry?.itemUsed('ad-continue');
    this.adStampedTimeUp = false;
    this.ui.showTimeNotice(`+${seconds}초!`);
    this.ui.showCenterNotice(`+${seconds}초 이어간다냥!`, 1400);
    this.ui.setPlayCharacter('cheer', 1200);
    this.showCatMessage('adContinue', { force: true });
    roundHaptic();
    this.beginCountdown();
    return true;
  }

  // 친구 초대 리워드. 초대장을 보낸 만큼 힌트를 받고, 다음 판 시작에
  // 지급한다 - 판 재고는 판마다 새로 만들어져 잔고를 쌓아두지 않기 위해서다.
  async openContactsInviteReward() {
    if (this.inviteOpening) return;
    if (!SHARE_REWARD_MODULE_ID || !gameLeaderboardAdapter.isTossEnvironment()) return;
    this.inviteOpening = true;
    const button = document.querySelector('#result-invite-button');
    if (button) button.disabled = true;
    try {
      const module = await import('./vendor/toss-game-center-v1.js');
      if (!module.isContactsInviteSupported?.()) {
        this.ui.toast('토스 앱을 업데이트하면 쓸 수 있다냥!');
        return;
      }
      const { earned } = await module.openContactsInvite(SHARE_REWARD_MODULE_ID);
      if (earned > 0) {
        // 받은 즉시 기기에 남긴다. 결과 화면에서 받고 다음 판에 지급되는
        // 사이에 앱이 닫혀도 보상이 살아남아야 한다.
        this.pendingShareHints = (this.pendingShareHints || 0) + earned;
        if (!this.runtime.testMode) storageAdapter.addPendingShareHints(earned);
        this.ui.toast(`다음 판에 힌트 +${earned} 들어간다냥!`);
      }
    } catch {
      // 실패는 조용히 - 초대는 덤이지 조건이 아니다.
    } finally {
      this.inviteOpening = false;
      if (button) button.disabled = false;
    }
  }

  // 광고를 트는 동안의 집안일: 음악을 멈추고, 배경 전환 감지가 판을
  // 일시정지시키지 않게 막는다(광고 창이 뜨면 visibilitychange가 온다).
  async runRewardedAd(kind) {
    this.adShowing = true;
    pauseMusic();
    try {
      return await showAd(kind);
    } finally {
      this.adShowing = false;
      if (this.settings.music && this.state.running && !this.state.paused) playMusic();
    }
  }

  // 힌트·셔플이 떨어졌을 때의 도움팩. 광고 하나에 둘을 함께 실어 준다 -
  // 긴 광고를 보고 +1만 받는 것이 수지가 안 맞는다는 실기기 제보 때문이다.
  // 판당 1회. 받은 뒤에는 버튼을 다시 눌러 쓴다(자동 사용은 오발동 여지가 있다).
  async watchItemRefillAd() {
    if (this.adHelpPackUsed || this.adRefillShowing) return false;
    if (!adsAvailable('helpPack') || !adReady('helpPack')) return false;
    if (!this.state.running || this.state.paused || this.state.inputLocked) return false;
    // 쓸 시간이 없으면 권하지 않는다. 광고를 다 보고 힌트를 받자마자 판이
    // 끝나면 판 재고와 함께 그대로 사라져, 광고만 본 셈이 된다(실기기 제보).
    if (this.state.timeLeft < AD_HELP_PACK_MIN_SECONDS) {
      this.ui.toast('시간이 얼마 안 남았다냥! 다음 판에 받자냥', 2000);
      return false;
    }

    // 무엇을 받는지 광고 전에 보여준다(정책이자 예의).
    const contents = `힌트 +${AD_HELP_PACK.hint} · 셔플 +${AD_HELP_PACK.shuffle}`;
    this.adRefillShowing = true;
    this.adFlowActive = true;
    this.state.paused = true;
    this.pauseStartedAt = performance.now();
    this.input.cancel();
    const choice = await this.ui.showHelpPackOffer(contents);
    if (choice !== 'watch') {
      this.restoreAfterAdPause();
      return false;
    }
    try {
      const { rewarded, shown } = await this.runRewardedAd('helpPack');
      // 이어하기와 같은 이유로, 떴는데 보상이 없는 경우도 알린다.
      if (!rewarded) {
        this.ui.toast(
          shown ? '광고 보상을 못 받았다냥... 미안하다냥!' : '광고를 못 불러왔다냥. 미안하다냥!',
          2200,
        );
      }
      if (rewarded) {
        this.adHelpPackUsed = true;
        // 팩 내용은 코드가 정한다 - 콘솔 수량은 '팩 1개'라는 뜻일 뿐이다.
        this.grantItems({ ...AD_HELP_PACK }, { source: 'ad' });
        // 이어하기와 같은 무게로 알린다. 예전에는 토스트 한 줄이었는데,
        // 30초짜리 광고를 보고 돌아온 사람이 화면 구석의 작은 글씨로
        // 보상을 확인해야 했다 - 이어하기는 화면 한가운데서 알리면서
        // 도움팩만 그러지 않을 이유가 없다.
        this.ui.showCenterNotice('도움팩 받았다냥!', 1600, { detail: contents });
        // 그리고 숫자가 오른 자리를 짚어 준다. 무엇을 받았는지와 그게
        // 어디로 갔는지는 다른 이야기다.
        this.ui.flashItemStock(Object.keys(AD_HELP_PACK));
        itemHaptic();
      }
      return rewarded;
    } finally {
      this.restoreAfterAdPause();
    }
  }

  // 광고 때문에 세워 둔 시계를 다시 감는다. 멈춘 만큼 마감 시각을 미뤄
  // 광고 길이가 판 시간을 잡아먹지 않게 한다.
  restoreAfterAdPause() {
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
    this.adFlowActive = false;
    this.adRefillShowing = false;
    // 음악을 여기서 되살린다. runRewardedAd의 finally는 이 함수보다 먼저
    // 도는데 그때는 아직 paused가 true라 복원을 건너뛴다 - 그래서 도움팩
    // 광고를 한 번 보면 그 판 내내 배경음악이 꺼져 있었다.
    if (this.settings.music && this.state.running) playMusic();
    this.updateHUD();
  }

  async finish() {
    if (this.classic) {
      // 시간이 다 됐지만 아직 판을 끝내지 않는다. 광고 이어하기를 한 번
      // 제안하고, 거절하거나 광고가 실패하면 그때 finishClassic으로 간다.
      // 점수 제출은 여전히 finishClassic 안에서 한 판에 한 번이다.
      if (await this.maybeOfferAdContinue()) return;
      return this.finishClassic();
    }

    if (!this.state.running || this.finishing) return;
    this.finishing = true;
    this.ui.setFinalRush(false);
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
    // 이어하기 제안 전에 이미 종료 소리와 TIME UP을 냈다면 여기서 또 내지
    // 않는다 - 다만 신기록이면 그 소리는 한 번 더 값어치가 있다.
    const stamped = Boolean(this.adStampedTimeUp);
    this.adStampedTimeUp = false;
    if (!stamped || newRecord) {
      playGameOverSound(newRecord);
      gameOverHaptic(newRecord);
    }
    await this.ui.animateGameEnd({ answers: endAnswers, stamped });
    if (!this.runtime.testMode && newRecord) storageAdapter.saveBestScore(this.state.score);
    if (!this.runtime.testMode && recordEligible) storageAdapter.saveBestCombo(this.state.maxCombo);
    if (!this.runtime.testMode) storageAdapter.saveHighestStage(this.state.round);
    // Rescued cats accumulate across runs — the result card's per-run count
    // reads as part of a growing collection instead of a number that
    // evaporates when the screen closes.
    const catsRescuedTotal = this.runtime.testMode
      ? this.state.catsCollected
      : storageAdapter.addCatsRescued(this.state.catsCollected);
    this.commitLifetimeTotals();
    const cardAward = this.cardsUnlockedThisRun();
    // The garden reveal is the run's second scoreboard. Capture the previous
    // best before saving so the result card can tell the player they beat it.
    const cleanClears = Math.max(0, Math.round(this.state.cleanClears || 0));
    const cleanClearsTotal = this.runtime.testMode
      ? cleanClears
      : storageAdapter.addCleanClears(cleanClears);
    // The home figure belongs to classic, so a stage run refreshes it from
    // storage rather than writing its own (much larger) score into it.
    this.refreshClassicRecordSurfaces();
    this.ui.updateCatsRescued(catsRescuedTotal);
    this.lastResultSummary = {
      cardAward,
      score: this.state.score,
      maxCombo: this.state.maxCombo,
      round: this.state.round,
      successCount: this.state.successCount,
      maxClearCells: this.state.maxClearCells,
      catsCollected: this.state.catsCollected,
      catsRescuedTotal,
      cleanClears,
      cleanClearsTotal,
      rescueShuffles: this.state.rescueShuffles,
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

  // 친구가 보낸 링크를 타고 들어왔는지 본다.
  //
  // 토스 안에서는 진입 스킴 주소에 점수가 실려 온다. 그 값을 읽으려면 다리를
  // 불러야 하는데, 다리는 첫 화면을 그린 뒤에 느긋하게 불러도 된다 - 도전장이
  // 없는 사람에게는 아무 일도 일어나지 않아야 하기 때문이다. 웹에서는 지금
  // 주소의 질의가 같은 일을 한다.
  //
  // 실패는 조용히 넘긴다. 도전장은 덤이지 게임의 조건이 아니다.
  async loadChallenge() {
    let schemeUrl = '';
    if (gameLeaderboardAdapter.isTossEnvironment()) {
      try {
        const module = await import('./vendor/toss-game-center-v1.js');
        schemeUrl = module.getInitialSchemeUrl?.() || '';
      } catch {
        schemeUrl = '';
      }
    }
    const search = typeof location !== 'undefined' ? location.search || '' : '';
    const target = receiveChallenge({ schemeUrl, search });
    this.ui.updateHomeChallenge(target);
    // 링크로 방금 받은 도전장만 말로 알린다. 켤 때마다 말을 걸면 잔소리다.
    if (target > 0 && isFreshChallenge()) {
      this.candy?.say?.(pickMessage('challengeIntro', ''));
      markChallengeSeen();
    }
    return target;
  }

  goHome() {
    // 이긴 판 뒤에는 도전장이 지워져 있다. 띠도 같이 내려야 한다.
    this.ui.updateHomeChallenge(challengeScore());
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
    this.ui.setOverlay('help-overlay', false);
    this.activePauseOverlay = 'pause-overlay';
    this.refreshClassicRecordSurfaces();
    this.candy?.refresh();
    this.ui.showScreen('home');
  }

  setResultTucked(tucked) {
    document.querySelector('.result-card')?.classList.toggle('is-tucked', tucked);
    // 카드 연출 패널도 같이 물러나야 한다. 결과 카드만 내려가면 패널 혼자
    // 기록 창 앞에 남는다.
    document.querySelector('.result-card-award')?.classList.toggle('is-tucked', tucked);
  }

  async openRanking() {
    // 창은 늘 기록 탭으로 연다. 이 창을 여는 흔한 이유는 여전히 점수
    // 확인이고, 수집을 보러 온 사람에게는 탭이 바로 옆에 있다.
    this.ui.setRecordTab('stats');
    // From the result screen the sheet bows out so the panel reads
    // full-screen; every close path brings it back.
    if (document.querySelector('#result-screen')?.classList.contains('is-active')) {
      this.setResultTucked(true);
    }
    const records = await rankingAdapter.open();
    this.refreshClassicRecordSurfaces();
    this.ui.renderRanking(records);
    this.ui.updateCatsRescued(storageAdapter.getCatsRescued());
    // The album lives in the records sheet now: the garden it used to sit in
    // is parked, and this is the surface a player already opens to look back
    // at a run.
    this.ui.renderChapterGallery(classicChapterGallery({
      seenKeys: storageAdapter.getSeenChapters(),
      bestScore: storageAdapter.getClassicBestScore(),
    }));
    // 카드는 판이 아니라 플레이한 행동으로 열린다. 기록 창을 열 때마다
    // 지금 누적값으로 다시 판정한다 - 어딘가에 "열림"을 따로 저장해두면
    // 조건을 손볼 때 이미 열린 카드와 어긋나기 시작한다.
    this.ui.renderOingCards(oingCardRows(this.currentCardTotals()));
    this.ui.setOverlay('ranking-overlay', true);
  }

  async openOingLeaderboard() {
    if (document.querySelector('#result-screen')?.classList.contains('is-active')) {
      this.setResultTucked(true);
    }
    this.oingLeaderboardView.setLoading();
    const nativeButton = document.querySelector('#oing-native-rank-button');
    if (nativeButton) nativeButton.hidden = !this.leaderboardAvailable;
    this.ui.setOverlay('online-ranking-overlay', true);
    await this.refreshOingLeaderboard();
  }

  async refreshOingLeaderboard() {
    const result = await this.oingOnline.leaderboard(this.oingLeaderboardView.mode);
    this.oingLeaderboardView.render(result);
    const player = this.oingOnline.getPlayer();
    const jelly = document.querySelector('#oing-rank-jelly');
    if (jelly && player) {
      jelly.textContent = Number(player.jelly || 0).toLocaleString('ko-KR');
      jelly.hidden = false;
    }
  }

  async toggleOingFriend(entry) {
    if (!entry?.playerId || entry.isMe) return;
    const saved = !entry.isFriend;
    const result = await this.oingOnline.setFriend(entry.playerId, saved);
    if (!result.ok) {
      this.ui.toast('친구 저장은 토스 앱에서 로그인하면 쓸 수 있다냥!');
      return;
    }
    this.ui.toast(saved ? '친구로 저장했다냥! ♡' : '친구 목록에서 뺐다냥');
    await this.refreshOingLeaderboard();
  }

  async openGameLeaderboard() {
    if (!this.leaderboardAvailable) {
      this.ui.toast('랭킹은 토스나 Google Play 앱에서 열린다냥!');
      return;
    }
    // 자체 오잉 랭킹 안의 보조 버튼만 네이티브 랭킹을 연다. 홈·결과·HUD의
    // 주 버튼은 자체 랭킹 입구이므로 네이티브 창을 여는 동안 비활성화하면
    // 사용자가 돌아온 뒤 엉뚱한 버튼까지 잠깐 잠기는 것처럼 보인다.
    const buttons = [document.querySelector('#oing-native-rank-button')].filter(Boolean);
    if (this.leaderboardOpening) return;
    this.leaderboardOpening = true;
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const result = await gameLeaderboardAdapter.open();
      if (!result.ok) this.ui.toast('Google Play 게임 로그인을 확인해달라냥!');
    } finally {
      this.leaderboardOpening = false;
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  openGarden() {
    const total = storageAdapter.getCatsRescued();
    this.ui.updateCatsRescued(total);
    this.ui.renderGarden(total, storageAdapter.getCleanClears());
    this.ui.setOverlay('garden-overlay', true);
  }

  // 모은 장면 한 장을 자랑하는 길. 결과 화면 공유와 같은 경로를 타므로
  // 브라우저가 공유를 막아도 같은 방식으로 클립보드에 떨어진다.
  async shareChapter() {
    const chapter = this.ui.openedChapter;
    if (!chapter) return;
    const result = await shareAdapter.shareChapter(chapter, { imageUrl: this.ui.openedChapterArt });
    if (result.ok && result.method === 'clipboard') {
      this.ui.toast(result.withUrl ? '글과 링크를 복사했다냥!' : '자랑 글귀를 복사했다냥!');
    } else if (result.ok) this.ui.toast('공유창을 열었다냥!');
    else if (result.reason !== 'cancelled') this.ui.toast('이 브라우저에선 공유가 어렵다냥');
  }

  async shareResult() {
    if (!this.lastResultSummary) return;
    const button = document.querySelector('#share-button');
    if (button?.disabled) return;
    if (button) button.disabled = true;
    const result = await shareAdapter.shareResult(this.lastResultSummary);
    if (button) button.disabled = false;
    if (result.ok && result.method === 'clipboard') {
      this.ui.toast(result.withUrl ? '점수와 링크를 복사했다냥!' : '자랑 글귀를 복사했다냥!');
    } else if (result.ok) this.ui.toast('공유창을 열었다냥!');
    else if (result.reason !== 'cancelled') this.ui.toast('이 브라우저에선 공유가 어렵다냥');
  }

  // Classic mode runs its own record book: the score sits on the original's
  // scale, the "stage" figure is the board count, and nothing here touches
  // the stage mode's best score, ranking history, or highest stage.
  async finishClassic() {
    if (!this.state.running || this.finishing) return;
    this.finishing = true;
    this.ui.setFinalRush(false);
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
    // The board the timer ran out on never gets a 판갈이, so its scene would
    // otherwise be unclaimable no matter how far the player got through it.
    this.markChapterCollected(
      1 - this.model.remainingPlayableCells() / Math.max(1, this.state.initialPlayableCells),
    );
    const endAnswers = this.model.findAnswers();
    this.ui.setPlayCharacter(this.state.maxCombo >= 8 ? 'success' : 'cheer');
    const oldBest = storageAdapter.getClassicBestScore();
    const newRecord = this.state.score > oldBest;
    // Built before saveClassicRunScore below, so recentScores are strictly
    // past runs - the judgement compares today against yesterday.
    const classicReaction = buildClassicResultReaction({
      score: this.state.score,
      newRecord,
      previousBest: oldBest,
      recentScores: storageAdapter.getClassicRecentScores(),
    }, {
      recentMessages: storageAdapter.getRecentResultMessages(),
    });
    if (!this.runtime.testMode) storageAdapter.rememberResultMessage(classicReaction.message);
    this.telemetry?.finish(this.state, 'timer');
    fadeOutMusic();
    playGameOverSound(newRecord);
    gameOverHaptic(newRecord);
    await this.ui.animateGameEnd({ answers: endAnswers });
    if (!this.runtime.testMode && newRecord) storageAdapter.saveClassicBestScore(this.state.score);
    const catsRescuedTotal = this.runtime.testMode
      ? this.state.catsCollected
      : storageAdapter.addCatsRescued(this.state.catsCollected);
    this.commitLifetimeTotals();
    // 도전장은 판이 끝난 값으로 판정한다. 이어하기로 늘어난 점수도 그대로
    // 포함된다 - 광고를 봐서 이겼든 한 번에 이겼든 이긴 건 이긴 거다.
    //
    // 다른 저장과 달리 testMode를 가르지 않는다. 도전장은 주소(?vs=)가 만드는
    // 상태라, 시험에서만 꺼버리면 정작 시험이 이 기능을 못 본다. 값이 서는
    // 경우도 링크로 들어왔을 때뿐이라 다른 판을 오염시키지 않는다.
    const challengeVerdict = clearChallengeIfWon(this.state.score);
    const cardAward = this.cardsUnlockedThisRun();
    const seenChapterKeys = storageAdapter.getSeenChapters();
    this.ui.updateCatsRescued(catsRescuedTotal);
    this.lastResultSummary = {
      cardAward,
      score: this.state.score,
      maxCombo: this.state.maxCombo,
      round: this.classic.boardsPlayed,
      successCount: this.state.successCount,
      maxClearCells: this.state.maxClearCells,
      catsCollected: this.state.catsCollected,
      catsRescuedTotal,
      cleanClears: 0,
      cleanClearsTotal: 0,
      rescueShuffles: 0,
      newRecord,
      previousBest: oldBest,
      previousScore: null,
      recordEligible: true,
      // 도전장을 넘은 판은 그게 머리기사다. 점수 구간 멘트보다 앞선다.
      resultMessage: challengeVerdict?.won
        ? pickMessage('challengeWin', '')
        : classicReaction.message,
      // 도전장 판정. 넘었으면 여기서 도전장을 지운다 - 한 번 이긴 상대가
      // 계속 붙어 있으면 그때부터는 목표가 아니라 잔상이다. 이겼을 때만
      // beatScore를 실어, 공유 글귀가 "넘었다냥"으로 바뀌게 한다.
      challenge: challengeVerdict,
      beatScore: challengeVerdict?.won ? challengeVerdict.target : 0,
      // 다음 목표 한 줄. 여기까지 오면 누적값도 최고기록도 이미 저장이 끝난
      // 뒤라, 이 판을 포함한 "지금 남은 몫"이 나온다. 넘지 못한 도전장은 아직
      // 남아 있으므로 후보에 들어간다.
      nextGoal: nextGoalLine({
        totals: this.currentCardTotals(),
        score: this.state.score,
        previousBest: oldBest,
        challengeTarget: challengeVerdict?.won ? 0 : (challengeVerdict?.target || 0),
      }),
      classic: {
        boards: this.classic.boardsPlayed,
        collectedLabels: this.classic.collectedLabels || [],
        collectionCount: CLASSIC_CHAPTERS.filter((chapter) => seenChapterKeys.includes(chapter.key)).length,
        collectionTotal: CLASSIC_CHAPTERS.length,
      },
    };
    this.retryStage = 1;
    if (!this.runtime.testMode) storageAdapter.saveClassicRunScore(this.state.score);
    // 별사탕 적립. 못한 판도 최소치는 받는다 - 2분을 쓰고 아무것도 못 받는
    // 판이 초보를 제일 빨리 지치게 한다.
    //
    // 적립을 결과창에 알리는 것이 이 기능의 안내 전부다. 실기기 제보로
    // "왜 사탕이 생긴 건지 모르겠다"는 말이 나왔는데, 홈에서 숫자만 늘어나면
    // 그 사탕이 판의 대가라는 걸 알 길이 없기 때문이었다. 받은 개수와 함께
    // 총 개수도 보여준다 - 총량이 보여야 "홈 가서 줘야지"가 생긴다.
    if (!this.runtime.testMode) {
      const earned = candyForRun(this.state.score);
      storageAdapter.addCandy(earned);
      // 첫 판만은 한 번 먹일 만큼을 채워 준다. 3~4개만 쌓이고 접시가 숨어
      // 있으면 처음 하는 사람은 이 기능이 있는 줄도 모르고 끝난다.
      const starter = storageAdapter.claimCandyStarter(CANDY_STARTER_MINIMUM);
      this.lastCandyEarned = earned + starter;
      this.lastResultSummary.candy = {
        earned: this.lastCandyEarned,
        total: storageAdapter.getCandy(),
      };
    }
    if (!this.runtime.testMode) {
      void gameLeaderboardAdapter.submitClassicScoreOnce({
        runId: this.activeRunId,
        score: this.state.score,
      });
      // Keep the native board intact while the shared OING board records the
      // same completed run. Neither network path may block the result sheet.
      void this.oingOnline.finishRun({
        clientRunId: this.activeOnlineRunId,
        score: this.state.score,
        successCount: this.state.successCount,
        boards: this.classic.boardsPlayed,
        maxCombo: this.state.maxCombo,
      });
    }
    this.refreshClassicRecordSurfaces();
    // 카드 개봉이 결과 시트보다 먼저다. 시트가 이미 떠 있는 채로 카드가
    // 뜨면 "여러 정보 중 하나"가 되고, 그러면 뜯는 맛이 사라진다.
    // 실기기 제보 "받았으? 싶은 느낌"이 정확히 그 상태였다.
    //
    // 통째로 감싼 이유가 있다. 여기서 무엇이든 던지면 아래 showResult가 영영
    // 안 불리고 finishing이 true로 굳는다 - 어두운 화면에 카드만 떠 있고
    // 아무것도 안 눌리는 판이 되는 것이다. 개봉은 연출이지 결과의 조건이
    // 아니므로, 실패하면 조용히 건너뛰고 결과를 보여주는 것이 맞다.
    const revealHero = cardAward?.fresh?.at(-1);
    if (revealHero) {
      try {
        playWideClearSound();
        cloverHaptic();
        await this.ui.playCardReveal(revealHero, {
          unlockedCount: cardAward.unlockedCount,
          total: cardAward.total,
        });
      } catch {
        this.ui.hideCardReveal?.();
      }
    }
    this.ui.showResult(this.lastResultSummary);
    this.finishing = false;
  }

  // The home card and the records sheet are about classic now: one figure,
  // the classic best. How far the cat has travelled is the chapter gallery's
  // job, so the card no longer carries a second line for it.
  refreshClassicRecordSurfaces() {
    this.ui.updateBestScore(storageAdapter.getClassicBestScore());
    this.ui.updateCandyFed(storageAdapter.getFedCount());
  }

  updateHUD() {
    const comboWindowMs = comboWindowMsForStage(this.state.round);
    const rewardStage = this.classic
      ? classicDropStage(this.classic.boardIndex)
      : this.state.round;
    const rewardStatus = itemRewardStatus(this.state.combo, this.state.maxCombo, rewardStage);
    this.ui.updateHUD({
      ...this.state,
      // Classic HUD counts boards and has no combo timeout. Its item gauge
      // still follows the same run high-water rule used by advanceCombo().
      round: this.classic ? this.classic.boardsPlayed : this.state.round,
      rewardRemaining: rewardStatus.remaining,
      rewardProgress: rewardStatus.progress,
      comboRemainingMs: this.classic
        ? comboWindowMs
        : this.state.combo > 0
          ? Math.max(0, this.state.comboExpiresAt - performance.now())
          : 0,
      comboWindowMs,
      duration: this.classic ? Math.max(this.stageDuration, this.state.timeLeft) : this.stageDuration,
      timed: this.stageDuration > 0,
      freezeRemaining: Math.max(0, (this.freezeEndsAt - performance.now()) / 1000),
      gardenFromStart: Boolean(this.classic),
      classicMode: Boolean(this.classic),
      bestScore: this.classic ? storageAdapter.getClassicBestScore() : storageAdapter.getBestScore(),
    });
  }

  // The chatty categories get a cooldown. A near-expert QA run logged 187
  // bubble lines in under seven minutes - one every 2.2s - with the cat
  // bonus trio alone firing 59 times; at that density the bubble is noise.
  // Only the high-frequency celebration categories are cooled: feedback the
  // player acts on (fail, nearMiss, lowTime), rare events (wow, clutch,
  // freeze, clover) and player-triggered lines (hint, shuffle, rescue) all
  // still speak every time. Cooldowns scale naturally with skill - at a
  // novice's pace almost nothing is suppressed.
  static CAT_MESSAGE_COOLDOWN_MS = Object.freeze({
    catBonus: 15000,
    itemDrop: 10000,
    bomb: 8000,
    megabomb: 8000,
    combo3: 8000,
    combo5: 8000,
    combo8: 8000,
    success: 5000,
    tapEnd: 6000,
  });

  // The bubble speaks only when it has something a player would act on or
  // remember. Routine praise stayed silent behind cooldowns before, but the
  // real problem was that it spoke at all: a line on every clear made the
  // bottom of the screen a second thing to watch while the board was the
  // first. These are the moments that keep their voice - guidance the player
  // uses (hints, rescues, being stuck), things they must react to (a drop
  // landed, time is short), and the rare peaks worth marking (a big clear, a
  // new scene, the run's own milestones). Everything else - ordinary
  // successes, low combo tiers, cat bonuses and misses are already told by
  // the score, the combo counter and the tile animation, so the cat lets
  // those speak for themselves. Five and eight-plus are rare enough to earn
  // one short line without bringing the old chatter back.
  static CAT_MESSAGE_ALWAYS = Object.freeze(new Set([
    'start', 'tapEnd', 'firstSuccess',
    'hint', 'autoHint', 'struggleHint', 'shuffle', 'rescue',
    'itemDrop', 'bomb', 'megabomb', 'clock', 'freeze', 'clover', 'cloverSuccess',
    'lowTime', 'clutch', 'wow', 'perfect', 'combo5', 'combo8',
    'classicClear', 'classicChapter', 'classicBoard', 'result',
  ]));

  showCatMessage(type, { force = false } = {}) {
    if (!force && !OingGame.CAT_MESSAGE_ALWAYS.has(type)) return;
    const cooldown = OingGame.CAT_MESSAGE_COOLDOWN_MS[type] || 0;
    if (cooldown) {
      const now = performance.now();
      const last = this.catMessageLastAt?.[type] || 0;
      if (now - last < cooldown) return;
      (this.catMessageLastAt ||= {})[type] = now;
    }
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
installBackNavigation(game);
// 광고가 배경에서 준비되거나 소모되면 아이템 버튼의 배지를 다시 그린다.
onAdReadyChange(() => { if (game.state?.running) game.updateHUD(); });
// 홈의 별사탕 접시. 고양이에게 끌어다 주면 포즈가 바뀌고 말풍선이 뜬다.
// 반응은 candy.js가 직접 낸다 - 토스트까지 겹치면 같은 말이 두 군데서 난다.
game.candy = installCandyFeeding();
// 도전장은 사탕 접시 다음이다. 안내를 홈 말풍선으로 내보내는데, 그 말풍선의
// 주인이 방금 붙은 candy.js이기 때문이다.
void game.loadChallenge();

if (game.runtime.testMode) {
  window.__OING_TEST__ = {
    // 카드 개봉만 따로 돌려본다. 실제 판정은 testMode에서 꺼져 있어서
    // (cardsUnlockedThisRun) 시험으로는 이 연출을 볼 길이 없다.
    previewCardReveal: (index = 0) => game.ui.playCardReveal(OING_CARDS[index] || OING_CARDS[0], {
      unlockedCount: Math.max(1, Math.round(Number(index) || 0) + 1),
      total: OING_CARDS.length,
    }),
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
    startClassic: async () => {
      const countdown = game.ui.animateStartCountdown;
      game.ui.animateStartCountdown = async (_steps, onStep = () => {}) => {
        onStep('GO!');
        return true;
      };
      try {
        await game.start(1, { classic: true });
      } finally {
        game.ui.animateStartCountdown = countdown;
      }
      return structuredClone(game.state);
    },
    getClassic: () => (game.classic ? { ...game.classic } : null),
    classicJumpBoard: (boardIndex = 0) => {
      if (!game.classic) return null;
      game.classic.boardIndex = Math.max(0, Math.floor(Number(boardIndex) || 0));
      game.state.round = classicRoundForBoard(game.classic.boardIndex);
      game.buildRound();
      return game.classic.boardIndex;
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
    setScore: (points = 0) => {
      game.state.score = Math.max(0, Math.round(Number(points) || 0));
      game.updateHUD();
      return game.state.score;
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
