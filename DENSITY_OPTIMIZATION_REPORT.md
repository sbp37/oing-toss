# OING Toss v2 — 화면 밀도·말투·로딩 최적화 보고

## 1. 여백과 크기 수정

플레이 로직과 `js/input.js`는 수정하지 않고 CSS 배치만 조정했다.

| 항목 | 이전 | 수정 후 |
|---|---:|---:|
| 390px 플레이 HUD 실제 높이 | 약 86px | 71px, 약 17% 축소 |
| HUD → 보드 | 유동 중앙 정렬 + 상단 29px padding | 실제 10px |
| 보드 → 하단 컨트롤 | 큰 가변 여백 | 실제 10px |
| 하단 컨트롤 | 고양이/말풍선과 아이템이 분리 | 165px 공통 패널, 내부 간격 8px |
| 플레이 말풍선 | 9–12px, 절대 배치 | 16px, 48–58px 높이, 고양이와 한 행 |
| 결과 카드 padding | 18px 18px 15px | 13px 16px 11px |
| 결과 카드 → 고양이 | 가변 여백 | 16px |
| 고양이 → 결과 버튼 | 큰 가변 여백 | 18px |
| 결과 버튼 간격 | 9px | 10px |

390×844 실측에서 보드는 374px로 가장 큰 요소이며 `y=86–460`, 하단 컨트롤은 `y=470–635`다. 360×780에서는 보드 344px, HUD 71px, 하단 컨트롤 157px이며 스크롤이 없다.

## 2. 글자 크기와 폰트

- HUD 작은 라벨: 14px
- 목표: 15px
- 플레이·결과 고양이 멘트: 16px
- 결과 카드 보조 라벨: 16px
- 주 버튼·아이템 버튼: 18px
- 아이템 배지: 15px
- 결과 랭킹·홈: 17px

보드 숫자, 시간, 점수, 콤보, 결과 점수는 로컬 `Oing Jua`를 사용한다. 원본은 Google Fonts의 **Jua**이며 라이선스는 **SIL Open Font License 1.1**이다. 숫자·라틴 문자만 필요한 UI 특성에 맞춰 16,620바이트 WOFF2 서브셋만 번들했다.

- 폰트: `assets/fonts/Jua-Latin.woff2`
- 라이선스: `assets/fonts/OFL-Jua.txt`
- 원본: `https://github.com/google/fonts/tree/main/ofl/jua`

한글 UI는 가독성이 안정적인 시스템 한글 폰트를 유지한다. 보드 숫자는 Jua 고유의 둥근 획을 그대로 사용하며 과한 외곽선 없이 흰 하이라이트와 약한 그림자만 둔다.

## 3. 변경한 고양이 멘트 전체 목록

같은 종류마다 2–3개 후보를 두고 `pickMessage()`가 직전 문장을 제외해 연속 중복을 막는다.

| 상황 | 후보 문구 |
|---|---|
| 시작 | `10을 찾아보자냥!`, `슥 밀어서 10이다냥!` |
| 첫 성공 | `오잉, 찾았다냥!`, `딱 10이다냥!` |
| 일반 성공 | `좋다냥!`, `깔끔하다냥!`, `바로 그거다냥!` |
| 콤보 3 | `손이 빠르다냥!`, `콤보가 붙었다냥!` |
| 콤보 5 | `감 잡았구냥!`, `계속 이어가자냥!` |
| 콤보 8+ | `완전 신났다냥!`, `콤보가 쭉쭉이다냥!` |
| 실패 | `앗, 10이 아니다냥`, `조금 아깝다냥`, `다시 골라보자냥` |
| 힌트 | `여기 보라냥!`, `이쪽이 수상하다냥!` |
| 섞기 | `한번 섞어보자냥!`, `새로 찾아보자냥!` |
| 라운드 이동 | `다음 판도 가자냥!`, `더 찾아보자냥!` |
| 10초 이하 | `조금만 더다냥!`, `시간이 얼마 없다냥!` |
| 높은 결과 | `이번 판 최고다냥!`, `아주 잘 풀었다냥!` |
| 보통 결과 | `제법 잘했다냥!`, `이번 판 좋았다냥!` |
| 낮은 결과 | `아깝다냥, 한 번 더!`, `다음 판엔 된다냥!` |
| 최고기록 | `새 기록이다냥!`, `최고점수 갱신이다냥!` |
| 최고기록 미갱신 | `최고기록까지 N점 남았다냥` — 실제 점수 차이 계산 |

기타 고정 문구도 `새 보드로 이어간다냥!`, `가능한 보드를 준비했다냥!`, `잠깐 쉬어가자냥`, `시간도 같이 멈췄다냥`, `랭킹은 아직 준비 중이다냥`, `지금은 최고기록만 저장한다냥`으로 통일했다.

## 4. 이미지별 최종 파일 크기

