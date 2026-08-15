# OING Toss v2 asset usage

배포 에셋은 `oing-toss-assets-v1/` 원본을 기준으로 사용했다. 기존 캐릭터·아이콘·UI는 lossless WebP 원본을 유지하고, 배경 두 장만 실제 화면 비교 후 WebP quality 86으로 재압축했다. 신규 상·하단 크롬은 1536px 투명 PNG를 원본으로 보관하고, 모바일 첫 로딩을 위해 눈에 띄는 손실이 없는 WebP quality 92 배포본을 사용한다. 콘셉트 보드나 마스터 시트의 일부는 다시 크롭하지 않았다.

플레이 보드는 모든 칸이 같은 타일 하나(`tiles-syrup-v4/tile-mint.webp`)를 쓴다. 색을 칸마다 다르게 주는 방향은 여러 번 시도했지만, 보드는 한 판에 2분을 계속 쳐다보는 화면이라 42칸에 깔린 채도가 누적된다. 눈이 편할 만큼 옅으면 흐려 보이고 의도가 읽힐 만큼 진하면 피로해서, 그 사이에 성립하는 값이 없었다.

이 타일은 L*90 · C*8로 색조가 거의 없지만 시럽의 무지갯빛 굴절이 안에 살아 있어(면 전체 산포 약 2.5 ΔE) 평평한 색판이 아니라 재질로 읽힌다. 매력을 색이 아니라 재질에서 얻는 방식이고, 채도가 낮으므로 42칸에 깔려도 누적되지 않는다. 화려함은 선택·힌트·성공·콤보처럼 짧고 국소적인 순간이 맡는다.

예외는 보너스 고양이 칸 하나다. 같은 시럽 세트의 peach를 쓰는데, 판당 두세 칸뿐이라 채도가 누적되지 않는다. 보드와 명도가 같아(L*90.1 대 90.3) 화면에서 튀지 않으면서 ΔE 14.1의 색상 차이로 다른 칸임이 한눈에 읽힌다.

색이 답을 알려줄 여지도 함께 사라졌다. 숫자는 계속 HTML 텍스트로 렌더링한다.

하단 아이템은 숫자 타일 에셋과 분리한 4개의 작은 토이 버튼으로 통일했다. 버튼 셸은 CSS로 크림·민트·코랄·하늘색의 도톰한 표면과 눌림 깊이를 만들고, 아이콘·이름·남은 횟수는 독립 이미지와 HTML 텍스트로 렌더링한다.

`assets/fonts/Jua-Latin.woff2`는 숫자·영문용 Jua 서브셋이다. 한글 버튼·말풍선·큰 제목에는 Google Fonts의 Jua 원본에서 현재 게임에 필요한 한글 179자만 추린 `assets/fonts/Jua-Korean-Game.woff2`를 사용한다. 두 파일을 합쳐도 약 58KB이며 `assets/fonts/OFL-Jua.txt`에 SIL Open Font License 1.1을 함께 보관한다. 작은 HUD와 보드 숫자는 기존 가독성 높은 글꼴을 유지한다.

## 실제 사용 파일

