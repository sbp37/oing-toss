# 스토어 제출 자료

## 스크린샷 (`screenshots/`)

원스토어 규격에 맞춰 실제 게임에서 뽑은 것들이다. 7장이고 전부
**732×1300(9:16), JPG, 330KB 이하**라 규격(최대 1300px · 2~8장 · 1MB 이하) 안에 들어간다.

| 파일 | 화면 |
| --- | --- |
| `01-home.jpg` | 홈 — 로고, 고양이, 규칙 한 줄 |
| `02-play.jpg` | 드래그로 합 10을 묶는 순간 |
| `03-wow.jpg` | 다섯 칸 이상 한 번에 지운 WOW 연출 |
| `04-picture.jpg` | 칸이 지워질수록 드러나는 숨은 그림 |
| `05-item.jpg` | 보드에 떨어진 폭탄 아이템 |
| `06-result.jpg` | 결과 — 점수와 신기록 |
| `07-record.jpg` | 내 기록과 고양이의 모험 수집 |

### 다시 뽑는 법

```sh
npx serve -s . -l 8766 &
node tools/build-store-screenshots.mjs          # 824×1464 PNG로 저장
python3 - <<'PY'
from PIL import Image
import glob, os
for f in sorted(glob.glob('store/screenshots/*.png')):
    im = Image.open(f).convert('RGB').resize((732, 1300), Image.LANCZOS)
    im.save(f[:-4] + '.jpg', quality=92, subsampling=0, optimize=True, progressive=True)
    os.remove(f)
PY
```

기록 화면과 홈의 최고점수는 테스트 모드에서 저장되지 않아서(테스트 실행이
실제 기록을 더럽히지 않도록 막아둔 것), 스크립트가 몇 판 해본 사람의 저장소를
심어놓고 찍는다. 게임 화면 자체는 전부 실제 플레이 상태다 — WOW는 진짜로
다섯 칸짜리 답을 찾아서 지운 순간이고, 숨은 그림도 답을 아홉 번 지워서 드러난
것이다.

## 개인정보 처리방침

`privacy.html` — 배포하면 `<도메인>/privacy.html`로 열린다. 스토어 등록 폼의
개인정보 처리방침 URL 칸에 그 주소를 넣으면 된다.
