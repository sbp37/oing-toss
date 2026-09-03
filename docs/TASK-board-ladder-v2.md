# 작업 지시서 — 보드 사다리 v2: 반복 없이 끝까지 자라는 판

작성 2026-09-03 · 기준 main `69d4846` + `codex/toss-promo-interstitial-v1` (`8ebdfe9`)

읽는 대상: 이 작업을 구현할 작업자(코덱스). 게임 규칙은 안 바뀐다.
바뀌는 것은 **판이 몇 판째에 어떤 크기인가** 하나와, 그에 딸린 화면·테스트다.

---

## 0. 한 줄 요약

> 판 크기를 **5×6 → 6×6 → 7×6 → 8×6 → 9×6 → 9×7 → 10×7(고정)** 으로 바꾼다.
> 매 판 크기가 바뀌고, 최대 크기에서 칸이 점점 작아진다.
> **열(cols)은 7을 절대 넘지 않는다.** 360×780에서 칸이 40px 밑으로 내려가면 실패다.

---

## 1. 왜 이렇게 하나 — 결정 근거 (바꾸지 말 것)

측정한 사실만 적는다. 근거가 바뀌면 결정도 바꿔야 하지만, 근거 없이 바꾸지 말 것.

### 1-1. 열은 7까지, 성장은 행으로

360×780 실측 (Playwright, `--board-cols/rows` + `is-tall-board` + `data-board-rows` 적용):

| 보드 (행×열) | 칸 수 | 칸 크기 | |
| --- | --- | --- | --- |
| 5×6 ~ 8×6 (지금 사다리 전부) | 30~48 | **52~54px** | |
| 9×6 | 54 | 48px | 여기부터 높이가 잡는다 |
| 9×7 | 63 | 44.6px | |
| **10×7** | 70 | **42.6px** | **물리적 한계** |
| 11×7 | 77 | 38.4px | 40 미달 — 금지 |
| 7×8 (8열) | 56 | 38.8px | 40 미달 — 금지 |

같은 칸 수라도 세로가 크다: **8×6(48칸)=52px, 7×7(49칸)=44.6px.** 폰이 세로로 길기
때문이다. 9행부터는 폭이 아니라 높이(보드 높이 상한 ≈445px)가 잡으므로 8열은
의미가 없다.

### 1-2. 반복(같은 크기 두 번)은 뺀다

시뮬레이션 40판×3프로필 (`tools/classic-balance-sim.mjs`):

| | 현재 (5×6 두 번) | 반복 없음 (이 지시서) | 차이 |
| --- | --- | --- | --- |
| 초보 점수 | 1,827 | 1,812 | 없음 |
| 초보 도달 판 | 4.0 | 3.8 | 없음 |
| 보통 점수 | 5,949 | 5,654 | −5% |
| 숙련 점수 | 15,193 | 14,748 | −3% |
| 숙련 도달 판 | 10.9 | 8.9 | 판이 커져서 |
| 숙련이 보는 크기 종류 | 4가지 (판5부터 8×6 고정) | **7가지** (판7까지 계속 변함) | |

5×6을 두 번 준 것은 초보 보호였는데 초보 점수가 안 움직인다. 보호는 "첫 판이
5×6"에서 오지 "두 번"에서 오지 않는다. **첫 판 5×6은 지키고 반복만 뺀다.**

### 1-3. 4×4 시작은 하지 않는다

시뮬에서 4×4를 첫 판에 넣으면 초보 −11%, 첫 판이 23초 동안 30점이다.
답 6개·고양이 1마리라 콤보가 안 붙고 금방 마른다. 예전에 "3판째에서
나가떨어진다"(3판 이탈 57%)를 첫 판 5×6으로 고쳤는데, 4×4는 그걸 되돌린다.

---

## 2. 사다리 정의

`js/data.js`의 `CLASSIC_BOARD_LADDER` 를 아래로 교체한다. **`rows`/`cols` 키
이름을 그대로 쓸 것.** 아래 표는 행×열이다.

| 판 (boardIndex) | rows | cols | 칸 | timeFloor | timeBonus |
| --- | --- | --- | --- | --- | --- |
| 1 (0) | 5 | 6 | 30 | 4 | 10 |
| 2 (1) | 6 | 6 | 36 | 5 | 13 |
| 3 (2) | 7 | 6 | 42 | 5 | 15 |
| 4 (3) | 8 | 6 | 48 | 5 | 16 |
| 5 (4) | 9 | 6 | 54 | 5 | 17 |
| 6 (5) | 9 | 7 | 63 | 5 | 18 |
| 7+ (6~) | 10 | 7 | 70 | 5 | 18 |

