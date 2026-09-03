// 클래식 모드 헤드리스 밸런스 시뮬레이터.
// 실제 js/board.js(보드 생성/솔버)와 js/data.js(점수/시간/드랍 상수)를 그대로
// import해 game.js의 클래식 루프를 재현한다. 밸런스 상수를 바꾸기 전과 후에
// 돌려 분포를 비교하는 것이 용도다. HANDOFF.md의 "게임 규칙이나 밸런스를
// 바꿀 때는 먼저 측정한다" 원칙의 도구.
//
// 쓰는 법:
//   RUNS=40 node tools/classic-balance-sim.mjs
//   RUNS=30 OPTS='{"fatigue":{"fromBoard":5,"perBoard":1,"floor":2}}' \
//     node tools/classic-balance-sim.mjs      # 상수 실험(코드 수정 없이)
//
// 프로필 보정: 브라우저 봇 실측(HANDOFF.md 표)과 대조해 맞춘 값이다.
// 아이템은 시간류(+5초 시계, 동결)와 폭탄류(최적 블라스트)를 확률로 잡는
// 근사라, 절대값보다 "전후 비교"에 쓰는 것이 안전하다.
import { BoardModel, findBestBombTarget } from '../js/board.js';
import {
  GAME_DURATION_SECONDS,
  CLASSIC_BOARD_LADDER,
  CLASSIC_REFUND_FATIGUE,
  classicBoardForIndex,
  classicBoardRuleForIndex,
  classicBoardChangeSeconds,
  classicRefundWithFatigue,
  classicTimeAfterBoardChange,
  classicRoundForBoard,
  classicComboGain,
  classicComboMultiplier,
  classicComboAfterFailure,
  classicScoreForClear,
  classicScoreForBlast,
  classicDropStage,
  chooseBoardDrop,
  nextBoardDropPity,
  boardDropRewardForRun,
  availableItemTimeBonus,
  scoreForCloverBonus,
  TIME_FREEZE_SECONDS,
  ITEM_REWARD_INTERVAL,
} from '../js/data.js';

// 사람 눈의 답 선택 가중치 — board.js pickAnswerLikeHuman과 동일 로직(비공개라 복제)
function pickAnswerLikeHuman(answers) {
  let total = 0;
  const weights = answers.map((answer) => {
    const height = answer.r2 - answer.r1 + 1;
    const width = answer.c2 - answer.c1 + 1;
    const weight = (answer.count === 2 && height * width === 2) ? 2.4
      : (height >= 2 && width >= 2) ? 0.9
        : answer.count === 2 ? 1.6 : 1.1;
    total += weight;
    return weight;
  });
  let roll = Math.random() * total;
  for (let index = 0; index < answers.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return answers[index];
  }
  return answers.at(-1);
}

// 숙련 봇은 큰 묶음(WOW)을 노린다: count 큰 답을 선호하는 선택
function pickAnswerGreedy(answers) {
  const sorted = [...answers].sort((a, b) => b.count - a.count);
  const top = sorted.filter((a) => a.count === sorted[0].count);
  return top[Math.floor(Math.random() * top.length)];
}