| 실제 사용 파일 | 원본 경로 | 사용 화면 | CSS 표시 크기 |
|---|---|---|---:|
| `assets/fonts/Jua-Korean-Game.woff2` | Google Fonts `ofl/jua/Jua-Regular.ttf`에서 사용 한글만 서브셋 | 홈·버튼·말풍선·결과·오버레이의 강조 문구 | 12–20px |
| `assets/sounds/oing-original-bgm.mp3` | 원조 OING `https://sbp37.github.io/oing/bgm.mp3` | 플레이 배경음악(사용자가 음악 ON 시에만 로드) | 기본 슬라이더 40%, 제곱 게인 0.16 |
| `assets/backgrounds/home-bg@2x.webp` | `oing-toss-assets-v1/assets/backgrounds/home-bg@2x.webp` | 홈·결과 배경 | 최대 430×932 |
| `assets/backgrounds/play-bg@2x.webp` | `oing-toss-assets-v1/assets/backgrounds/play-bg@2x.webp` | 플레이 배경 | 최대 430×932 |
| `assets/backgrounds/board-secret-garden-v1.webp` | imagegen으로 신규 제작한 `assets/source/board-secret-garden-v1.png` | 숫자 제거 후 빈칸을 통해 드러나는 보드 하부 일러스트 | 보드 내부 320–400px, cover |
| `assets/ui/play-hud-chrome-v1.webp` | 첨부 레퍼런스를 구조·재질 참고로 imagegen 신규 제작 후 외곽 연결 크로마키만 제거 | 플레이 상단의 빈 버튼·STAGE 휘장·타이머·점수/목표/콤보 셸 | 화면 폭 296–406px, 고유 비율 유지 |
| `assets/ui/play-footer-chrome-v1.webp` | 첨부 레퍼런스를 구조·재질 참고로 imagegen 신규 제작 후 외곽 연결 크로마키만 제거 | 플레이 하단의 빈 말풍선·4색 아이템 도크 셸 | 화면 폭 296–406px, 고유 비율 유지 |
| `assets/backgrounds/play-bg-v4.webp` | 첨부 플레이 레퍼런스는 색감·구도만 참고하고 imagegen으로 새로 제작한 `assets/source/play-bg-v4.png` | 플레이 화면의 선명한 푸른 하늘과 하단 꽃밭 | 모바일 전체 화면, cover |
| `assets/ui/play-hud-chrome-v2.webp` | imagegen 신규 제작 `assets/source/play-hud-chrome-v2-chroma.png`에서 외곽 연결 크로마키만 제거 | 독립 일시정지·사운드 버튼, STAGE 배지, 타이머, 기록 패널 | 화면 폭 300–400px, 고유 비율 유지 |
| `assets/ui/item-dock-v2.webp` | imagegen 신규 제작 `assets/source/play-footer-chrome-v2-chroma.png`에서 자동 분리 | 하단 4색 아이템 도크 셸 | 화면 폭 282–370px, 고유 비율 유지 |
| `assets/ui/speech-bubble-v2.webp` | imagegen 신규 제작 `assets/source/play-footer-chrome-v2-chroma.png`에서 자동 분리 | 플레이 고양이 말풍선 프레임 | 화면 폭 168–230px, 고유 비율 유지 |
| `assets/ui/shuffle-poof-v2.webp` | imagegen으로 신규 제작한 `assets/source/shuffle-poof-v2.png` | 선형 효과를 대체하는 젤리 구름 셔플 팝 | 보드 중앙 118–170px |
| `assets/characters/cat-idle.webp` | `oing-toss-assets-v1/assets/cat/cat-idle.webp` | 홈 중심 캐릭터 | 홈 약 188–270px |
| `assets/characters/cat-wave.webp` | `oing-toss-assets-v1/assets/cat/cat-wave.webp` | 힌트 반응 | 플레이 stage 62–96px |
| `assets/characters/cat-cheer.webp` | `oing-toss-assets-v1/assets/cat/cat-cheer.webp` | 콤보 3·라운드·10초 경고·일반 결과 | 플레이 stage 62–80px, 결과 102–142px |
| `assets/characters/cat-success.webp` | `oing-toss-assets-v1/assets/cat/cat-success.webp` | 첫 성공·콤보 5+·신기록 결과 | 플레이 stage 62–80px, 결과 102–142px |
| `assets/characters/cat-peek.webp` | `oing-toss-assets-v1/assets/cat/cat-peek.webp` | 플레이 기본 | stage 62–80px |
| `assets/characters/cat-fail.webp` | `oing-toss-assets-v1/assets/cat/cat-fail.webp` | 오답·낮은 결과 | 플레이 stage 62–80px, 결과 102–142px |
| `assets/ui/logo.webp` | `oing-toss-assets-v1/assets/ui/logo.webp` | 홈 로고 | 142–212px |
| `assets/ui/button-settings.webp` | `oing-toss-assets-v1/assets/ui/button-settings.webp` | 홈 설정 | 39–44px |
| `assets/ui/button-pause.webp` | `oing-toss-assets-v1/assets/ui/button-pause.webp` | 플레이 일시정지 | 43–48px |
| `assets/ui/tiles-syrup-v4/tile-mint.webp` | `assets/source/tile-syrup-v4-alpha.png`에서 분리 | 보드 전 칸의 유일한 타일 (L*90 C*8, 숫자 대비 5.99:1) | 256×256 원본, 셀 약 44–59px |
| `assets/ui/tiles-syrup-v4/tile-peach.webp` | `assets/source/tile-syrup-v4-alpha.png`에서 분리 | 보너스 고양이 칸 (L*90 C*17, 보드와 명도 동일·ΔE 14.1)·홈 화면 합10 예시 미니 타일 | 셀 약 44–59px, 홈 44px |
| `assets/icons/navigation/trophy.webp` | `oing-toss-assets-v1/assets/icons/trophy.webp` | 홈·결과 랭킹 | 27px |
| `assets/icons/navigation/home.webp` | `oing-toss-assets-v1/assets/icons/home.webp` | 결과 홈으로 | 24px |
| `assets/icons/hud/score.webp` | `oing-toss-assets-v1/assets/icons/coin.webp` | 점수 HUD | 22px |
| `assets/icons/hud/time.webp` | `oing-toss-assets-v1/assets/icons/clock.webp` | 시간 HUD | 21–24px |
| `assets/decor/star.webp` | `oing-toss-assets-v1/assets/decor/star.webp` | 콤보 HUD·최고기록 카드·성공 장식 | 15–28px |
| `assets/icons/items/hint.webp` | `oing-toss-assets-v1/assets/icons/hint.webp` | 힌트 버튼 | 25–31px |
| `assets/icons/items/shuffle.webp` | `oing-toss-assets-v1/assets/icons/shuffle.webp` | 섞기 버튼 | 35px |
| `assets/icons/items/bomb.webp` | `oing-toss-assets-v1/assets/icons/bomb.webp` | 하단 폭탄·콤보 보상 보드 드롭 | 버튼 27–34px, 보드 27–49px |
| `assets/icons/items/megabomb.webp` | 기존 `bomb.webp` 스타일 참조 후 imagegen 생성, `assets/source/megabomb-icon-chroma.png`에서 분리 | 콤보 14+ 메가폭탄 보드 드롭 | 512×512 원본, 보드 33–57px |
| `assets/icons/hud/time.webp` | `oing-toss-assets-v1/assets/icons/clock.webp` | 시간 HUD·하단 시계·콤보 보상 보드 드롭 | HUD 21–24px, 보드 25–51px |
| `assets/icons/items/freeze.webp` | `oing-toss-assets-v1/assets/icons/freeze.webp` | 플레이 보드 타임프리즈 드롭·시간 HUD | 보드 최대 54px, HUD 20px |
| `assets/icons/items/clover.webp` | `oing-toss-assets-v1/assets/icons/clover.webp` | 플레이 보드 클로버 드롭·행운 효과 | 보드 최대 56px |
| `assets/decor/star.webp` | `oing-toss-assets-v1/assets/decor/star.webp` | 홈·성공 파편·라운드·결과 | 15–24px |
| `assets/decor/sparkle.webp` | `oing-toss-assets-v1/assets/decor/sparkle.webp` | 홈·드래그·첫 조작 유도·성공 파편·라운드·결과 | 9–20px |
| `assets/decor/heart.webp` | `oing-toss-assets-v1/assets/decor/heart.webp` | 홈 장식·성공 파편 | 17–22px |
| `assets/decor/paw.webp` | `oing-toss-assets-v1/assets/decor/paw.webp` | 성공 파편 | 17px |

