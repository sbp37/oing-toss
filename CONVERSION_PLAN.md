# 오잉게임 → 토스 웹앱(앱인토스) 변환 계획서

원본: `sbp37/oing`의 `index.html` (단일 HTML, 바닐라 JS, 약 1.8MB / 14,600여 줄).
목표: Firebase 전부 제거 · 토스 SDK 스텁 · **스코어어택 → 스테이지형** 전환 · 시니어 배려.

이 문서는 원본 함수명 기준으로 **삭제 / 유지 / 수정** 대상을 정리한 계획서다.
실제 산출물은 이 저장소의 `index.html`(스테이지형 뼈대)로 새로 작성했다.

---

## A. 삭제 (원본에서 들어냄)

### A-1. Firebase 스택 전체
| 원본 위치/식별자 | 설명 |
|---|---|
| `<script type="module">` 상단 Firebase import (line ~4082) | firebase-app / auth / firestore / functions SDK import |
| `ensureAnonymousAuth()` | 익명 인증 |
| `httpsCallable(fns, 'startSession')`, `'submitScore'` | Cloud Functions 호출 |
| `db`, `doc()`, `getDoc()`, `setDoc()`, `collection()` 등 Firestore I/O | 랭킹/유저 문서 읽기·쓰기 |
| `renderRanking`, `renderRankingInner`, `renderWeeklyRanking`, `renderWeeklyThanks`, `renderMyRankSummary`, `renderWeekSpurtBanner` | 주간/친구 랭킹 화면 → **토스 리더보드 SDK로 대체** |
| `firebase.json`, `firestore.rules`, `admin/`, `test/` | 서버 설정/규칙/함수 |

### A-2. 치팅 계측(관찰용) 코드 — 부정행위 대응은 플랫폼 몫
| 식별자 |
|---|
| `_shadowSessionId`, `_shadowSubmitted`, `_shadowFailCount`, `_shadowSuccTimes`, `_shadowMaxIn3s`, `_shadowClockUsed` |
| `_shadowResetTelemetry()`, `_shadowNoteSuccess()`, `_shadowStartSession()`, `_shadowLedger`, `_shadowHid` |
| `detectDeviceInfo()`, `logBehavior()` |

### A-3. 부가 화면/기능
| 식별자 |
|---|
| 스킨샵/프레임샵: `SKIN_CATALOG`, `FRAME_CATALOG`, `skinPickedNick` 등 |
| 후원/젤리: `openDonateOverlay`, `DEFAULT_DONATE_BUBBLE`, `ENABLE_JELLY_SHOP` |
| 문의/리뷰: `openContactOverlay`, `closeContactOverlay`, `feedbackText`, `rvwText` |
| 업데이트 로그/버전배너: `openUpdateLog`, `checkForNewVersion`, `showNewVersionBanner`, `UPDATE_VERSION`, `BUILD`, `SEEN_KEY` |
| 닉네임: `loadNickname`, `NICK_KEY` |
| 일일목표/방문통계: `renderDailyGoalResult`, `renderStartScreenGoal`, `getTodayDateStr` |
| PWA/SW: `sw.js`, `manifest.json`(앱인토스 셸이 대신함) |

### A-4. 시간압박 스코어어택 골격
| 식별자 | 이유 |
|---|---|
| `timeLeft = 120`, `timerInterval`, `maxTimeSeen`, 시간 게이지 UI | 스테이지형에선 1~5는 타이머 없음, 이후 스테이지별 제한으로 재설계 |
| 전역 누적 `score` 단일 랭킹 제출 | → **진행도 점수(도달 스테이지×1000 + 누적 별)** 로 대체 |

---

## B. 유지 (오잉게임의 코어 — 새 파일로 이식)

