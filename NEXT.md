# 다음 작업 (이어서 할 것)

브랜치: `claude/play-layout-structure-v1-8eghdi` (PR #5, base: codex/play-layout-structure-v1)
프리뷰: https://oing-toss-git-claude-play-layout-structu-b5382c-sbp37s-projects.vercel.app

## 완료 (2차 세션 — 진단 후 개선 묶음 1·2)

### 묶음 1. 피드백 마감 (ab8e936)
- 콤보 마일스톤(3/5/8) 연출 중 상태바 판독값이 사라져 빈 크림 액자만
  0.8초 보이던 문제 — low-time alert와 같은 방식으로 v4 레이아웃에서
  판독값 유지 (`is-combo-celebrating` override).
- 점수 버스트의 비어 있던 detail 슬롯에 콤보 3+ 일반 클리어 시
  "콤보 ×N" 표기 — 콤보=점수 배수라는 핵심 전략이 처음으로 화면에 노출.
  보상 라벨(미션/클로버/큰 조합 등)이 항상 우선.
- "16 / 17" 같은 2자리 목표 텍스트가 진행 게이지 밑으로 최대 11.8px
  파고들던 문제 — 점수판과 같은 data-digits 단계 축소 적용.

### 묶음 2. 도달성·밸런스 (이 커밋)
- 보드가 안 크는 스테이지 클리어(3→4, 5→6+)에 +4초 지급
  (`roundTimeBonusSeconds`). 120초 캡은 유지.
- 희귀템 문턱 인하: 메가폭탄·프리즈 STAGE 5부터(기존 6),
  프리즈 콤보 10부터(기존 14), 클로버 콤보 14부터(기존 21, STAGE 6 유지).
  pity 게이트(`nextBoardDropPity`, `chooseBoardDrop`)도 동일하게 정렬.
- 콤보 7의 배수 경계를 오르내리며 드롭을 파밍하던 구멍 봉인 —
  `advanceCombo`가 세션 최고 콤보(high-water mark) 돌파 시에만 지급.
- 검증: npm test 71/71 (도달 밴드 novice 3~5.5 / regular 5~7.5 /
  expert 7.5~10.5 계약 유지, 시뮬 실측 4.7/6.7/10.0).
  item-drop-compare 200판: regular 기준 메가폭탄 66%·프리즈 79%·클로버
  41% 판에서 등장(기존엔 사실상 0%). 실플레이(Playwright 실제 드래그):
  숙련 페이스 STAGE 7→9 도달, 프리즈·클로버·메가폭탄 실등장 확인,
  캐주얼 파밍 11회→정상 2회.

### 묶음 3. 정원 수집 메타 v1 (이 커밋)
- 정원 로테이션: 스테이지 밴드마다 보드 뒤 정원이 같은 그림의 다른
  영역을 보여준다 (rising: 하단 꽃밭+발자국 길 / wide: 중단 고양이 /
  fever: 상단 아치·하늘) — `background-position`만 이동, 에셋 추가 없음.
  밴드 전환은 보드가 꽉 찬 상태에서 일어나고 전환 커버가 정원을 가리므로
  이동 자체는 보이지 않는다.
- 고양이 구조 누적: `oing_toss_v2_cats_rescued`에 런마다 합산
  (`storageAdapter.getCatsRescued`/`addCatsRescued`, testMode 제외).
  결과 화면 '고양이 구조 N마리' 아래 "모두 N마리"(누적>이번 판일 때만),
  내 기록 오버레이에 "지금까지 구조한 고양이 N마리"(0이면 숨김).
- 검증: npm test 72/72(신규 스토리지 테스트 1 포함), Playwright로
  밴드별 크롭 3종·랭킹 라인 표시/숨김·결과 라인 스타일 확인.

## 다음 후보 (우선순위 순)

### 1. 정원 수집 메타 v2
v1의 누적 카운트를 실제 '정원 화면'으로: 구조한 고양이가 정원 그림 위에
쌓이는 도감/컬렉션 뷰. 정원 그림 추가 로테이션(판마다 다른 그림)은
새 에셋(`assets/backgrounds/board-secret-garden-*`)이 생기면 확장.

### 2. (보류) 결과 화면 완성도
정렬은 맞췄지만 "에셋 같다"는 피드백. 점수 큰 숫자, 기록 게이지,
버튼 위계 재정비.

## 완료 (1차 세션)

### 1. 스테이지 전환 시 숨은 그림 노출 — 수정 완료
원인: 라운드를 클리어하면 보드가 전부 `is-empty`가 되고, `updateHUD`가
`data-stage-band`를 다음 스테이지 값으로 먼저 바꿔버린 뒤에야
`animateRoundTransition`이 새 타일을 채운다. 그 사이(`is-round-leaving`
~140ms + `is-round-arriving`)에는 보드가 텅 빈 채로 정원 배경이 그대로
드러났다.
수정: `css/play-layout-v1.css`에 `.board-frame.is-round-leaving` /
`.is-round-arriving` 전용 규칙을 추가해 그 구간에는 정원 레이어
(`board-secret-garden-v1.webp`)를 빼고 원래 그라디언트만 남기도록 했다.
`animateRoundTransition`의 타이밍 자체는 건드리지 않음.
검증: MutationObserver로 `is-round-leaving` 프레임을 직접 캡처해
`hasGardenUrl: false` 확인 (스테이지 2→3 클리어 반복 재현).

### 2. 폭탄 아이템 연출 겹침 — 수정 완료
원인: `.item-drop-fx > span`(등장 라벨)의 `top: 28px`가 아이콘의 착지
애니메이션(`item-drop-icon`, translateY 최종 -46%)이 실제로 차지하는
영역보다 얕게 잡혀 있었다. 기본 아이템은 이미지 바닥과 라벨 상단이
최대 3.5px 겹쳤고, 메가폭탄(48px 아이콘)은 9.9px까지 겹쳤다.
`.bomb-fx`(터질 때)는 측정해보니 실제로는 겹치지 않았음 — 관련 요소로
같이 지목됐던 `.special-trigger-pop`(텍스트만 있음), `.item-impact-fx`
(이미지 없음)도 마찬가지로 문제 없었음.
수정: `css/styles.css`에서 `.item-drop-fx > span`의 `top`을 28px→36px로,
메가폭탄 전용으로 `top: 46px` 오버라이드를 추가.
검증: Playwright로 아이콘/라벨의 `getBoundingClientRect()`를 프레임마다
샘플링해 겹침을 측정 — 수정 전 겹침(+3.5~+9.9px) → 수정 후 여유
(-4.5~-8.1px, 겹치지 않음) 확인. 스크린샷으로도 재확인.

### 3. 배경음악 기본 ON — 이미 정상 동작 확인, 코드 변경 없음
`js/adapters.js`의 `getSettings()` 기본값이 이미
`{ sound: true, music: true, musicVolume: 0.4 }`이고,
`tests/storage.test.mjs`에 "new players start with music on" 테스트로
고정돼 있다. 실제 시작 플로우(`시작하기` 클릭 → 카운트다운 GO!)를
Playwright로 재생해 `#bgm-audio`가 `paused:false`로 재생되는 것도 확인.
추가로 겪는 문제가 있다면 실기기(특히 iOS Safari)의 자동재생 정책 쪽을
의심할 것 — 이 세션에서는 재현 실패.

### 4. 앱을 벗어났을 때 배경음악 정지 — 이미 정상 동작 확인, 코드 변경 없음
`js/game.js`에 `visibilitychange`(hidden) / `pagehide` 핸들러가 이미
`this.pause('background')`를 호출하고, `pause()`는 `pauseMusic()`을
호출한다. Playwright로 게임 진행 중 `document.visibilityState`를
`hidden`으로 바꿔 디스패치했더니 `#bgm-audio.paused`가 즉시 `true`로
전환됨을 확인. 복귀 시엔 일시정지 오버레이의 "재개" 버튼을 눌러야
음악도 다시 재생됨(의도된 동작으로 보임 — 자동 재개는 하지 않음).
실기기에서 여전히 재현된다면 iOS의 visibilitychange 지연/PWA 특이
동작을 의심할 것.

## 남은 할 일

### 5. (보류) 결과 화면 완성도
정렬은 맞췄지만 "에셋 같다"는 피드백이 남아 있다. 점수 큰 숫자,
기록 게이지, 버튼 위계를 다시 잡는 작업.

## 작업 규칙
- `CLAUDE.md`의 규칙을 따를 것 (artifact 금지, 텍스트로만 보고).
- `main`에 직접 머지하지 말 것. 위 브랜치에 커밋하고 push.
- 커밋 후 프리뷰 링크를 함께 알려줄 것.
- 검증: `npm test` (71개), Playwright로 360x704 / 390x844 / 430x932 확인.
  검증 스크립트는 세션마다 새로 짜야 한다 (/tmp에만 있음).

## 최근 커밋 (참고)
- `0315c7c` 이어진 연한 시럽 선택 + 셔플 중 보드 불투명 처리
- `d172c5e` 셔플 카드플립, 카운트다운 GO!, 정답 표시, HUD 겹침 정리
- `357c3d5` 고양이 축소·하강, 말풍선 좌측 이동
- `4fe5cbb` 배경 rose-morning 교체 + STAGE 3부터 숨은 그림
