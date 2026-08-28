# 인수인계 — 구글플레이 출시용 AAB 만들기

작성 2026-08-28 · 기준 커밋 `4c1d66e` (main)

> 후속 작업 메모: `codex/google-admob-v1` 브랜치에서는 다음 Google Play
> 버전용 AdMob 보상형·전면 광고를 준비한다. 이 문서의 "광고 없음" 안내는
> 현재 비공개 테스트 1.1.1에 대한 기록이다. 광고 브랜치를 머지한 다음에는
> `store/GOOGLE-PLAY.md`의 새 광고·데이터 보안 안내를 기준으로 삼는다.

읽는 대상: 이 저장소를 이어받아 **서명된 `.aab` 하나를 만들어 내는** 작업자.
게임 코드는 손댈 일이 없다. 포장과 서명만 남았다.

---

## 0. 한 줄 요약

> 안드로이드 프로젝트는 이미 다 구성돼 있고, GitHub Actions에서 AAB가
> **이미 성공적으로 빌드되고 있다.** 남은 것은 **서명**뿐이고, 그러려면
> 저장소 시크릿 두 개를 등록해야 한다. 그 등록만 사람 손이 필요하다.

---

## 1. 지금 상태

### 코드

| 항목 | 값 | 어디 |
| --- | --- | --- |
| main | `4c1d66e` | |
| 테스트 | **254개 전부 통과** (파일 32개) | `npm test` |
| 앱 이름(런처) | 오잉게임 | `android/app/src/main/res/values/strings.xml` |
| applicationId | `com.oinggame.app` | `android/app/build.gradle:31` |
| versionCode / versionName | `8` / `1.1.1` | `android/app/build.gradle:34-35` |
| compileSdk / targetSdk / minSdk | 36 / 36 / 24 | `android/variables.gradle` |
| Capacitor | 8 (AGP 8.13.0, Gradle 8.14.3) | |
| 화면 | 세로 고정, 액션바 없음 | `AndroidManifest.xml`, `styles.xml` |
| 권한 | `INTERNET`, `VIBRATE` 둘뿐 | `AndroidManifest.xml` |

**웹 소스는 그대로 감싸기만 한다.** `npm run build`가 만든 `dist/client`를
`cap sync`가 `android/app/src/main/assets/public`로 복사한다(약 12MB).
게임 로직·UI·localStorage 어느 것도 네이티브 쪽에서 건드리지 않는다.
Capacitor가 `https://localhost` 오리진으로 웹뷰를 띄우므로 localStorage는
앱을 껐다 켜도 남는다.

> **게임 코드는 수정 대상이 아니다.** 이 인수인계의 범위는 포장·서명뿐이다.

### 빌드 파이프라인 — 이미 돌고 있다

`.github/workflows/android-release.yml`

```
#15  success  4c1d66e   ← 2026-08-28, 최신 main
#14  success  ec47d6b
#13  success  047aa2b
#12  success  718eb64
```

**네 번 연속 성공했다.** 다만 서명 시크릿이 없어서 결과물이
`app-release.aab`(미서명) + `app-release-unsigned.apk`로 나온다.
매 실행마다 프리릴리스로 올라간다:
<https://github.com/sbp37/oing-toss/releases>

트리거는 두 가지 — `workflow_dispatch`(수동 버튼), 그리고 `android/**`,
`capacitor.config.json`, `package.json`, 워크플로 자신이 바뀐 main 푸시.

---

## 2. 왜 GitHub에서 빌드하나 (로컬에서 안 하고)

원저작 환경(클라우드 컨테이너)에서는 **`dl.google.com`이 네트워크 정책으로
차단**돼 있다.

```
dl.google.com:443   CONNECT tunnel failed, 403
maven.google.com    → dl.google.com/dl/android/maven2/ 로 리다이렉트 → 같은 403
services.gradle.org 200
repo1.maven.org     200
```

이건 SDK만의 문제가 아니다. **Android Gradle Plugin 자체가
`maven.google.com`에서 오므로 의존성 해석부터 실패한다.** 우회로는 없고,
비공식 미러에서 `android.jar`를 끌어와 배포용 서명 산출물을 굽는 것은
해서는 안 되는 선택이다.

GitHub 러너에는 안드로이드 SDK가 이미 있고 구글 호스트도 열려 있다.
그래서 빌드가 거기서 돈다.

**작업자의 환경에 이 제약이 없다면 로컬 빌드도 똑같이 유효하다.**
아래 4-B 참고.

---

