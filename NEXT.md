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

### 묶음 4. 정원 수집 메타 v2 + 폰트 파이프라인 복구 (이 커밋)
- 정원 화면(`#garden-overlay`, 홈 하단 '내 정원' 버튼으로 진입):
  꽃밭 씬 + 구조한 고양이 누적 + 다음 친구까지 진행 게이지 + 친구 6단계.
  단계는 `GARDEN_MILESTONES`(3/10/25/50/100/200마리),
  `gardenProgress()`가 현재 구간 기준 진행률을 계산(해금할 때마다 리셋).
- 홈 '내 정원' 버튼에 누적 수 상시 노출 — 켤 때마다 보이는 리텐션 신호.

- **폰트 서브셋 함정 발견·복구**: `assets/fonts/*`는 html/css/js를 스캔해
  만든 서브셋이고 `@font-face`에 `unicode-range`가 박혀 있다. 그래서
  새 한글을 쓰면 조용히 시스템 폰트로 떨어진다(실제로 '넣/꽃/밭/별' 등이
  깨져 있었다). 원본 폰트를 다시 확보해
  `tools/build-jua-subset.py`, `tools/build-pretendard-subset.py`를 그대로
  돌려 재생성했다. Jua 90KB→58KB, Pretendard 95KB→122KB(총 -5KB).
  - 원본 재확보 경로(다음에도 필요): GitHub raw는 세션에서 차단됨.
    Jua는 Google Fonts CSS의 woff2 파티션 87개를 받아 fontTools
    `Merger`로 합쳐 `/tmp/Jua-Regular.ttf` 재구성. Pretendard는
    `npm pack pretendard`의 `dist/web/variable/woff2/`에서 추출.
  - **`tests/fonts.test.mjs` 가드 추가**: html/css/js의 모든 한글이
    서브셋 `unicode-range`에 있는지 검사. 없는 글자를 넣으면 테스트가
    파일명과 함께 실패한다(역검증 완료).

- 검증: npm test 74/74. 정원 화면 4개 상태(0/12/64/250마리) 수치·해금
  단계 확인, 280×653~430×764에서 잘림 없음. **실제 UI로 풀런 2회**
  (테스트 훅 없이 실제 드래그 298·317수): 첫 판 4마리 저장·누적 라인
  숨김, 누적 100 시드 판에서 100+9=109 저장·"모두 109마리" 표시.

### 묶음 5. 결과 화면 완성도 (이 커밋)
"에셋 같다"의 정체는 **같은 말을 여러 번 하는 밴드가 쌓여 있는 것**이었다.
신기록 판에서 "NEW RECORD" 칩 + "첫 기록을 만들었다냥!" + 게이지 라벨
"새 최고기록 달성!" + 고양이 대사까지 축하가 네 번 반복됐고, 일반 판에서도
게이지 라벨 "최고기록 도전 15%"가 바로 위 "최고 기록의 15%까지 왔다냥"과
같은 숫자를 두 번 말했다. 그래서 점수는 "가장 큰 글자"일 뿐 주인공이
아니었다.
- 기록 게이지를 **쫓을 기록이 있을 때만** 표시(신기록·연습 판에서는 숨김).
  라벨은 시각적으로 제거하고 스크린리더용으로만 남김(aria-label 병행).
- 그렇게 회수한 높이를 점수에 투자: 54.6px → 64px(390 기준, +17%).
  카드는 전혀 커지지 않았고 **여유는 오히려 14px → 20px로 늘었다**(390×693).
- 점수 상한은 취향이 아니라 실측으로 결정: 68px에서는 9자리 점수가
  430px 폰에서 카드를 넘쳐 64px로 조임.
- 코인 라벨(최종 점수)을 축소해 점수의 캡션으로 물러나게 함.
- 버튼 위계: 민트(공유)+크림(랭킹)이 서로 다른 무게로 경쟁하던 2행을
  같은 크림 톤 한 쌍으로 통일. 민트는 게임의 "가자" 색이라 `한 판 더`가
  독점하게 됨.
- `max-height: 690px` 압축 블록을 같은 특이도로 재선언해, 점수 확대가
  짧은 화면 압축을 조용히 덮지 않도록 막음.
- 검증: npm test 74/74. 신기록/일반/연습 3상태 + 280×653~430×764에서
  오버플로 0, 9자리 최악 점수도 전 폭에서 카드 안에 들어감.

## 다음 후보 (우선순위 순)

### 1. 정원 수집 v3
판마다 다른 정원 그림(새 에셋 필요), 구조한 고양이를 정원 씬에
실제로 배치하는 도감. 지금은 해금 장식 6종이 고정 슬롯에 놓인다.

### 2. 결과 화면 2차 (선택)
남은 개선 여지: `이번 판 기록` 키커와 카드 첫 줄 `STAGE N 도달 · 목표 …`가
역할이 겹친다. 스탯 타일 3종이 크림 카드 안의 또 다른 카드(중첩)라
색이 셋으로 갈려 산만한 편.

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