function gauss(mean, sd) {
  let u = 0; let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function simulateRun(profile, opts = {}) {
  const model = new BoardModel(6);
  const S = {
    time: GAME_DURATION_SECONDS,   // 남은 시간(초). 벽시계 진행 = 소비량 누적
    elapsed: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    boardIndex: 0,
    boardsPlayed: 1,
    cats: 0,
    cells: 0,
    itemTimeUsed: 0,
    dropsEarned: 0,
    pity: {},
    lastDropType: null,
    cloverGiven: false,
    cloverPending: false,
    pendingItems: [],   // 떨어졌지만 아직 안 잡은 아이템
    wowCount: 0,
    boardLog: [],       // 판별 {board, score, seconds, refund}
    scoreFromBlast: 0,
    scoreBaseCells: 0,  // (cells+cats*5) 부분 x1 배율로 쳤을 때 — 콤보 기여 분해용
    totalRefund: 0,
    peakTime: GAME_DURATION_SECONDS,
    scoreFirst2Min: null,
    tenseSeconds: 0,   // 남은 시간 20초 미만으로 보낸 시간
    clutchSeconds: 0,  // 10초 미만
  };
  const overhead = opts.overhead ?? 0.55;      // 성공 처리 잠금+연출 평균(초)
  const boardChangeCost = opts.boardChangeCost ?? 1.7; // 판갈이 연출 동안 타이머 진행
  const cap = opts.timeCapSeconds;             // 실험용 오버라이드
  const carryCap = opts.carryCap;              // 실험용: 환급이 넘지 못하는 선
  const refundScale = opts.refundScale ?? 1;   // 실험용: 판갈이 환급 배율
  const fatigueOverride = opts.fatigue;        // 실험용 {fromBoard, perBoard, floor}
  const ladderOverride = opts.ladder;          // 실험용 [{timeFloor,timeBonus}...]

  let boardScoreAtStart = 0;
  let boardStartElapsed = 0;

  // 사다리 오버라이드는 판 크기까지 바꾼다. 예전에는 환급 상수(timeFloor,
  // timeBonus)만 갈아끼워서, 정작 "1판을 작게" 같은 실험을 이 도구로 못 했다.
  const ladderSpec = (index) => {
    const base = classicBoardForIndex(index);
    const over = ladderOverride?.[Math.min(index, (ladderOverride?.length ?? 1) - 1)];
    return over ? { ...base, ...over } : base;
  };

  const newBoard = () => {
    const spec = ladderSpec(S.boardIndex);
    const rule = classicBoardRuleForIndex(S.boardIndex);
    model.generateClassic(spec.cols, spec.rows, classicRoundForBoard(S.boardIndex), {
      catMultiplier: rule?.catMultiplier,
    });
    S.initialPlayable = model.remainingPlayableCells();
    boardScoreAtStart = S.score;
    boardStartElapsed = S.elapsed;
  };

  const refundWithFatigue = (seconds, finishedBoardNumber) => {
    const F = fatigueOverride ?? CLASSIC_REFUND_FATIGUE;
    const paid = Math.max(0, seconds) * refundScale;
    const past = Math.max(0, finishedBoardNumber - F.fromBoard);
    if (past <= 0) return paid;
    return Math.max(F.floor, paid - F.perBoard * past);
  };

  const boardChange = () => {
    const clearedBoard = ladderSpec(S.boardIndex);
    const clearedRatio = Math.min(1, Math.max(0, 1 - model.remainingPlayableCells() / Math.max(1, S.initialPlayable)));
    const refund = refundWithFatigue(
      classicBoardChangeSeconds(clearedBoard, clearedRatio),
      S.boardsPlayed,
    );
    const before = S.time;
    if (carryCap != null) S.time = Math.max(S.time, Math.min(S.time + refund, carryCap));
    else if (cap != null) S.time = Math.min(S.time + refund, cap);
    // 기본 경로는 실제 코드의 규칙을 그대로 쓴다 - 상수가 바뀌면 시뮬도
    // 자동으로 따라온다. (carry cap 도입 때 여기가 갈라져 있던 것을 고침)
    else S.time = classicTimeAfterBoardChange(S.time, refund);
    S.totalRefund += S.time - before;
    S.peakTime = Math.max(S.peakTime, S.time);
    S.boardLog.push({
      board: S.boardsPlayed,
      score: S.score - boardScoreAtStart,
      seconds: +(S.elapsed - boardStartElapsed).toFixed(1),
      refund: +(S.time - before).toFixed(1),
      clearedRatio: +clearedRatio.toFixed(2),
      combo: S.combo,
    });
    S.boardIndex += 1;
    S.boardsPlayed += 1;
    spend(boardChangeCost);
    newBoard();
  };

  const spend = (seconds) => {
    if (S.time < 20) S.tenseSeconds += seconds;
    if (S.time < 10) S.clutchSeconds += seconds;
    S.time -= seconds;
    S.elapsed += seconds;
    if (S.scoreFirst2Min === null && S.elapsed >= 120) S.scoreFirst2Min = S.score;
  };

  const maybeDrop = (previousCombo, previousMax) => {
    const reward = boardDropRewardForRun({
      previousCombo, nextCombo: S.combo, bestComboBefore: previousMax,
    });
    const dropStage = classicDropStage(S.boardIndex);
    if (!reward || dropStage < 3) return;
    const drop = chooseBoardDrop(S.combo, Math.random, {
      cloverGiven: S.cloverGiven,
      pity: S.pity,
      previousType: S.lastDropType,
      rewardIndex: S.dropsEarned,
      stage: dropStage,
      timeBonusCapped: availableItemTimeBonus(S.itemTimeUsed, 1) <= 0,
      lateRun: S.boardsPlayed > CLASSIC_REFUND_FATIGUE.fromBoard,
    });
    S.pity = nextBoardDropPity(S.pity, drop?.id || '', { stage: dropStage, combo: S.combo });
    if (!drop) return;
    S.dropsEarned += 1;
    S.lastDropType = drop.id;
    if (drop.id === 'clover') S.cloverGiven = true;
    S.pendingItems.push(drop.id);
  };

  const fireItem = (type) => {
    if (type === 'clock') {
      const gain = availableItemTimeBonus(S.itemTimeUsed, 5);
      S.itemTimeUsed += gain;
      S.time = Math.min(S.time + gain, cap ?? 300);
      return;
    }
    if (type === 'freeze') {
      // 10초 동결 = 실질 +10초 (동결 중 플레이 지속)
      S.time = Math.min(S.time + TIME_FREEZE_SECONDS, cap ?? 300);
      return;
    }
    if (type === 'clover') { S.cloverPending = true; return; }
    if (type === 'bomb' || type === 'megabomb') {
      const limit = type === 'megabomb' ? 12 : 6;
      const target = findBestBombTarget(model.grid, limit);
      if (!target) return;
      const stats = model.stats(target.rect);
      const catCount = stats.catCount;
      const points = classicScoreForBlast(stats.count + catCount, catCount, S.combo);
      S.score += points;
      S.scoreFromBlast += points;
      S.cats += catCount;
      S.cells += stats.count + catCount;
      model.remove(target.rect);
      spend(0.4);
      if (!model.findAnswer()) boardChange();
    }
  };

  newBoard();

  while (S.time > 0) {
    // 실수 여부
    if (Math.random() < profile.mistakeRate) {
      spend(Math.max(0.4, gauss(profile.think * 0.7, profile.think * 0.2)));
      S.combo = classicComboAfterFailure(S.combo);
      continue;
    }
    const answers = model.findAnswers();
    if (!answers.length) { boardChange(); continue; }
    const pick = (profile.greedy && Math.random() < profile.greedy)
      ? pickAnswerGreedy(answers)
      : pickAnswerLikeHuman(answers);
    // 생각 시간: 답이 귀할수록 오래 걸린다 (탐색 피로)
    const scarcity = answers.length <= 2 ? 1.35 : answers.length <= 4 ? 1.15 : 1;
    spend(Math.max(0.35, gauss(profile.think * scarcity, profile.think * 0.28)) + overhead);
    if (S.time <= 0) break;

    const stats = model.stats(pick);
    const catCount = stats.catCount;
    const cleared = stats.count + catCount;
    const prevCombo = S.combo;
    const prevMax = S.maxCombo;
    S.combo += classicComboGain(cleared);
    S.maxCombo = Math.max(S.maxCombo, S.combo);
    let points = classicScoreForClear(cleared, catCount, S.combo);
    S.scoreBaseCells += cleared + catCount * 5;
    if (S.cloverPending) { points += scoreForCloverBonus(points); S.cloverPending = false; }
    S.score += points;
    S.cats += catCount;
    S.cells += cleared;
    if (cleared >= 5) S.wowCount += 1;
    model.remove(pick);
    maybeDrop(prevCombo, prevMax);

    // 떨어진 아이템 잡기 (프로필별 확률)
    while (S.pendingItems.length && Math.random() < profile.catchRate) {
      fireItem(S.pendingItems.shift());
    }

    if (!model.findAnswer()) {
      if (S.time <= 0) break;
      boardChange();
    }
  }

  // 마지막 미완 판 로그
  S.boardLog.push({
    board: S.boardsPlayed,
    score: S.score - boardScoreAtStart,
    seconds: +(S.elapsed - boardStartElapsed).toFixed(1),
    refund: 0,
    clearedRatio: null,
    combo: S.combo,
  });

  return {
    score: S.score,
    minutes: +(S.elapsed / 60).toFixed(2),
    boards: S.boardsPlayed,
    maxCombo: S.maxCombo,
    cats: S.cats,
    cells: S.cells,
    wow: S.wowCount,
    drops: S.dropsEarned,
    itemTime: S.itemTimeUsed,
    blastShare: S.score ? +(S.scoreFromBlast / S.score).toFixed(3) : 0,
    totalRefund: +S.totalRefund.toFixed(0),
    peakTime: +S.peakTime.toFixed(0),
    tenseShare: +(S.tenseSeconds / Math.max(1, S.elapsed)).toFixed(2),
    clutchShare: +(S.clutchSeconds / Math.max(1, S.elapsed)).toFixed(2),
    first2MinShare: S.scoreFirst2Min === null ? 1 : +(S.scoreFirst2Min / Math.max(1, S.score)).toFixed(2),
    // 콤보가 없었다면(항상 x1) 벌었을 기본 점수 → 콤보 기여도
    comboLeverage: S.scoreBaseCells ? +(S.score / S.scoreBaseCells).toFixed(1) : 0,
    boardLog: S.boardLog,
  };
}

export const PROFILES = {
  novice: { name: '초보', think: 3.4, mistakeRate: 0.16, catchRate: 0.4, greedy: 0 },
  regular: { name: '보통', think: 1.9, mistakeRate: 0.07, catchRate: 0.7, greedy: 0.3 },
  expert: { name: '숙련', think: 1.05, mistakeRate: 0.02, catchRate: 0.9, greedy: 0.6 },
};

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

export function summarize(results) {
  const pickSorted = (key) => results.map((r) => r[key]).sort((a, b) => a - b);
  const stat = (key) => {
    const s = pickSorted(key);
    return {
      mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1),
      p10: +quantile(s, 0.1).toFixed(1),
      p50: +quantile(s, 0.5).toFixed(1),
      p90: +quantile(s, 0.9).toFixed(1),
    };
  };
  return {
    score: stat('score'),
    minutes: stat('minutes'),
    boards: stat('boards'),
    maxCombo: stat('maxCombo'),
    comboLeverage: stat('comboLeverage'),
    wow: stat('wow'),
    blastShare: stat('blastShare'),
    totalRefund: stat('totalRefund'),
    peakTime: stat('peakTime'),
    tenseShare: stat('tenseShare'),
    clutchShare: stat('clutchShare'),
    first2MinShare: stat('first2MinShare'),
  };
}

