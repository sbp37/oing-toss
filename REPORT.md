# OING Toss v2 — 2차 비주얼 통합 보고

## 2026-08-06 콤보 보상 연출 보강

- 콤보 3에는 골드 `NICE! COMBO 3`, 콤보 5에는 민트 `SWEET! COMBO 5`, 콤보 8에는 코랄 `OING FEVER! COMBO 8` 배너를 연결했다.
- 단계별 배너와 함께 보드 외곽 림 파동, 기존 별·숫자 파편, 점수 팝업과 고양이 반응이 동시에 강해진다. 플레이를 멈추는 모달은 사용하지 않는다.
- 실제 390×844 브라우저에서 3.2초 콤보 창 안에 합10을 세 번 연속 성공시켜 `combo=3`, `NICE!`, 골드 보드 림을 확인했다.
- ROUND 1 목표 3회와 콤보 3이 같은 순간 발생할 때 중앙 배너가 겹치지 않도록 콤보를 약 0.45초 보여준 뒤 정리하고 `ROUND CLEAR!`를 이어서 표시한다.
- 최종 재검수에서 콤보 배너와 라운드 클리어의 동시 표시가 없고 브라우저 경고·오류가 0건임을 확인했다.

## 2026-08-06 드래그 응답·오입력 보강

- 시럽 선택 영역의 위치 추종을 48–58ms에서 16–22ms로, 합계 말풍선 추종을 45ms에서 16ms로 단축했다.
- 같은 직사각형 안에서 포인터만 움직일 때 타일 전체 class 갱신과 `getBoundingClientRect()`를 반복하지 않도록 선택 경계와 타일 상태를 캐시한다.
- 칸 경계 젤리 스냅은 강제 레이아웃 재계산 대신 Web Animations API를 사용하며 일반 86ms, 합10 102ms로 반응한다.
- 선택 진동의 중복 제한을 34ms에서 24ms로 줄이고 기본 틱을 3ms로 짧게 조정했다.
- 시작 칸을 눌렀다가 다른 칸을 거쳐 다시 시작 칸으로 돌아와 놓거나, 실숫자가 1개 이하인 영역을 놓으면 실패가 아닌 선택 취소로 처리한다. 점수·목표·콤보·멘트는 변하지 않는다.
- 실제 390×844 브라우저에서 합10 성공 뒤 `시작 칸 → 옆 칸 → 시작 칸` 드래그를 실행했다. 전후 점수 `480`, 목표 `2/3`, 콤보 `1`이 유지되고 선택 타일과 시럽막은 0개로 정리됐다. 한 칸 탭도 무페널티로 확인했다.
- 브라우저 경고·오류는 0건이며 문서 크기는 390×844 뷰포트와 동일했다.

## 2026-08-06 효과·라운드 안전성 보강

- 합10 시 개별 타일에 보이던 진한 초록 테두리를 제거하고, 흰 유리 림과 연한 민트 내부광을 가진 하나의 연결 시럽막으로 조정했다.
- 섞기는 190ms 단일 페이드에서 약 0.85초의 `기존 타일 산개 → 중앙 회전 아이콘·3방향 번개·링 → 새 타일 재집결` 2단계 애니메이션으로 교체했다.
- 힌트는 1.38초 동안 답 직사각형 전체를 금색 리본으로 묶고 `여기!` 라벨, 모서리 반짝이 4개, 5px 이동 광선과 도착 링을 표시한다.
- 라운드 이동은 `ROUND CLEAR` 뒤 기존 보드 퇴장, `NEXT ROUND n`, 새 보드 등장 순서로 약 1.16초 동안 진행된다. 전체 구간에서 입력을 잠그고 등장 종료 뒤 320ms 입력 보호 시간을 추가했다.
- 실제 390×844 브라우저에서 합10을 3회 성공시켜 ROUND 1→2를 확인했다. 전환 중 새 보드의 정답 영역을 고의로 드래그했을 때 점수 `1,035`, 진행 `0/5`가 유지되어 오입력이 차단됐다.
- 힌트와 섞기의 중간 프레임을 실제 브라우저 화면으로 확인했고, 280×653·360×780·430×932에서 문서 스크롤 크기가 뷰포트와 동일하며 버튼·보드 잘림이 없음을 확인했다. 브라우저 경고·오류는 0건이다.
- 이 단계까지 `js/input.js`의 기존 흐름은 유지했다. 이후 사용자 승인에 따라 시작 칸 복귀 취소 분기만 추가했으며 최신 해시는 아래 7절에 기록했다.