| 원본 함수/개념 | 새 파일에서의 대응 | 비고 |
|---|---|---|
| **합10 직사각형 판정** `tryRemove(sel2)` | `tryClear(rMin,rMax,cMin,cMax)` | 규칙 그대로: 사각형 내 숫자합 == 10 |
| 고양이 = 합산 제외 와일드카드 | `cell.cat`, `onlyCat` 유효 처리 | 원본 로직 유지 |
| **드래그 사각형 선택** `mousedown/move/up`, `dragStart`, `sel1` | 포인터 이벤트 통합(`pointerdown/move/up`) | 터치+마우스 단일 경로 |
| 콤보 `combo`, `MAX_COMBO`, 콤보 점수 `Math.min(combo, cap)` | `combo`, 콤보 팝업 | 유지 |
| 보드 생성 `makeBoard()` + `seedAdjacentPairs()` + `countValidMoves()` | `generateStageBoard(cfg)` + `isClearableTo(ratio)` 솔버 | 짝 심기·검증 개념 계승 |
| 렌더 `renderGrid()`, `cellEl()`, `renderCatCell()` | `renderBoard()`, `cellAt()` | CSS Grid |
| 하이라이트 `applyHighlights()`, `highlightRange()` | `paintRange()` | 드래그 미리보기 + 합계 프리뷰 |
| 아이템 `spawnRandomItem()` (폭탄/시계/메가폭탄/프리즈/럭키) | `ITEM_DEFS` + `applyItemEffects()` | **스테이지 10+부터** 하나씩 소개 |
| 이펙트/사운드 `playSuccess/playWow/playCombo*`, `spawnConfetti`, 점수팝업 | `sfx()`, `popScore()`, `burstConfetti()` | 타격감·연출 유지(WebAudio 합성음) |
| 고양이/파스텔 비주얼, 라이트 아이보리 테마 | `:root` 팔레트(시니어용 고대비 아이보리 기본) | 유지·강화 |

---

## C. 수정/신규 (스테이지형 전환의 핵심)

| 신규 함수 | 역할 |
|---|---|
| `TossSDK` (스텁 오브젝트, 파일 상단 1곳) | `submitScore()`, `openLeaderboard()`, `showRewardedAd()`, `haptic()` — 실제 SDK로 갈아끼우기 쉽게 |
| `getStageConfig(stage)` | 스테이지 번호 → `{ size, timeLimit, hints, clearRatio, pairWeights, items }` |
| `startStage(n)` / `winStage()` / `loseStage()` / `nextStage()` | 시작→플레이→클리어/실패→다음 흐름 |
| `computeStars()` | 별 3개(무실수/시간/효율 기반) |
| `progressScore()` | `maxStage*1000 + totalStars` → `TossSDK.submitScore()` **플레이 완료 후에만** |
| `runTutorial()` | 첫 실행 3단계 인터랙티브(“이 두 개를 이어보세요” 하이라이트) |
| `saveProgress()` / `loadProgress()` | `localStorage`만 사용(서버 없음) |

### 난이도 사다리 (`getStageConfig`)
| 스테이지 | 보드 | 숫자/짝 분포 | 시간 | 힌트 | 목표 | 아이템 |
|---|---|---|---|---|---|---|
| 1~5 (입문) | 5×5 | 5+5·4+6 위주, **완전 클리어 보장(솔버 검증)** | 없음 | 무제한 | 100% | 없음 |
| 6~15 (적응) | 6×6 | ~1-7 | 180초 | 3 | 70% | 없음 |
| 16~30 (표준) | 7×7 | ~1-9 | 120초 | 2 | 80% | 10+부터 폭탄→시계 순 |
| 31+ (도전) | 8×8 | 1-9, 어려운 짝↑ | 90초~ | 1 | 90%+ | 전체 |

- **입문(1~5)**: `generateStageBoard`가 도미노 타일링(각 짝이 합10)으로 100% 클리어 가능한 판만 생성 → 시니어도 막힘 없음.
- 실패=하트/목숨 없음, 무한 재도전. 잘한 정도는 별 3개로 표시.
- 클리어 화면에 **선택형** 보상광고(“보고 힌트 +2”) 스텁. 강제 광고·결제 없음.

---

## D. 하지 않은 것 (제약 준수)
- 합10 규칙 불변.
- 미확인 앱인토스 SDK 함수는 **전부 스텁**(`TossSDK.*`)으로만.
- 결제/현금 요소 없음(광고 스텁만).
- 원본 Firebase 코드 잔재 없음(새 파일은 처음부터 서버리스).