```js
export const CLASSIC_BOARD_LADDER = Object.freeze([
  Object.freeze({ rows: 5,  cols: 6, timeFloor: 4, timeBonus: 10 }),
  Object.freeze({ rows: 6,  cols: 6, timeFloor: 5, timeBonus: 13 }),
  Object.freeze({ rows: 7,  cols: 6, timeFloor: 5, timeBonus: 15 }),
  Object.freeze({ rows: 8,  cols: 6, timeFloor: 5, timeBonus: 16 }),
  Object.freeze({ rows: 9,  cols: 6, timeFloor: 5, timeBonus: 17 }),
  Object.freeze({ rows: 9,  cols: 7, timeFloor: 5, timeBonus: 18 }),
  Object.freeze({ rows: 10, cols: 7, timeFloor: 5, timeBonus: 18 }),
]);
```

`classicBoardForIndex()`는 마지막 계단을 반복하므로 판8 이후는 자동으로 10×7이다.
`CLASSIC_REFUND_FATIGUE`(5판 이후 판갈이 환급 −1.5초/판)는 그대로 둔다.

시뮬레이션 1-2의 "반복 없음" 열은 정확히 이 상수로 낸 값이다. 구현 뒤
`RUNS=40 node tools/classic-balance-sim.mjs`를 돌려 그 표와 ±5% 안에 있어야 한다.

**용어 주의.** 코드의 `round`(`classicRoundForBoard`)는 판 번호가 아니라
**난이도 단계**(5에서 시작, 10에서 고정)다. 판 번호는 `boardIndex`/`boardsPlayed`.
이 작업은 `round` 쪽을 건드리지 않는다.

---

## 3. 바꿀 파일 — 전부

### 3-1. `js/data.js` — 사다리 + 고양이 티어

- `CLASSIC_BOARD_LADDER` 교체 (2항)
- 그 위 주석 블록의 "then one extra row per 판갈이 up to 6×8" 등 옛 설명을
  이 지시서 1항 요지로 갱신. 수치는 표 그대로 옮길 것 — 주석의 숫자가
  코드와 다르면 다음 사람이 어느 쪽을 믿을지 모른다.

### 3-2. `js/board.js` — 고양이 수 티어

```js
export function bonusCatTargetForDimensions(rows, cols = rows) {
  const cells = ...;
  if (cells <= 16) return 1;
  if (cells <= 25) return 2;
  if (cells <= 36) return 4;
  return 4;          // ← 37칸 이상 전부 4마리
}
```

63·70칸에서 4마리면 밀도가 36칸의 11%에서 6%로 떨어져 고양이 판이 밋밋하다.
티어를 추가한다: **54칸 이하 4, 63칸 이하 5, 그 이상 6.** (밀도 7~9%. 36칸의
11%보다는 낮게 잡았다 — 큰 판은 답 자체가 많아서(10×7에 답 27개) 고양이가
너무 많으면 "고양이 판"이 특별하지 않아진다.) 이 함수는 `generateClassic`에서 `catTarget`으로 쓰이고
`classicBoardRuleForIndex`의 `catMultiplier: 2`(4판마다 고양이 2배)와 곱해진다.
6×2=12마리가 70칸에 들어가는지 `catTarget = Math.min(rows*cols - 4, …)` 상한이
이미 막고 있으니 별도 처리 불필요.

**건드리지 말 것:** `generateClassic`의 `isLearningBoard = this.cols === 6 && this.rows <= 6`
(1307줄). 첫 두 판(5×6, 6×6)이 6열이라 **이 보호는 그대로 살아 있다.** 조건을
넓히거나 고치지 말 것.

### 3-3. `js/ui.js` — 판 크기 라벨

`showClassicBoardEntry(boardNumber, timeBonus, boardGrew)`가 판갈이 때 `N판`과
`+N초`를 띄운다. **`boardGrew`가 참이면 새 크기를 한 줄 더 붙인다** — 사람들이
"칸이 커지는 게 성취감"이라고 한 건 변화가 눈에 보여서고, 지금은 커졌다는 말만
있고 얼마나인지가 없다.

- 시그니처에 `{ rows, cols }`를 추가하고 호출부(`js/game.js` 1723줄
  `this.ui.showClassicBoardEntry(this.classic.boardsPlayed, gainedTime, boardGrew)`)에서
  다음 판 크기를 넘긴다.
- 표기는 `9×7` (곱셈 기호 U+00D7, 이미 폰트 서브셋에 있음). "행×열"이다.
- 스타일은 기존 `.board-entry small`(`+N초`)과 같은 급으로. 새 색·새 애니메이션
  만들지 말 것 — `is-growth` 클래스가 이미 있다.