## 2026-08-06 시럽 인터랙션·화면 밀도 보강

- 플레이 HUD를 좌우 12–14px 안전 여백 안의 작은 토이 패널로 재배치하고, 보드를 HUD 바로 아래의 가장 큰 시각 요소로 유지했다.
- 하단의 큰 흰 카드형 컨테이너를 제거하고 고양이 말풍선과 힌트·섞기 버튼을 배경 위에 독립 배치했다.
- 힌트·섞기는 별도로 제작한 시럽 버튼 셸을 사용하며 아이콘·이름·횟수는 HTML과 독립 이미지로 유지한다.
- 드래그 선택은 타일별 선이 아니라 선택 직사각형 전체를 덮는 반투명 시럽 레이어로 표현한다. 포인터 위치에 따라 하이라이트와 보드가 미세하게 끌리고, 선택 칸 경계가 바뀔 때 86–102ms 젤리 스냅과 짧은 진동·선택음이 함께 반응한다. 합 10에서는 민트색 시럽과 별도 진동 패턴으로 바뀐다.
- 시럽 효과는 `GameUI.previewSelection()`과 `selectionSnap()`에 구현했다. 이후 입력 파일에는 사용자가 요청한 시작 칸 복귀 취소 분기만 추가했다.

현재 변경분은 JS 구문 검사, CSS 괄호 검사, 에셋 참조 검사, 4×4/5×5/6×6 보드 생성·섞기 총 750회 테스트를 통과했다. 현재 인앱 브라우저가 로컬 `file://` 페이지 제어를 보안 정책으로 차단해 이번 변경분의 새 브라우저 캡처는 만들지 않았으며, 아래 기존 캡처 이후의 최종 시각 승인만 실제 모바일 새로고침으로 남아 있다.

| 뷰포트 | 계산된 보드 외곽 | 버튼 셸 예상 크기 | 핵심 콘텐츠 최소 높이 | 남는 세로 공간 |
|---|---:|---:|---:|---:|
| 280×653 | 256px | 약 124×44px | 약 475px | 약 178px |
| 360×780 | 332px | 약 160×54px | 약 581px | 약 199px |
| 390×844 | 362px | 약 175×59px | 약 621px | 약 223px |
| 430×932 | 402px | 약 195×62px | 약 661px | 약 271px |

## 작업 범위

현재 플레이 규칙과 드래그 엔진은 유지하고 `oing-toss-v2/` 안에서만 에셋 적용, 화면 위계, 상태 애니메이션, 첫 조작 안내와 반응형 표현을 개선했다. 원조 OING, `reference/`, `oing-toss-assets-v1/`은 수정하지 않았다. 배포·머지·Firebase·Apps in Toss SDK 연결도 수행하지 않았다.

## 1. 발견한 전체 캐릭터 에셋

원본 위치는 모두 `oing-toss-assets-v1/assets/`다. 각 포즈는 투명 PNG와 lossless WebP가 함께 있으며, 소스 시트도 별도로 보존되어 있다.

