# 안드로이드(원스토어) 패키징

웹게임을 그대로 감싼 Capacitor 앱이다. 게임 코드는 한 줄도 바뀌지 않았고,
`npm run build`가 만든 `dist/client`를 앱 안에 넣어서 띄운다.

| 항목 | 값 |
| --- | --- |
| applicationId | `com.oinggame.app` |
| 앱 이름 | 오잉게임 |
| versionCode / versionName | `1` / `1.0.0` (`android/app/build.gradle`) |
| minSdk / targetSdk | 24 / 36 |
| 화면 | 세로 고정 |

## 0. 준비물 (내 컴퓨터에 한 번만)

- **JDK 21** — Capacitor 8이 요구한다. `java -version`으로 확인.
- **Android Studio** (또는 commandline-tools) — 설치하면서 SDK Platform 36과
  Build-Tools를 같이 받는다. Android Studio로 `android/` 폴더를 한 번 열면
  `android/local.properties`에 SDK 경로가 자동으로 적힌다.

> 이 저장소가 도는 클라우드 컨테이너에서는 구글 SDK 서버(`dl.google.com`)가
> 네트워크 정책으로 막혀 있어서 AAB 빌드를 대신 돌려줄 수 없다. 아래 명령은
> 전부 로컬에서 실행하는 것들이다.

## 1. 업로드 키 만들기 (딱 한 번, 절대 잃어버리면 안 됨)

저장소 **바깥**에 두는 것을 권한다. 예시는 홈 아래 `oing-keys/`.

```sh
mkdir -p ~/oing-keys
keytool -genkeypair -v \
  -keystore ~/oing-keys/oing-upload.jks \
  -alias oing-upload \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -storetype PKCS12
```

- 비밀번호는 명령에 적지 말고 **물어볼 때 입력**한다(셸 기록에 남지 않게).
- 이름/조직을 물으면 아무 값이나 넣어도 되지만, 나중에 못 바꾸니 실명이나
  서비스명으로 넣는 편이 낫다.
- `-validity 10000`은 약 27년. 스토어는 2033년 이후까지 유효한 키를 요구한다.

만들고 나서 확인:

```sh
keytool -list -v -keystore ~/oing-keys/oing-upload.jks -alias oing-upload
```

## 2. 빌드가 키를 찾게 하기

두 방법 중 하나. **둘 다 저장소에 올라가지 않는다.**

**(a) 파일** — `android/keystore.properties.example`을 복사해서 채운다.

```sh
cp android/keystore.properties.example android/keystore.properties
```

```properties
storeFile=/Users/나/oing-keys/oing-upload.jks
storePassword=키스토어비밀번호
keyAlias=oing-upload
keyPassword=키비밀번호
```

**(b) 환경변수** — 비밀번호를 파일에도 두기 싫으면 이쪽.

```sh
export OING_KEYSTORE_FILE=~/oing-keys/oing-upload.jks
export OING_KEYSTORE_PASSWORD=...
export OING_KEY_ALIAS=oing-upload
export OING_KEY_PASSWORD=...
```

둘 다 없으면 릴리스 빌드는 **서명 없이** 나오고, 그 사실을 빌드 로그가 알려준다.

## 3. AAB 만들기

```sh
npm install          # 처음 한 번
npm run android:aab
```

`android:aab`는 세 가지를 순서대로 한다: 웹 빌드(`dist/client`) → `cap sync`로
앱 안에 복사 → `gradlew bundleRelease`.

결과물:

```
android/app/build/outputs/bundle/release/app-release.aab
```

서명이 제대로 붙었는지 확인:

```sh
# 어떤 키로 서명됐는지 (SHA-256 지문이 1번에서 본 것과 같아야 한다)
keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab
```

APK로 폰에 바로 꽂아 보고 싶으면 `npm run android:apk`
(`android/app/build/outputs/apk/release/app-release.apk`).

## 4. 원스토어 — "Java Keystore의 키 내보내기 및 업로드"

원스토어 개발자센터에서 앱 서명 방식으로 이 항목을 고르면, 화면이 **PEPK 도구
(`pepk.jar`)와 암호화 공개키**를 준다. 그 두 개를 받아서 키를 암호화한 ZIP을
만들고, 그 ZIP을 다시 올리는 흐름이다.

```sh
java -jar pepk.jar \
  --keystore=~/oing-keys/oing-upload.jks \
  --alias=oing-upload \
  --output=~/oing-keys/oing-upload-pepk.zip \
  --include-cert \
  --rsa-aes-encryption \
  --encryption-key-path=~/oing-keys/encryption_public_key.pem
```

- `--encryption-key-path`에는 콘솔이 준 PEM 파일 경로를 넣는다. 콘솔이 PEM 대신
  긴 16진수 문자열을 준다면 `--encryption-key-path` 자리에
  `--encryptionkey=<그 문자열>`을 쓴다. **키는 반드시 콘솔에서 받은 것을 쓴다.**
- 실행하면 키스토어/키 비밀번호를 물어본다.
- 나온 `oing-upload-pepk.zip`을 콘솔에 업로드한다.
- 그다음 앱 등록 화면에서 `app-release.aab`를 올린다.

## 5. 나중에 구글 플레이에도 올릴 때

**같은 키스토어를 그대로 쓴다.** 플레이 콘솔에서 앱을 만들 때 Play 앱 서명이
기본으로 켜지는데, 이때 이 키는 *업로드 키* 역할을 한다. 처음 등록할 때
"기존 앱 서명 키 사용"으로 같은 PEPK ZIP을 올리면 두 스토어가 같은 서명 키를
쓰게 된다. 어느 쪽이든 **이 키스토어 하나만 잃어버리지 않으면 된다.**

## 6. 버전 올릴 때

`android/app/build.gradle`의 `versionCode`를 1씩 올리고(스토어는 같은 숫자를
두 번 받지 않는다) `versionName`을 사람이 읽을 버전으로 고친 뒤 다시 빌드한다.

## 7. 절대 커밋하지 않는 것들

`.gitignore`가 이미 막고 있고, `tests/android-signing.test.mjs`가 그 사실을
테스트로 붙잡고 있다.

- `*.jks`, `*.keystore`, `*.p12`
- `android/keystore.properties`
- `android/local.properties`
- `*.aab`, `*.apk`, PEPK ZIP

## 8. CI에서 뽑기 (권장)

`.github/workflows/android-release.yml`이 `main` 푸시와 수동 실행에서 AAB/APK를
만들고 `android-build-<번호>` 태그의 프리릴리스로 올린다. 로컬에 안드로이드
SDK가 없어도 여기서 결과물을 받을 수 있다.

저장소 Settings > Secrets and variables > Actions 에 아래 넷을 넣으면 CI가
서명까지 해서 바로 올릴 수 있는 AAB를 낸다. 넷이 없으면 서명 없는 결과물이
나오고, 그건 그것대로 조립이 되는지 확인하는 용도로 쓸 수 있다.

| 시크릿 | 값 |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 oing-upload.jks` 출력 전체 |
| `ANDROID_KEYSTORE_PASSWORD` | 키스토어 비밀번호 |
| `ANDROID_KEY_ALIAS` | `oing-upload` |
| `ANDROID_KEY_PASSWORD` | 키 비밀번호 |

이미 만들어진 AAB를 손으로 서명하고 싶다면 (번들은 apksigner가 아니라
jarsigner로 서명한다):

```sh
jarsigner -keystore oing-upload.jks -digestalg SHA-256 -sigalg SHA256withRSA \
  app-release.aab oing-upload
keytool -printcert -jarfile app-release.aab      # 지문 확인
```