- `boardGrew`가 거짓이면 아무것도 붙이지 않는다 (판7 이후 10×7 고정 구간).

### 3-4. CSS — 10행 티어

8·9행 티어는 있고 **10행은 말풍선만** 있다. 두 파일에 10행을 추가한다.

- `css/play-layout-v1.css` 3196줄:
  `.screen-play.play-ui-v4.is-tall-board[data-board-rows="8"], …[data-board-rows="9"] { --board-chrome: calc(244px + 8dvh); }`
  → 선택자에 `[data-board-rows="10"]` 추가. **값은 그대로.** (10×7의 보드 높이는
  444px로 9×7의 418px보다 26px 크고, 실측에서 하단 UI(684px)까지 55px 남는다.)
- `css/claude-polish.css` 106줄: 같은 방식으로 `"10"` 추가 (여기 값 250px).
- `css/claude-polish.css` 83줄·`css/play-layout-v1.css` 3325줄(`.cat-coach`),
  3330줄(`.play-footer`)의 8·9행 선택자에도 `"10"` 추가.
- 폭 관련 값은 손대지 말 것. 7열은 폭이 아니라 높이로 결정된다(1-1).

### 3-5. `tests/classic.test.mjs` 97~113줄

지금 단언이 옛 사다리를 박아놓고 있다. 새 사다리에 맞춰 바꾼다:

```js
assert.deepEqual(
  CLASSIC_BOARD_LADDER.map((step) => [step.rows, step.cols]),
  [[5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [9, 7], [10, 7]],
);
assert.deepEqual(CLASSIC_BOARD_LADDER.map((step) => step.timeFloor), [4, 5, 5, 5, 5, 5, 5]);
assert.deepEqual(CLASSIC_BOARD_LADDER.map((step) => step.timeBonus), [10, 13, 15, 16, 17, 18, 18]);
// 열은 7을 넘지 않는다. 360px 폰에서 8열은 칸이 38.8px로 손가락보다 작다.
CLASSIC_BOARD_LADDER.forEach((step) => assert.ok(step.cols <= 7));
// 첫 판은 6열이어야 board.js의 초보 답 보장(cols === 6)이 켜진다.
assert.equal(CLASSIC_BOARD_LADDER[0].cols, 6);
// 계단은 한 번에 한 축, 한 칸씩만 오른다.
CLASSIC_BOARD_LADDER.forEach((step, index) => {
  if (index === 0) return;
  const prev = CLASSIC_BOARD_LADDER[index - 1];
  const dRows = step.rows - prev.rows, dCols = step.cols - prev.cols;
  assert.ok((dRows === 1 && dCols === 0) || (dRows === 0 && dCols === 1),
    `${index}번째 계단: 행 +${dRows}, 열 +${dCols}`);
});
// 판갈이 보상은 판이 클수록 같거나 크다.
CLASSIC_BOARD_LADDER.forEach((step, i) => {
  if (i) assert.ok(step.timeBonus >= CLASSIC_BOARD_LADDER[i - 1].timeBonus);
});
assert.equal(classicBoardForIndex(6), CLASSIC_BOARD_LADDER[6]);
assert.equal(classicBoardForIndex(20), CLASSIC_BOARD_LADDER[6]);
```

기존의 `assert.equal(classicBoardForIndex(4), CLASSIC_BOARD_LADDER[4])`,
`(9) → [4]` 줄은 지운다(더 이상 참이 아니다).

### 3-6. `tests/board.test.mjs` — 새 크기 생성 검사 추가

9×6, 9×7, 10×7 각각에 대해 `generateClassic(cols, rows, round)`를 라운드
1·5·10에서 돌려:
- `findAnswers().length >= 4` (생성기의 `wanted` 하한)
- `bonusCats.size`가 3-2의 티어와 일치
- 생성 시간 < 30ms

참고 실측 (이 지시서 작성 시점, 30판 평균, 현재 코드):

| 보드 | 답 | 3칸 이상 답 | 생성 |
| --- | --- | --- | --- |
| 9×6 | 21.4 | 8.6 | 9.7ms |
| 9×7 | 24.3 | 8.6 | 11.9ms |
| 10×7 | 27.3 | 10.8 | 14.0ms |

생성기는 크기에 제한이 없어서 셋 다 지금 코드로 이미 정상 생성된다. 이 테스트는
"되는지"가 아니라 앞으로 누가 생성기를 만졌을 때 큰 판이 조용히 망가지는 것을
잡기 위한 것이다.

---

## 4. 건드리지 말 것