| 포즈 | 발견 파일 | 실제 픽셀 | 상태 |
|---|---|---:|---|
| 기본 앉기 | `cat/cat-idle.{png,webp}` | 422×480 | 정상, v2에 복사·대기 변형용 보존 |
| 손 흔들기 | `cat/cat-wave.{png,webp}` | 412×479 | 정상, 홈·힌트에 적용 |
| 응원 | `cat/cat-cheer.{png,webp}` | 431×481 | 정상, 콤보 3·라운드 이동·시간 경고에 적용 |
| 크게 성공 | `cat/cat-success.{png,webp}` | 407×476 | 정상, 첫 성공·콤보 5+·신기록 결과에 적용 |
| 빼꼼 | `cat/cat-peek.{png,webp}` | 359×306 | 정상, 플레이 기본에 적용 |
| 아쉬움 | `cat/cat-fail.{png,webp}` | 419×484 | 정상, 실패·낮은 점수 결과에 적용 |
| 소스 시트 | `source/cat-master-sheet.png`, `.webp`, `cat-master-sheet-chroma.png` | 3072×3072 | 조사·검수만, 런타임 미사용 |

6포즈를 마스터 시트 및 개별 투명 원본으로 확인했다. 동일한 블루 몸, 이마 줄무늬, 갈색 눈, 분홍 코·볼, 코랄 스카프가 유지되며, v1 QA 기준 귀·꼬리·발 잘림과 5개 이상 발 오류가 없는 포즈만 적용했다.

## 2. 발견한 전체 아이콘·UI 에셋

모든 항목은 PNG/WebP 쌍으로 발견했다.

- 독립 아이콘: `bomb`, `clock`, `clover`, `coin`, `freeze`, `gift`, `hint`, `home`, `shuffle`, `trophy`
- 장식: `cloud`, `flower`, `heart`, `paw`, `sparkle`, `star`
- 원형·기능 버튼: `button-back`, `button-pause`, `button-settings`, `button-hint`, `button-shuffle`, `button-ranking`
- 버튼 셸: `button-primary`, `button-secondary`, `button-small`
- HUD·패널: `hud-blue`, `hud-score`, `hud-time`, `hud-combo`, `hud-goal`, `progress-track`, `result-panel`, `speech-bubble`, `board-frame`
- 타일: `tile-normal`, `tile-selected`, `tile-success`, `tile-hint`, `tile-disabled`, `tile-empty`
- 로고·소스: `ui/logo.{png,webp}`, `source/ui-master-sheet.{png,webp}`

실제 복사 경로, 원본 경로, 화면, CSS 표시 크기와 미사용 사유는 `ASSET_USAGE.md`에 전수 기록했다. 캐릭터·아이콘·UI는 lossless WebP를 유지하고, 배경만 3차 로딩 최적화에서 quality 86 WebP로 재압축했다. PNG/마스터 시트는 다시 크롭하지 않았다.

3차 화면 밀도·폰트·말투·로딩 최적화의 최신 수치와 캡처는 `DENSITY_OPTIMIZATION_REPORT.md`를 기준으로 한다.

## 3. 화면별 캐릭터 포즈 적용

| 화면/상태 | 적용 포즈 | 유지 시간/복귀 |
|---|---|---|
| 홈 | `cat-wave` | 3.6초 주기의 2–3px 호흡·살짝 흔들림 |
| 플레이 기본 | `cat-peek` | 고정 `character-stage` 안에 상시 배치 |
| 첫 성공 | `cat-success` | 0.8초 후 `cat-peek` 복귀 |
| 콤보 3 | `cat-cheer` | 0.9초 후 복귀 |
| 콤보 5 이상 | `cat-success` | 0.9초 후 복귀 |
| 실패 | `cat-fail` | 0.7초 후 복귀 |
| 힌트 | `cat-wave` | 0.9초 후 복귀 |
| 라운드 이동 | `cat-cheer` | 1.0초 후 복귀 |
| 10초 이하 | `cat-cheer` | 1.8초 후 복귀 |
| 신기록 결과 | `cat-success` | 결과 화면 동안 유지 |
| 일반 결과 900점 이상 | `cat-cheer` | 결과 화면 동안 유지 |
| 낮은 점수 결과 | `cat-fail` | 결과 화면 동안 유지 |