## 3. 서명 구성 (Play App Signing 전제)

`android/app/build.gradle` 상단이 서명 정보를 **저장소 바깥에서만** 읽는다.

1. `android/keystore.properties` (`.gitignore` 23줄에 등록됨)
2. 없으면 환경변수 `OING_KEYSTORE_FILE` / `OING_KEYSTORE_PASSWORD` /
   `OING_KEY_ALIAS` / `OING_KEY_PASSWORD`
3. 둘 다 없으면 **서명 설정 자체를 만들지 않고**, 조용히 실패하는 대신
   로그를 남긴다: `[oing] 서명 정보 없음 - 릴리스 빌드는 서명되지 않습니다.`

여기서 쓰는 키는 **업로드 키**다. 실제 배포 서명 키는 구글이 만들어
보관한다(Play App Signing). 첫 업로드 때 동의 화면이 나오면 동의하면 된다.
업로드 키는 분실해도 구글에 재설정을 요청할 수 있다.

### 업로드 키는 이미 만들어져 있다

프로젝트 소유자가 파일로 갖고 있다. **저장소에는 없고, 있어서도 안 된다.**

| | |
| --- | --- |
| 파일 | `oing-upload.jks` (PKCS12, RSA 4096) |
| 별칭 | `oing-upload` |
| 유효기간 | 2054-01-13 |
| SHA-256 | `FB:D2:54:DE:49:9B:00:ED:55:8D:2B:AB:F3:32:70:A5:90:C6:91:C8:1F:07:E9:34:5F:70:8E:09:6A:18:21:B6` |

비밀번호와 base64 인코딩본은 소유자가 별도 파일
(`시크릿-2개.txt`, `ANDROID_KEYSTORE_BASE64.txt`)로 갖고 있다.
**이 저장소는 공개(public)다. 키 파일도 비밀번호도 절대 커밋하지 말 것.**

키가 없어졌다면 새로 만들면 된다(아직 아무것도 게시하지 않았으므로 교체 가능):

```sh
keytool -genkeypair -v -keystore oing-upload.jks -alias oing-upload \
  -keyalg RSA -keysize 4096 -validity 10000 -storetype PKCS12
```

---

## 4. 남은 일

### 4-A. GitHub에서 굽기 (권장 — 아무것도 설치하지 않는다)

**① 시크릿 2개 등록** ← 사람 손이 필요한 유일한 단계

<https://github.com/sbp37/oing-toss/settings/secrets/actions>
→ `New repository secret` 2번.

| Name | Secret |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `ANDROID_KEYSTORE_BASE64.txt` 내용 전체 (한 줄, 약 5,800자) |
| `ANDROID_KEYSTORE_PASSWORD` | 키스토어 비밀번호 |

> 원래 4개였는데 2개로 줄였다(`d50d772`). 별칭은 애초에 비밀이 아니고
> (`keytool -printcert -jarfile app-release.aab`로 그냥 읽힌다) 기본값
> `oing-upload`이 박혀 있다. 키 비밀번호는 생략하면 스토어 비밀번호를 쓴다.
> 손으로 채우는 칸이 하나 줄면 오타 날 자리도 하나 준다.
>
> **API로는 등록할 수 없다.** 원저작 환경에서 시도했더니
> `GET /repos/.../actions/secrets/public-key` → `403 Access to this GitHub
> Actions path is not permitted through this proxy.` 웹 UI에서 사람이 넣어야 한다.

**② 워크플로 실행**

<https://github.com/sbp37/oing-toss/actions/workflows/android-release.yml>
→ `Run workflow`

**③ 검증 — 반드시 확인할 것**

실행 로그의 `결과물 확인` 스텝에 `keytool -printcert -jarfile`의 출력이
찍힌다. 여기서 **소유자·발급자·SHA-256이 3항의 지문과 일치**해야 한다.
`서명 없음 (시크릿 미설정)`이 찍혔다면 시크릿이 안 먹은 것이다.

시크릿을 잘못 넣었다면 `서명 키 준비` 스텝이 그 자리에서 멈추고 이렇게 말한다:
`키스토어를 열지 못했다. ANDROID_KEYSTORE_BASE64가 잘렸거나
ANDROID_KEYSTORE_PASSWORD가 다르다.`
(붙여넣다 섞인 줄바꿈·공백은 워크플로가 알아서 털어낸다)

**④ 받기** — <https://github.com/sbp37/oing-toss/releases> 맨 위 프리릴리스의
`app-release.aab`

### 4-B. 로컬에서 굽기 (구글 호스트가 열려 있는 환경이라면)

