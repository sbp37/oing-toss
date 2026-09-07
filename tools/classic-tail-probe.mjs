// 꼬리 구간 답 발견성 측정 도구.
// 판 잔여율 구간(100-70 / 70-40 / 40-0%)별로 "가장 읽기 쉬운 답"의 형태를
// 집계한다. 2026-08 실측: 초반은 100% 인접 두 칸 답이 있지만 꼬리에서는
// 26%로 떨어지고, 절반이 빈칸 건너 답(gap2)이나 2D 박스만 남는다 - 이것이
// 후반 "수색 노동"의 정체이고, 꼬리 무료 힌트 재발화의 근거다
// (data.js shouldShowClassicSparseHint 주석 참고).
//
// 쓰는 법: node tools/classic-tail-probe.mjs
import { BoardModel } from '../js/board.js';
import {
  classicBoardForIndex, classicBoardRuleForIndex, classicRoundForBoard,
} from '../js/data.js';

function classify(answer) {
  const h = answer.r2 - answer.r1 + 1;
  const w = answer.c2 - answer.c1 + 1;
  const cells = h * w;
  if (answer.count === 2 && cells === 2) return 'adj2';
  if (answer.count === 2) return 'gap2';       // 빈칸을 품은 2숫자 답
  if (h === 1 || w === 1) return 'line';
  return 'box';
}

function pickAnswerLikeHuman(answers) {
  let total = 0;
  const weights = answers.map((a) => {
    const h = a.r2 - a.r1 + 1; const w = a.c2 - a.c1 + 1;
    const wgt = (a.count === 2 && h * w === 2) ? 2.4 : (h >= 2 && w >= 2) ? 0.9 : a.count === 2 ? 1.6 : 1.1;
    total += wgt; return wgt;
  });
  let roll = Math.random() * total;
  for (let i = 0; i < answers.length; i += 1) { roll -= weights[i]; if (roll <= 0) return answers[i]; }
  return answers.at(-1);
}

// 잔여율 구간: 100-70 / 70-40 / 40-0 (%)
const bands = { early: [], mid: [], tail: [] };
const model = new BoardModel(6);
const BOARDS = 120;
for (let b = 0; b < BOARDS; b += 1) {
  const idx = b % 8; // 사다리 전 구간 골고루
  const spec = classicBoardForIndex(idx);
  const rule = classicBoardRuleForIndex(idx);
  model.generateClassic(spec.cols, spec.rows, classicRoundForBoard(idx), { catMultiplier: rule?.catMultiplier });
  const initial = model.remainingPlayableCells();
  while (true) {
    const answers = model.findAnswers();
    if (!answers.length) break;
    const remainRatio = model.remainingPlayableCells() / initial;
    const kinds = new Set(answers.map(classify));
    const easiest = kinds.has('adj2') ? 'adj2' : kinds.has('line') ? 'line' : kinds.has('gap2') ? 'gap2' : 'box';
    const band = remainRatio > 0.7 ? 'early' : remainRatio > 0.4 ? 'mid' : 'tail';
    bands[band].push({ easiest, count: answers.length });
    model.remove(pickAnswerLikeHuman(answers));
  }
}
for (const [name, rows] of Object.entries(bands)) {
  const n = rows.length;
  const share = (k) => (rows.filter((r) => r.easiest === k).length / n * 100).toFixed(0);
  const avgAnswers = (rows.reduce((s, r) => s + r.count, 0) / n).toFixed(1);
  console.log(`${name} (n=${n}): 최쉬운답 adj2 ${share('adj2')}% / line ${share('line')}% / gap2 ${share('gap2')}% / box ${share('box')}%  · 평균 답 개수 ${avgAnswers}`);
}