| 파일 | 바이트 |
|---|---:|
| `backgrounds/home-bg@2x.webp` | 55,526 |
| `backgrounds/play-bg@2x.webp` | 26,318 |
| `characters/cat-cheer.webp` | 114,146 |
| `characters/cat-fail.webp` | 110,436 |
| `characters/cat-idle.webp` | 108,826 |
| `characters/cat-peek.webp` | 60,992 |
| `characters/cat-success.webp` | 105,274 |
| `characters/cat-wave.webp` | 104,168 |
| `decor/cloud.webp` | 36,846 |
| `decor/flower.webp` | 47,256 |
| `decor/heart.webp` | 37,444 |
| `decor/paw.webp` | 47,476 |
| `decor/sparkle.webp` | 26,986 |
| `decor/star.webp` | 33,374 |
| `icons/hud/goal.webp` | 48,844 |
| `icons/hud/score.webp` | 50,974 |
| `icons/hud/time.webp` | 60,636 |
| `icons/items/bomb.webp` | 49,278 |
| `icons/items/clover.webp` | 53,676 |
| `icons/items/freeze.webp` | 53,352 |
| `icons/items/hint.webp` | 42,246 |
| `icons/items/shuffle.webp` | 48,126 |
| `icons/navigation/home.webp` | 50,940 |
| `icons/navigation/trophy.webp` | 52,304 |
| `ui/button-back.webp` | 36,508 |
| `ui/button-pause.webp` | 42,464 |
| `ui/button-settings.webp` | 42,634 |
| `ui/logo.webp` | 61,884 |
| `ui/tile-disabled.webp` | 68,454 |
| `ui/tile-empty.webp` | 71,938 |
| `ui/tile-hint.webp` | 74,146 |
| `ui/tile-normal.webp` | 70,112 |
| `ui/tile-selected.webp` | 73,314 |
| `ui/tile-success.webp` | 74,344 |

배경은 887×1774 해상도를 유지하며 WebP quality 86으로 재압축했다. 원본과 최적화본을 실제 화면 크기로 비교해 경계·꽃·구름에 눈에 띄는 손실이 없는 것을 확인했다. 캐릭터와 UI는 투명 가장자리 보존을 위해 기존 lossless WebP를 유지했다.

## 5. 초기 로드 전후 비교

| 범위 | 이전 | 수정 후 | 감소 |
|---|---:|---:|---:|
| 홈 핵심 preload 3종 | 1,289,980B | 221,578B | 82.8% |
| 홈에서 보이는 고유 이미지 | 1,482,722B | 414,320B | 72.1% |
| 전체 이미지 패키지 | 4,118,762B | 2,041,242B | 50.4% |

- 홈 배경: 1,123,928B → 55,526B
- 플레이 배경: 941,426B → 26,318B
- 플레이 idle preload 대상 합계: 1,163,008B. 홈에서 이미 받은 `cat-wave`, `star`는 재전송하지 않는다.
- 결과 전용 첫 진입: 결과 고양이와 내비게이션 아이콘을 플레이 시작 뒤 preload하므로 정상 흐름에서는 추가 대기 없이 캐시를 사용한다.
- `combo.webp`와 `star.webp`, `clock.webp`와 `time.webp`는 바이트 단위 중복이라 참조를 통합했다. 최종 이미지 간 중복 SHA-256은 없다.

## 6. Preload 전략

1. `<head>`에서 홈 배경, 로고, 홈 고양이만 `rel=preload` + `fetchpriority=high`로 요청한다.
2. 홈 고양이와 로고는 `loading=eager`, 나머지 화면의 `<img>`는 `loading=lazy`, 전체 이미지는 실제 width/height와 `decoding=async`를 갖는다.
3. 홈 로드 후 `requestIdleCallback`에서 플레이 배경·고양이 포즈·HUD·아이템·타일을 미리 디코딩한다.
4. 플레이 시작 뒤 결과 포즈와 결과 내비게이션 에셋을 background preload한다.
5. 포즈 교체는 새 이미지의 decode/load가 끝날 때까지 기존 포즈를 유지해 빈 프레임을 방지한다.
6. 사용하지 않는 `cat-idle`은 초기 preload 대상에서 제외했다.

정적 배포 시에는 `home-bg.<content-hash>.webp` 형식의 파일명과 `Cache-Control: public, max-age=31536000, immutable`을 권장한다. HTML은 짧은 캐시 또는 재검증 방식으로 두어야 한다.

## 7. 모바일·로직 테스트

| 화면 | 뷰포트 | 가로/세로 스크롤 | 보드 | 글자·버튼 잘림 |
|---|---|---|---:|---|
| 플레이 | 360×780 | 없음 | 344px | 없음 |
| 결과 | 360×780 | 없음 | 해당 없음 | 없음 |
| 플레이·결과 | 390×844 | 없음 | 374px | 없음 |
| 플레이·결과 | 430×932 | 없음 | 374px | 없음 |

- 실제 Pointer Events 드래그 합10: 점수 440, 콤보 1, 목표 1/3 — 통과
- 실제 실패 드래그: 콤보 1→0, 실패 포즈·랜덤 말투 — 통과
- 힌트 클릭: 3→2, wave 포즈·랜덤 말투 — 통과
- 포즈 3연속 교체 success→fail→wave: 빈 이미지 프레임 없음
- 플레이 이미지 naturalWidth/Height와 complete 상태: 전부 정상
- 브라우저 console warning/error: 없음
- 보드 생성·섞기 750회: 통과
- `js/input.js` SHA-256: `1c1edb8f019304c7f7ca0f09c3ece19d7aaca233f0a7c0f04121dbe2a96e56aa`로 변경 없음

## 8. 실제 브라우저 캡처

- `PREVIEW_PLAY_DENSE_390.png`
- `PREVIEW_RESULT_DENSE_390.png`
- `PREVIEW_PLAY_SMALL_TEXT_360.png`
- `PREVIEW_RESULT_360.png`

## 9. 남아 있는 문제

- Jua는 숫자·라틴 서브셋만 사용한다. 전체 한글까지 같은 글꼴로 통일하려면 약 2MB의 전체 TTF 또는 실제 문구 기반 한글 서브셋 빌드가 필요하다.
- CSS 진동과 `navigator.vibrate()`의 실제 체감은 iOS·Android 실기기에서 최종 확인이 필요하다.
- 로컬 테스트 서버는 장기 캐시 헤더를 설정하지 않는다. 위 content-hash/immutable 정책은 실제 정적 배포 설정 단계에서 적용해야 한다.
- 자동 배포·머지·Firebase·Apps in Toss SDK 연결은 수행하지 않았다.
