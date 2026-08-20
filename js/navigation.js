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

function pauseOverlayOpen() {
  const overlay = document.querySelector('#pause-overlay');
  return Boolean(overlay) && !overlay.hasAttribute('hidden');
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

    if (pauseOverlayOpen()) {
      mark(activeScreenName());
      // Resume refuses unless a run is actually paused; the overlay also shows
      // for other reasons, and closing it then is the honest response.
      if (game.state?.running && game.state?.paused) game.resume();
      else game.ui.setOverlay('pause-overlay', false);
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