포즈는 `GameUI.setPlayCharacter()`에서 교체하고, 토큰 기반 타이머로 오래된 복귀 예약이 새 상태를 덮지 않게 했다. 모든 포즈는 고정된 stage 안에서 `object-fit: contain`으로 렌더링해 레이아웃 이동이 없다.

## 4. 교체한 이모지·문자 아이콘

| 기존 표현 | 교체 파일 |
|---|---|
| `🏆` | `assets/icons/navigation/trophy.webp` |
| `★` 및 텍스트 별 | `assets/decor/star.webp` |
| `⚙` | `assets/ui/button-settings.webp` |
| `💡` | `assets/icons/items/hint.webp` |
| `↝` | `assets/icons/items/shuffle.webp` |
| `⌂` | `assets/icons/navigation/home.webp` |
| `Ⅱ` | `assets/ui/button-pause.webp` |
| 문자형 하트·반짝이 | `assets/decor/heart.webp`, `sparkle.webp` |
| 점수/시간 보조 표시 | `coin.webp`, `clock.webp` 기반 HUD 아이콘 |

현재 HTML에는 위 이모지, Base64 이미지, `assets/images` 구 경로가 남아 있지 않다. 모든 `<img>`에는 의미에 맞는 alt 또는 빈 장식 alt가 있고, 버튼에는 aria-label을 제공한다.

## 5. 사용하지 못한 에셋과 이유

- `cat-idle`: 정상 에셋이지만 홈은 요청에 더 맞는 손 흔들기 포즈를 선택했다. 파일은 대기 변형용으로 복사했다.
- `goal.webp`: HUD 높이를 줄이기 위해 목표는 텍스트와 얇은 진행바로 표현했다.
- `button-back`, `tile-disabled`: 현재 3화면 흐름과 보드 상태에는 대응 기능이 없다.
- `cloud`, `flower`, `paw`: 배경에 이미 같은 요소가 있어 장식 과밀을 피했다.
- 고정 비율의 `board-frame`, HUD·버튼·결과 셸: 280–430px에서 늘일 때 왜곡되고 동적 HTML 위계와 충돌해 런타임에 쓰지 않았다.
- 전용 긴장 고양이, 힌트를 가리키는 고양이, 독립 다시 하기 아이콘, 독립 콤보 아이콘은 원본 패키지에 없다. 다른 고양이나 이모지로 대체하지 않고 각각 `cat-cheer`, `cat-wave`, HTML 텍스트, 같은 세트의 `star`로 제한 대응했다.

## 6. 생성·수정 파일

수정:

- `index.html`
- `css/styles.css`
- `js/game.js`
- `js/ui.js`
- `js/data.js`
- `js/adapters.js`
- `REPORT.md`

생성:

- `ASSET_USAGE.md`
- `assets/backgrounds/` 2개
- `assets/characters/` 6개
- `assets/icons/navigation/` 2개
- `assets/icons/hud/` 4개
- `assets/icons/items/` 6개
- `assets/ui/` 10개
- `assets/decor/` 6개
- 실제 브라우저 PNG 캡처 6개

`js/board.js`, 원조 게임, reference, v1 에셋 원본은 수정하지 않았다. `js/input.js`는 시작 칸 복귀 시 commit 대신 cancel하는 최소 분기만 수정했다.

## 7. 유지한 드래그 함수와 게임 로직

`js/input.js`의 최신 SHA-256은 `86623ff75280d7fd5d794faecd527de27000a7ac6f066f6abfeec58cc31abbd5`다. 기존 구조를 유지하고 `pointerup`에서 마지막 칸이 시작 칸과 같으면 `reset(true)`로 취소하는 분기만 추가했다.

- `attachStickyRectangleInput()` 유지
- `cellFromPoint()` 유지
- `pointerdown` / `pointermove` / `pointerup` / `pointercancel` / `lostpointercapture` 흐름 유지
- 직사각형 정규화, 멀티터치 무시, 보드 밖 clamp, 한 번만 commit, `touch-action: none` 유지
- 합10, 콤보·점수, 라운드 자동 전환, 제한시간, 힌트·섞기, 정답 보장 로직 유지

