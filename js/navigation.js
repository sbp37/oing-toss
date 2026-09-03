// Hardware back on Android.
//
// In a browser tab the back button leaves the page and nobody minds. Wrapped as
// an app - a TWA on the store, a webview inside another app - the same press
// closes the whole thing, and a player who taps it mid-run loses the run with
// no warning. Nothing here changed how the game navigates; it just gives the
// gesture somewhere to go.
//
// The rule, one press at a time:
//   paused        -> resume
//   playing       -> pause (the run is never thrown away by a back press)
//   result        -> home
//   home          -> arm, and only the second press within a couple of seconds
//                    actually leaves
//
// The mechanics are the usual history trick: keep exactly one spare entry on
// the stack, consume it on popstate, put it back. `suppress` guards the moments
// we move the stack ourselves so those never read as a user press.

const EXIT_CONFIRM_MS = 2200;

function activeScreenName() {
  const screens = [...document.querySelectorAll('.screen')];
  const front = screens.find(
    (screen) => screen.classList.contains('is-active') && !screen.classList.contains('is-behind-sheet'),
  );
  return front?.dataset.screen || 'home';
}

// 판을 멈춰 세우는 오버레이는 하나가 아니다. 일시정지에서 '방법'을 열면
// pause-overlay는 닫히고 help-overlay가 대신 뜨는데, 예전에는 여기서
// pause-overlay만 봐서 그 상태의 뒤로가기가 아무 일도 하지 않았다.
// 그러면 paused가 true로 굳어 보드가 영영 안 눌린다.
const PAUSE_FAMILY = ['#pause-overlay', '#help-overlay'];

// 뒤로가기로 닫아야 하는 나머지 오버레이들.
//
// 실측으로 잡은 문제: 홈에서 '내 기록'이나 '설정'을 열고 뒤로가기를 누르면
// 시트가 닫히는 대신 "한 번 더 누르면 나가요"가 떴다. 한 번 더 누르면 시트가
// 열린 채로 앱이 통째로 꺼진다. 안드로이드에서 뒤로가기의 첫 뜻은 언제나
// "지금 덮여 있는 것을 걷어라"인데, 이 목록에 없는 오버레이는 그 뜻을
// 받아줄 곳이 없었다.
//
// 숨기는 대신 그 화면의 닫기 버튼을 누른다. 창마다 닫으면서 해야 할 일이
// 따로 있기 때문이다 - 결과 화면에서 연 기록 시트는 결과 시트를 다시
// 세워야 하고, 광고 제안 창은 기다리고 있는 약속(Promise)을 '거절'로
// 매듭지어야 한다. DOM만 감추면 도움팩 제안은 영영 끝나지 않는다.
//
// 순서는 위에 덮인 것부터다.
const DISMISSIBLE = [
  { overlay: '#help-pack-overlay', button: '#help-pack-decline-button' },
  { overlay: '#continue-overlay', button: '#continue-decline-button' },
  { overlay: '#chapter-viewer', button: '#chapter-viewer-close' },
  { overlay: '#garden-overlay', button: '#garden-close' },
  { overlay: '#ranking-overlay', button: '#ranking-close' },
  { overlay: '#settings-overlay', button: '#settings-close' },
];

function topDismissible() {
  for (const entry of DISMISSIBLE) {
    const overlay = document.querySelector(entry.overlay);
    if (overlay && !overlay.hasAttribute('hidden')) return entry;
  }
  return null;
}

export function pauseFamilyOpen() {
  return PAUSE_FAMILY.some((selector) => {
    const overlay = document.querySelector(selector);
    return Boolean(overlay) && !overlay.hasAttribute('hidden');
  });
}

export function installBackNavigation(game) {
  if (!game?.ui || typeof window === 'undefined' || !window.history?.pushState) return;

  let suppress = false;
  let exitArmedAt = 0;

  const mark = (name) => {
    suppress = true;
    try {
      window.history.pushState({ oing: name }, '');
    } finally {
      suppress = false;
    }
  };

  window.history.replaceState({ oing: activeScreenName() }, '');
  mark(activeScreenName());

  // Every screen change keeps the spare entry pointing at where we are now, so
  // the next press always has exactly one hop to consume.
  const showScreen = game.ui.showScreen.bind(game.ui);
  game.ui.showScreen = (name, options) => {
    showScreen(name, options);
    if (!suppress) mark(name);
  };

  window.addEventListener('popstate', () => {
    if (suppress) return;

    // 덮여 있는 것이 있으면 그것부터 걷는다. 일시정지 계열보다 먼저 보는
    // 이유는, 일시정지에서 연 '방법'처럼 이쪽이 늘 더 위에 있기 때문이다.
    const dismissible = topDismissible();
    if (dismissible) {
      mark(activeScreenName());
      const button = document.querySelector(dismissible.button);
      if (button) button.click();
      else game.ui.setOverlay(dismissible.overlay.slice(1), false);
      return;
    }

    if (pauseFamilyOpen()) {
      mark(activeScreenName());
      // Resume refuses unless a run is actually paused; the overlay also shows
      // for other reasons, and closing it then is the honest response.
      if (game.state?.running && game.state?.paused) game.resume();
      else PAUSE_FAMILY.forEach((selector) => game.ui.setOverlay(selector.slice(1), false));
      return;
    }

    const screen = activeScreenName();

    if (screen === 'play') {
      mark(screen);
      if (game.state?.running && !game.state?.paused) game.pause('back');
      return;
    }

    if (screen === 'result') {
      game.goHome();
      return;
    }

    if (Date.now() - exitArmedAt < EXIT_CONFIRM_MS) {
      // Let the press through: the entry we just consumed was the spare, so the
      // stack is already back at the page the app opened on.
      window.history.back();
      return;
    }

    exitArmedAt = Date.now();
    mark(screen);
    game.ui.toast?.('한 번 더 누르면 나가요');
  });
}