const RUNS = Number(process.env.RUNS || 40);
if (process.argv[1] && process.argv[1].endsWith('classic-balance-sim.mjs')) {
  const opts = process.env.OPTS ? JSON.parse(process.env.OPTS) : {};
  for (const key of Object.keys(PROFILES)) {
    const results = [];
    for (let i = 0; i < RUNS; i += 1) results.push(simulateRun(PROFILES[key], opts));
    const s = summarize(results);
    console.log(`\n=== ${PROFILES[key].name} (${RUNS}판) ===`);
    console.log(`점수    mean ${s.score.mean}  p10 ${s.score.p10}  p50 ${s.score.p50}  p90 ${s.score.p90}`);
    console.log(`런 길이 mean ${s.minutes.mean}분  p10 ${s.minutes.p10}  p50 ${s.minutes.p50}  p90 ${s.minutes.p90}`);
    console.log(`도달 판 mean ${s.boards.mean}  p90 ${s.boards.p90}`);
    console.log(`최고콤보 mean ${s.maxCombo.mean}  콤보 레버리지(점수/기본점수) mean ${s.comboLeverage.mean}`);
    console.log(`WOW mean ${s.wow.mean}  블라스트 점수비중 mean ${s.blastShare.mean}`);
    console.log(`판갈이 환급합 mean ${s.totalRefund.mean}s  시계 최고치 mean ${s.peakTime.mean}s  첫2분 점수비중 mean ${s.first2MinShare.mean}`);
    console.log(`긴장 비중(20초 미만) mean ${s.tenseShare.mean}  클러치(10초 미만) mean ${s.clutchShare.mean}`);
    // 판별 점수/시간 곡선 (중앙값 근처 런 하나)
    const sortedByScore = [...results].sort((a, b) => a.score - b.score);
    const median = sortedByScore[Math.floor(sortedByScore.length / 2)];
    const rows = median.boardLog.map((b) => `판${b.board}: ${b.score}점/${b.seconds}s(+${b.refund}s, 콤보${b.combo})`);
    console.log(`중앙값 런 판별: ${rows.join('  ')}`);
  }
}