## 최적화로 제거한 중복

| 제거 파일 | 동일한 실제 사용 파일 | 처리 |
|---|---|---|
| `assets/icons/hud/combo.webp` | `assets/decor/star.webp` | 바이트 단위 동일 파일이라 참조를 통합하고 중복 제거 |
| `assets/icons/items/clock.webp` | `assets/icons/hud/time.webp` | 바이트 단위 동일 파일이라 미래 아이템 경로를 통합하고 중복 제거 |

## 복사했지만 현재 화면에 사용하지 않은 파일

| 파일 | 이유 |
|---|---|
| `assets/icons/hud/goal.webp` | 목표 HUD를 얇게 유지하기 위해 아이콘을 생략했다. |
| `assets/ui/button-back.webp` | 현재 3화면 흐름에는 뒤로가기 버튼이 없다. |
| `assets/ui/tile-disabled.webp` | 보드에 disabled 타일 상태가 아직 없다. |
| `assets/ui/tile-{normal,selected,success,hint,empty}.webp` | 독립 시럽 타일 세트로 교체해 보존만 한다. |
| `assets/ui/tiles-v3/` 전체 | 이전 밀키 글라스 후보 세트다. 내부 굴절 무늬가 거의 없어(산포 0.2) 재질감이 죽는다. |
| `assets/ui/tiles-syrup-v4/tile-{blush,lemon,aqua,lilac}.webp` | 보드가 단일 타일로 바뀌어 색상별 세트가 필요 없다. 실제로 쓰는 것은 보드용 mint와 고양이 칸용 peach 두 장뿐이다. 나머지는 원본만 보존한다. |
| `assets/ui/item-buttons-v1/` 전체 | 긴 가로형 셸이라 4개 아이템을 한 줄에 배치하면 보드 공간을 압박한다. 정사각 시럽 슬롯으로 교체해 원본만 보존한다. |
| `assets/decor/cloud.webp` | 배경 자체에 구름이 있어 중복 장식을 피했다. |
| `assets/decor/flower.webp` | 배경 하단 꽃밭과 중복되어 사용하지 않았다. |

