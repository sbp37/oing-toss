# 오잉 스테이지 (oing-toss)

고양이 테마 **합10 드래그 퍼즐**([sbp37/oing](https://github.com/sbp37/oing))을
토스 웹앱(앱인토스)용 **스테이지형 퍼즐**로 변환한 뼈대.

- 서버리스: Firebase(인증·랭킹·함수) **전부 제거**, `localStorage`로 진행 저장.
- 토스 SDK는 **스텁**(`TossSDK`)으로만 감쌈 — 실제 SDK 나오면 그 블록만 교체.
- 스코어어택 → **스테이지형**: 1~5는 시간제한 없이 5×5 작은 판(시니어 배려)에서 시작.

## 파일

| 파일 | 내용 |
|---|---|
| `index.html` | **단일 HTML 게임 전체**(바닐라 JS, 외부 CDN 0). 아래 [12]구획으로 구성. |
| `CONVERSION_PLAN.md` | 원본 함수명 기준 삭제/유지/수정 변환 계획서. |

## 실행

정적 파일이라 그냥 브라우저로 `index.html`을 열면 된다.
로컬 서버 예: `python3 -m http.server` 후 `http://localhost:8000`.
모바일 세로 화면 기준으로 설계됨(safe-area 대응).

## `index.html` 구조 (주석 구획 번호)

```
[1]  TossSDK 스텁       — submitScore / openLeaderboard / showRewardedAd / haptic
[2]  getStageConfig     — 스테이지 번호 → 난이도 파라미터
[3]  진행 저장          — localStorage (maxStage, stars, tutorialDone)
[4]  보드 생성          — 입문=도미노 타일링(완전클리어 보장) / 이후=랜덤+솔버검증
[5]  상태 & 렌더
[6]  드래그 선택        — 포인터 통합, 합10 사각형 판정(원본 tryRemove 이식)
[7]  스테이지 흐름      — start → play → win/lose → next
[8]  타이머             — 입문(1~5)은 숨김
[9]  힌트 / 섞기
[10] 튜토리얼           — 첫 실행 3단계 인터랙티브
[11] 이펙트/사운드      — WebAudio 합성음, 콤보, 컨페티
[12] 화면 전환 / 네비
```

## 실제 앱인토스 SDK 연결 (나중에)

`index.html`의 `[1] TossSDK` 블록 한 곳만 실제 API로 교체:

```js
const TossSDK = {
  submitScore(score) { return window.AppsInToss.leaderboard.submit({ score }); }, // 플레이 완료 후에만
  openLeaderboard()  { return window.AppsInToss.leaderboard.open(); },
  showRewardedAd()   { return window.AppsInToss.ads.showRewarded().then(r => r.completed); },
  haptic(type)       { window.AppsInToss.haptic(type); },
};
```

⚠ 함수명은 예시다. 실제 `developers-apps-in-toss.toss.im` 문서로 확인 후 맞춘다.
리더보드 점수는 **플레이 완료 후에만** 제출한다(진입 직후 호출 금지 규칙).

## 난이도 사다리 (`getStageConfig`)

| 스테이지 | 보드 | 시간 | 힌트 | 목표 | 아이템 |
|---|---|---|---|---|---|
| 1~5 | 5×5 | 없음 | 무제한 | 100%(완전클리어 보장) | 없음 |
| 6~15 | 6×6 | 180초 | 3 | 70% | 10+ 폭탄 |
| 16~30 | 7×7 | 120초 | 2 | 80% | 20+ 시계 |
| 31+ | 8×8 | 90초~ | 1 | 90% | 프리즈 등 |

## 검증 완료

- 입문(1~5) 보드는 백트래킹 솔버로 **완전 클리어 가능**함을 확인(1500판 전부).
- 모든 스테이지 생성 보드는 시작 시 최소 1수 존재.
- 브라우저 스모크 테스트: 로드/드래그 제거/클리어→저장→다음 스테이지 정상, JS 에러 0.

## 유지된 오잉게임의 개성

고양이 캐릭터(🐱)·파스텔 아이보리 테마·타격감/콤보 연출·아이템(폭탄/시계/프리즈).
아이템은 학습 부담 분산을 위해 **스테이지 10 이후부터** 하나씩 등장.
