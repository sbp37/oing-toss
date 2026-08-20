// 안드로이드 패키징이 지켜야 하는 두 가지를 붙잡는 테스트.
//
// 하나, 서명 비밀번호가 저장소로 새어나가지 않을 것. 키스토어와 비밀번호는
// 한 번 공개되면 회수할 방법이 없고, 업로드 키가 바뀌면 스토어에서 같은 앱을
// 갱신할 수 없게 된다. 그래서 gitignore와 build.gradle 양쪽을 확인한다.
//
// 둘, 패키지 식별자가 흔들리지 않을 것. applicationId는 스토어에 한 번 올리면
// 영원히 못 바꾸는 값이라 오타 하나가 앱을 새로 등록해야 하는 사고가 된다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(new URL(path, new URL('..', import.meta.url)), 'utf8');

test('서명 관련 파일은 전부 gitignore에 있다', () => {
  const ignored = read('.gitignore');
  for (const pattern of ['*.jks', '*.keystore', 'android/keystore.properties', 'android/local.properties']) {
    assert.ok(
      ignored.split('\n').some((line) => line.trim() === pattern),
      `${pattern} 이(가) .gitignore에 없다`,
    );
  }
});

test('build.gradle은 비밀번호를 파일이나 환경변수에서만 읽는다', () => {
  const gradle = read('android/app/build.gradle');
  // 값이 리터럴로 박힌 형태: storePassword "..." / keyPassword '...'
  const hardcoded = /(storePassword|keyPassword|keyAlias)\s*[= ]\s*["'][^"']+["']/.exec(gradle);
  assert.equal(hardcoded, null, `비밀번호가 코드에 박혀 있다: ${hardcoded?.[0]}`);
  assert.match(gradle, /rootProject\.file\("keystore\.properties"\)/);
  assert.match(gradle, /System\.getenv\(env\)/);
  // 서명 정보가 없으면 서명 설정을 아예 만들지 않아야 한다.
  assert.match(gradle, /if \(hasReleaseSigning\)/);
});

test('패키지 식별자와 앱 이름이 스토어 등록값과 일치한다', () => {
  const capacitor = JSON.parse(read('capacitor.config.json'));
  assert.equal(capacitor.appId, 'com.oinggame.app');
  assert.equal(capacitor.appName, '오잉게임');
  assert.equal(capacitor.webDir, 'dist/client');

  const gradle = read('android/app/build.gradle');
  assert.match(gradle, /applicationId "com\.oinggame\.app"/);
  assert.match(gradle, /namespace = "com\.oinggame\.app"/);

  const strings = read('android/app/src/main/res/values/strings.xml');
  assert.match(strings, /<string name="app_name">오잉게임<\/string>/);
  assert.match(strings, /<string name="package_name">com\.oinggame\.app<\/string>/);
});

test('세로 화면 게임이라 액티비티가 세로로 고정돼 있다', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:screenOrientation="portrait"/);
});

// navigator.vibrate는 이 권한이 없으면 웹뷰 안에서 조용히 실패한다. 예외도
// 안 나고 함수도 존재해서, 빠졌다는 걸 알아차릴 방법이 실기기에서 만져보는
// 것밖에 없다. 한 번 겪었으니 테스트로 붙잡아 둔다.
test('진동 피드백을 쓰므로 VIBRATE 권한이 선언돼 있다', () => {
  const usesVibrate = /navigator\.vibrate/.test(read('js/haptic.js'));
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.ok(usesVibrate, '진동 코드가 사라졌다면 이 테스트도 손봐야 한다');
  assert.match(manifest, /<uses-permission android:name="android\.permission\.VIBRATE" \/>/);
});

test('키스토어 예시 파일에는 실제 비밀번호가 없다', () => {
  const example = read('android/keystore.properties.example');
  assert.match(example, /^storePassword=\s*$/m);
  assert.match(example, /^keyPassword=\s*$/m);
});