연결부에서는 `onPreview`가 기존 rect에 포인터 인자를 함께 받을 수 있게 전달만 했고 입력 엔진 내부는 건드리지 않았다. UI는 선택 타일 위에 하나의 연결된 marquee를 그리고, 선택 영역 상단으로 `합 n`을 clamp해서 표시한다.

## 8. 테스트 결과

실제 로컬 서버와 인앱 브라우저에서 Pointer Events와 버튼을 직접 조작했다.

- 홈 → 플레이: 통과
- 실제 드래그 합10 성공·제거: 통과
- 실패 선택, 콤보 5→4 한 단계 감소: 통과
- 연속 성공 콤보 1→5, 콤보 3에서 ROUND 1→2 자동 이동: 통과
- 첫 드래그 시 조작 안내 즉시 제거: 통과
- 힌트 3회 소진·disabled: 통과
- 섞기 2회 소진·disabled, 이후 실제 합10 정답 드래그 성공: 통과
- 제한시간 종료 → 신기록/일반 결과: 통과
- 다시 하기, 홈으로, 랭킹 안내, 일시정지·재개: 통과
- 보드 생성·섞기 4×4/5×5/6×6 각 250회, 총 750회 정답 존재: 통과
- 모든 JS 모듈 `node --check`: 통과
- 브라우저 콘솔 오류: 없음

| 뷰포트 | 가로 스크롤 | 핵심 세로 스크롤 | 보드 크기 | 버튼/캐릭터 잘림 |
|---|---|---|---:|---|
| 280×653 (Fold 외부 화면 대표) | 없음 | 없음 | 264px | 없음 |
| 360×780 | 없음 | 없음 | 340px | 없음 |
| 390×844 | 없음 | 없음 | 370px | 없음 |
| 430×932 | 없음 | 없음 | 374px | 없음 |

홈과 결과도 네 뷰포트에서 문서 scrollWidth/scrollHeight가 viewport와 동일했다. 390px 캡처는 모두 390×844 실제 PNG이며, 로드된 모든 이미지의 원본 픽셀은 CSS 표시 크기의 2배 이상이다.

## 9. 실제 브라우저 캡처

- `PREVIEW_HOME_VISUAL_390.png`
- `PREVIEW_PLAY_DEFAULT_390.png`
- `PREVIEW_PLAY_COMBO_390.png`
- `PREVIEW_PLAY_HINT_390.png`
- `PREVIEW_RESULT_RECORD_390.png`
- `PREVIEW_RESULT_NORMAL_390.png`

## 10. 남은 시각적 문제

- 긴장 전용·힌트 가리키기 전용 포즈가 없어 같은 캐릭터 세트 안의 응원/손 흔들기 포즈를 사용한다.
- 독립 콤보·다시 하기 아이콘이 없어 별 에셋과 HTML 텍스트로 처리했다.
- CSS/웹 진동의 체감 강도와 iOS의 `navigator.vibrate()` 지원 여부는 실제 iOS·Android 기기에서 최종 감각 검수가 필요하다. 미지원 환경은 선택 틱 사운드와 타일/보드 변형이 피드백을 대신한다.
- 홈 눈 깜빡임은 별도 눈 레이어가 없어 넣지 않고, 동일 원본을 해치지 않는 3.6초 주기의 미세 호흡·흔들림만 적용했다.

## 11. 다음 아이템 구현 준비 상태

`bomb`과 `clock`은 현재 실제 플레이 아이템으로 연결했다. `freeze`와 `clover`는 에셋 경로와 `useFutureItem` 훅만 유지하며 화면에는 노출하지 않는다.

## 로컬 실행

```sh
cd oing-toss-v2
node serve.mjs
```

브라우저에서 `http://127.0.0.1:8766/`을 연다.
# Monetization-ready inventory boundary (2026-08-06)

