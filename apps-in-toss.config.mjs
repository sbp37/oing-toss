import { defineConfig } from '@apps-in-toss/web-framework/config';

// 앱인토스에 올릴 꾸러미(.ait)를 만드는 설정.
//
// webBundleDir은 hosting/build-static.mjs가 만드는 배포본을 그대로 가리킨다.
// 원스토어에 올린 안드로이드 앱과 같은 파일을 담게 해서, 두 곳에 서로 다른
// 빌드가 나가는 일이 없게 한다.
//
// 만드는 법:
//   npm run build          dist/client 생성
//   npx ait build          oing-game.ait 생성
export default defineConfig({
  appName: 'oing-game',
  brand: {
    // 게임의 하늘색. 홈 화면과 매니페스트 테마색과 같은 값이다.
    primaryColor: '#8edcf1',
  },
  // 이 게임은 권한이 필요한 기기 기능을 쓰지 않는다. 진동은 토스의
  // Device.triggerHaptic으로 울리는데, 이건 권한 목록에 없는 기능이다.
  permissions: [],
  // 손가락으로 타일을 끄는 게임이라, 웹뷰가 당김을 새로고침이나 튕김으로
  // 가로채면 드래그가 끊긴다. CSS overscroll-behavior만으로는 네이티브
  // 웹뷰의 몸짓을 못 막아서 여기서도 꺼 둔다.
  webView: {
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: 'never',
  },
  webBundleDir: 'dist/client',
});
