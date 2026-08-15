# 다음 작업 (이어서 할 것)

브랜치: `codex/play-layout-structure-v1`
프리뷰: https://oing-toss-git-codex-play-layout-structure-v1-sbp37s-projects.vercel.app

## 완료 (이번 세션)

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