## v1에 있으나 복사하지 않은 배포 에셋

- UI 셸: `board-frame`, `button-primary`, `button-secondary`, `button-small`, `button-ranking`, `button-hint`, `button-shuffle`, `hud-blue`, `hud-score`, `hud-time`, `hud-combo`, `hud-goal`, `progress-track`, `result-panel`, `speech-bubble`
  - 이유: 고정 종횡비 셸을 280–430px 반응형 레이아웃에 늘이면 모서리가 왜곡되고, 단순화한 HUD·결과 위계와 충돌한다. 텍스트와 동적 수치는 HTML/CSS로 유지했다.
- 아이콘: `coin`, `gift`의 별도 원본 중 `coin`은 HUD 이름으로 복사해 사용했고 `gift`는 목표 아이콘을 생략해 사용하지 않았다.
- 타일: PNG 버전 전부
  - 이유: 동일 픽셀의 lossless WebP 배포본을 사용한다.
- 소스 마스터 시트 3종과 chroma 원본
  - 이유: QA·재분리용 원본이며 실제 게임 런타임에 로드하지 않는다.

## 누락 에셋

- 독립 다시 하기 아이콘
- 독립 콤보 전용 아이콘 (`decor/star`로 동일 세트 안에서 대응)
- 긴장 전용 고양이 포즈 (`cat-cheer`를 사용)
- 힌트를 직접 가리키는 전용 포즈 (`cat-wave`를 사용)

누락 항목을 다른 캐릭터나 이모지로 대체하지 않았다.

## 로컬 글꼴

| 실제 사용 파일 | 원본 | 사용 위치 | 비고 |
|---|---|---|---|
| `assets/fonts/Jua-Korean-Game.woff2` | Google Fonts Jua | 제목·버튼·숫자 | 화면 문구 전체를 다시 스캔한 로컬 서브셋 |
| `assets/fonts/Pretendard-OING.woff2` | Pretendard 1.3.9 | HUD·설명·고양이 멘트 | 외부 CDN 없이 동작하는 게임 전용 로컬 서브셋 |

섞기 연출은 타일 이동과 단일 젤리 구름 에셋의 transform/opacity 모션을 조합하며 선형 CSS 장식은 사용하지 않는다.