- Replaced direct hint/shuffle counter mutation with `InventoryLedger` while preserving the visible starting counts and item behavior.
- Added atomic bundle grants and source metadata for run, earned, rewarded-ad, IAP, and support grants.
- IAP-source grants require a stable order/grant ID and repeated IDs are idempotent, preventing duplicate client-side grants.
- Added a disabled purchase adapter plus planned SKU/grant records. No payment UI, price, Apps in Toss SDK, server, advertisement, or purchasable product is active in the public build.
- Bomb and clock have playable free-run implementations, but their planned products remain disabled until purchase verification and restoration are connected.
- Freeze and clover remain hidden and unimplemented.
- Paid inventory is explicitly documented as server-authoritative; localStorage is not used for paid balances.
- Added four inventory tests covering free counts, safe consumption, IAP idempotency, and atomic bundle validation.

# Combo, round, and final-countdown tuning (2026-08-06)

- Preserved `attachStickyRectangleInput()`, `cellFromPoint()`, and the approved pointer event flow without edits.
- Combo 3/5/8 now scales the reward instead of only recoloring it: 6/9/14 decor particles, larger milestone score bursts, stronger board feedback, and a short combo-8 fever glow.
- Board generation now has round-shaped answer floors while retaining the existing sum-10 guarantee after generation and shuffle:
  - Round 1 / 4×4: at least 5 answers, including 3 simple pairs and 1 rich 3+ tile answer.
  - Round 2 / 5×5: at least 7 answers, including 2 simple pairs and 2 rich answers.
  - Round 3 / 6×6: at least 9 answers, including 1 simple pair and 4 rich answers.
- The final ten seconds now have one light audio tick per second, stronger double-note ticks and small haptics at 3/2/1, a pulsing time HUD, and a restrained coral edge treatment. It does not block the board or use a full-screen flash.
- Browser checks passed at 360×780, 390×844, and 430×932 with no document overflow. Real pointer drags confirmed sum-10 removal, the combo-3 banner plus six particles, and automatic Round 1 → 2 transition.
- Automated checks: five audio/board tests passed; 750 generated/shuffled boards retained their round-specific answer floors and a valid answer after shuffle.

# Original OING audio integration (2026-08-06)

- Read-only source: `https://github.com/sbp37/oing/blob/main/index.html`
- Reused WebAudio behavior: `playSuccess`, `playComboUp`, `playCombo7`, `playWrongSoft`, `playHint`, `playShuffleSoft`, `playStagePass`, and `playGameOver`.
- The original success/combo/game-over effects are synthesized in code rather than stored sound files. The item-only Base64 MP3 data was not copied.
- The v2 result screen now waits for a 1.05 second board-level `TIME UP!` transition before showing results, mirroring the original game's short result delay without copying its screen structure.

# Bomb and clock prototype items (2026-08-06)

- Every run now includes one free bomb and one free clock alongside the existing hint and shuffle counts.
- Bomb selection locks drag input, lets the player choose one tile, clears the clamped 3×3 neighborhood, awards the original OING-style `removed value sum + 20`, and carries the active combo without advancing the round goal.
- Clock adds eight seconds to both the visible state and the running timer deadline.
- Reused the original OING `playBomb()` impact/shard idea and `playClock()` 880/1320/1760 bell sequence from the read-only source. No Base64 audio was copied.
- Empty cells keep the same tile-sized board grid, and a bomb that leaves no sum-10 rectangle triggers the existing guaranteed-answer board recovery.
- Verified the 2×2 item layout at 320×720, 360×780, 390×844, and 430×932 with no horizontal or vertical document overflow and no clipped buttons.
- Actual browser interaction passed for bomb targeting/consumption, 3×3 removal, score/combo update, remaining-answer guarantee, clock consumption, and +8 seconds. Browser console errors: 0.
- Automated suite: 11 tests passed, including bomb rectangle clamping, bomb scoring, audio note sequences, and item inventory consumption.
- `js/input.js`, `attachStickyRectangleInput()`, `cellFromPoint()`, and the approved pointer flow were not changed.