준비물: JDK 21, Android SDK(Platform 36 + Build-Tools). Android Studio로
`android/` 폴더를 한 번 열면 `android/local.properties`에 SDK 경로가 잡힌다.

```sh
cp android/keystore.properties.example android/keystore.properties
# storeFile(절대경로) / storePassword / keyAlias=oing-upload / keyPassword 채우기

npm run android:aab
```

산출물:
```
android/app/build/outputs/bundle/release/app-release.aab
```

확인:
```sh
keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab
```

---

## 5. Play Console 쪽 상태

앱은 이미 만들어져 있다.

| 항목 | 값 |
| --- | --- |
| 앱 이름(스토어) | `오잉게임 : 숫자퍼즐` |
| 패키지 이름 | `com.oinggame.app` |
| 기본 언어 | 한국어 – ko-KR |
| 유형 | 게임 / 무료 |

> 스토어 이름(`오잉게임 : 숫자퍼즐`)과 런처 이름(`오잉게임`)이 다른 것은
> 의도한 것이다. 긴 이름은 홈화면 아이콘 밑에서 어차피 잘린다.

**아직 안 한 것:**

1. **⚠️ 클로즈드 테스트 요건 확인 — 다른 것보다 먼저.**
   콘솔 → 테스트 및 출시 → 프로덕션. 개인 개발자 계정에 "정식 출시 전
   비공개 테스트" 요건이 걸려 있으면 일정이 통째로 달라진다. 인원·기간은
   구글이 계속 바꾸므로 **콘솔에서 직접 확인할 것.** 여기 숫자를 적으면
   낡은 정보가 된다.
2. 앱 설정 체크리스트(광고·데이터 보안·콘텐츠 등급 등) — **답과 근거가
   `store/GOOGLE-PLAY.md` §4-4 표에 전부 정리돼 있다.** 추측하지 말고 그것을 볼 것.
3. 스토어 등록정보 문구 — `store/GOOGLE-PLAY.md` §2 (복붙용)
4. 그래픽 — 아이콘 `assets/icons/app/icon-512.png`,
   그래픽 이미지 `store/google-play/feature-graphic-1024x500.png`,
   스크린샷 `store/screenshots/*.jpg` 7장
5. AAB 업로드

### 현재 1.1.1 체크리스트에서 틀리기 쉬운 두 칸

- **광고 → "아니요, 광고 없음"**
  보상형 광고 코드는 있지만 `isAppsInTossWebView()`(= `ReactNativeWebView` &&
  `__appsInTossConstants`)가 참일 때만 동작한다. 구글플레이 빌드에서는 광고도
  랭킹도 친구초대 리워드도 **실행되지 않는다.** 근거: `store/GOOGLE-PLAY.md` §0
- **데이터 보안 → "수집하지 않음"**
  외부 호스트로 나가는 `fetch`/XHR/WebSocket/beacon이 하나도 없다(코드의 두
  `fetch`는 번들에 들어 있는 카드 이미지를 읽는다). 분석 도구 없음, 안드로이드
  빌드에 광고 SDK 없음. 이름과 달리 `js/telemetry.js`는 localStorage 전용이다.
  개인정보처리방침: <https://sbp37.github.io/oing-toss/privacy.html>

> 위 두 답은 광고가 없는 현재 1.1.1 비공개 테스트에만 해당한다. AdMob
> 브랜치를 머지한 다음 버전은 광고를 "예"로 표시하고, Google Mobile Ads
> SDK 기준으로 데이터 보안 양식을 다시 제출한다.

---

## 6. 건드리지 말 것

- **게임 로직·UI·CSS** — 이 작업의 범위가 아니다
- `js/leaderboard.js`, 토스 SDK 래퍼 — 확인된 버그 없이는 수정 금지
- `versionCode` — 이미 8. 다음 업로드부터 올린다(구글은 같은 값을 두 번 안 받는다)
- **키스토어·비밀번호를 저장소에 넣는 것** — 이 저장소는 공개다

## 7. 참고 문서

| 파일 | 내용 |
| --- | --- |
| `store/GOOGLE-PLAY.md` | 구글플레이 준비 전체. 등록 문구, 체크리스트 답과 근거 |
| `store/ANDROID.md` | 안드로이드 패키징·키 만들기 상세 |
| `.github/workflows/android-release.yml` | 빌드 워크플로 |
| `tools/gradle.mjs` | OS 무관 gradlew 래퍼 (`npm run android:aab`가 부른다) |
