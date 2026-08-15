# 다음 작업 (이어서 할 것)

브랜치: `codex/play-layout-structure-v1`
프리뷰: https://oing-toss-git-codex-play-layout-structure-v1-sbp37s-projects.vercel.app

## 남은 할 일

### 1. 스테이지 2→3 넘어갈 때 숨은 그림이 먼저 보이는 버그
STAGE 3부터 `board-secret-garden-v1.webp`가 보드 뒤에 깔린다
(`css/play-layout-v1.css`, `data-stage-band`가 `warmup`이 아닐 때).
스테이지가 넘어가는 순간 그림이 잠깐 그대로 노출된다는 제보.
`js/ui.js`에서 `dataset.stageBand`를 바꾸는 시점과 보드를 다시 그리는
시점의 순서를 확인할 것 — 밴드가 먼저 바뀌고 타일이 나중에 채워지면
그 사이 프레임에 그림이 드러난다.

### 2. 폭탄 아이템 연출 겹침
소환될 때와 터질 때 폭탄 그림과 글씨가 위아래로 겹쳐 보인다.
관련 요소: `.item-drop-fx`, `.special-trigger-pop`, `.item-impact-fx`,
`.bomb-fx` (js/ui.js `animateSpecialTiles`, `animateBomb`).
콤보 보상 팝업에서 이미 같은 종류의 문제를 고쳤다 — 상태바의
`combo-readout img` 같은 넓은 선택자가 연출용 이미지까지 잡는 패턴을
의심할 것.

### 3. 배경음악 기본 ON
무음 모드가 아닌 이상 효과음과 배경음악이 둘 다 나오는 것이 기본이어야
한다. `js/music.js`, `js/audio.js`, 설정 초기값 확인.

### 4. 앱을 벗어났을 때 배경음악 정지
모바일에서 다른 화면으로 전환해도 배경음악이 계속 흘러나온다.
`visibilitychange` / `pagehide`로 일시정지하고 복귀 시 재개할 것.

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
