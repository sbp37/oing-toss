# 앱인토스(토스 웹앱) 제출 자료

앱 이름: **오잉게임** / Oing Game / `oing-game`

## 파일

| 파일 | 규격 | 용도 |
| --- | --- | --- |
| `icon-600.png` | 600×600 | 앱 아이콘. 원스토어에 올린 것과 같은 그림 |
| `thumbnail-1932x828.png` | 1932×828 | 목록 썸네일 |
| `01-home.png` | 636×1048 | 세로형 1 — 홈 |
| `02-play.png` | 636×1048 | 세로형 2 — 합 10을 묶는 순간 |
| `03-cards.png` | 636×1048 | 세로형 3 — 오잉 카드 수집 |

스크린샷은 게임을 실제로 띄워 찍었다. 판을 너무 비우면 숫자가 사라져 무슨
게임인지 안 보이므로, 숨은그림이 살짝 드러날 만큼만 지운 상태를 골랐다.

다시 뽑으려면 `tools/build-store-screenshots.mjs`와 같은 방식으로 뷰포트를
412×679(636×1048과 같은 비율)로 두고 찍은 뒤 줄인다.

## 꾸러미(.ait)

```sh
npm run build      # dist/client
npx ait build      # oing-game.ait
```

`apps-in-toss.config.mjs`가 `webBundleDir`을 `dist/client`로 가리키므로,
원스토어에 올린 안드로이드 앱과 정확히 같은 파일이 담긴다.

`.ait`는 빌드 산출물이라 저장소에 두지 않는다(`.gitignore`).

## 그 외 제출에 필요한 것

- 개인정보 처리방침 URL: 배포한 주소의 `/privacy.html`
- 앱 설명 문구: 아직 안 씀