- `js/leaderboard.js`, `tools/toss-game-center-entry.mjs`, `js/vendor/*` — 검증된 버그 없이 수정 금지
- `js/ads.js`, `js/ad-pacing.js`, `js/promotions.js` — 광고·프로모션 로직. 이 작업과 무관
- `finishClassic()`의 점수 제출 위치와 1회 제출 보장
- 드래그 조작, 보드 생성기의 답 보장 로직(`generateClassic` 본문)
- `classicRoundForBoard`, `CLASSIC_REFUND_FATIGUE`, `pairWeightsForRound` — 난이도·환급 곡선
- 화면 전체 크기, HUD, 버튼, 글씨 크기 — **셀만 작아진다**
- 폰트 서브셋: 새 한글 글자를 어디에도(주석 포함) 넣지 말 것. 넣으면 `npm test`가
  실패한다. 필요하면 `python3 tools/build-jua-subset.py && python3 tools/build-pretendard-subset.py`

---

## 5. 브랜치 순서

1. `codex/toss-promo-interstitial-v1`을 **먼저 main에 머지**한다. 충돌 없음을
   확인했다(`git merge-tree`). 광고·프로모션은 완성돼 있고 테스트 264개 통과.
   - 단, 머지 전에 `docs/downloads/*.ait`(9.6MB×2)는 **커밋에서 뺀다.**
     매 릴리스마다 저장소가 19MB씩 불어나는 방식이다. GitHub Releases 자산으로
     올릴 것 — 안드로이드 빌드가 이미 그렇게 한다(`.github/workflows/android-release.yml`).
2. 그 main에서 새 브랜치 `codex/board-ladder-v2`를 딴다.
3. 이 지시서의 작업은 전부 거기서.

---

## 6. 완료 기준 — 전부 통과해야 끝

**A. 자동**
- `npm test` 전부 통과 (기존 264 + 3-6의 추가분)
- `RUNS=40 node tools/classic-balance-sim.mjs` 결과가 1-2 "반복 없음" 열과 ±5% 안
  (초보 ≈1,800 / 보통 ≈5,650 / 숙련 ≈14,750; 초보 도달 판 ≈4)

**B. 화면 실측 — 360×780 / 390×844 / 430×932 세 화면 모두**
Playwright로 `?test=1` → `window.__OING_TEST__.startClassic()` 뒤 각 크기에 대해
(`#board`에 `--board-cols/--board-rows`, `.screen-play`에 `is-tall-board`·
`data-board-rows`를 `js/ui.js` 340~356줄과 같은 방식으로 세팅):

| 검사 | 기준 |
| --- | --- |
| 칸 한 변 (`#board` 폭 − 패딩 − 간격) / cols | **≥ 40px** (360에서 10×7은 42.6 나와야 정상) |
| `#board` 아래 끝 | 하단 UI(`nextUiTop`) 위 — 겹치면 실패 |
| `document.documentElement.scrollWidth` | `innerWidth` 이하 — 가로 스크롤 금지 |
| 숫자 글꼴 | 16px 그대로 (셀만 줄고 글자는 안 줄인다) |

참고 실측(이 지시서 작성 시점, 360×780): 8×6 52.3 / 9×6 48.0 / 9×7 44.6 / 10×7 42.6.
이 숫자에서 ±2px 넘게 벗어나면 레이아웃이 바뀐 것이니 원인을 찾을 것.

**C. 손으로 — 실기기 또는 360×780 에뮬레이터**
- 판7(10×7)까지 실제로 도달해서: 드래그 시작·끝 칸이 의도대로 잡히는가,
  힌트·셔플·폭탄·시계·동결 아이템이 10×7에서 동작하는가, 고양이 칸이 6마리
  들어오는가, 판갈이 라벨에 `10×7`이 뜨는가
- 판갈이 순간마다 크기 라벨이 **커진 판에서만** 뜨는가 (판8 이후엔 안 뜸)
- 8×6 → 9×6 전환에서 하단 UI가 위로 밀리지 않는가

---

## 7. 참고 도구

| 도구 | 용도 |
| --- | --- |
| `tools/classic-balance-sim.mjs` | 점수·도달 판 분포. `OPTS='{"ladder":[…]}'`로 코드 안 고치고 실험 가능 |
| `tools/measure-repaint.mjs` | Playwright 로딩 방법 참고 (이 저장소는 Playwright를 의존성으로 안 든다) |
| `docs/HANDOFF.md` | "규칙·밸런스를 바꿀 때는 먼저 측정한다" 원칙과 프로필 보정표 |
| `docs/REVIEW-classic-pacing-v1.md` | 지금 사다리(5×6 두 번)가 나온 경위 |
