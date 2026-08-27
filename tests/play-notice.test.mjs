import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

// 보드 위에서 일어난 일을 사람이 알아채는가. 실기기 제보 세 건이 전부
// 여기였다: 프리즈가 걸린 줄도 모르겠다, 판 넘어가는 안내가 안 보인다,
// 게임이 끝나기도 전에 광고부터 뜬다.

test('a freeze plants a banner in the middle of the board', async () => {
  const [html, ui, game, css] = await Promise.all([
    read('index.html'), read('js/ui.js'), read('js/game.js'), read('css/claude-polish.css'),
  ]);

  // 얼음 시계 아이콘과 얇은 시간 게이지만으로는 아무도 못 알아챘다.
  assert.match(html, /id="play-center-notice"/);
  assert.match(ui, /showCenterNotice\(/);
  assert.match(game, /showCenterNotice\(`시간 \$\{Math\.round\(freezeSeconds\)\}초 멈춤!`/);
  // 눈이 이미 가 있는 자리는 보드다 - 보드 한가운데여야 한다.
  assert.match(css, /#play-screen \.play-center-notice \{[\s\S]*?left: 50%;[\s\S]*?top: 50%;/);
});

test('board-change notices are mint, not cream on a cream board', async () => {
  const [polish, layout] = await Promise.all([
    read('css/claude-polish.css'), read('css/play-layout-v1.css'),
  ]);

  // 바탕이 되는 규칙은 크림색이다. 그 위에 크림 알약이 뜨니 안 보였다.
  assert.match(layout, /\.play-ui-v4 \.board-entry \{[\s\S]*?background: rgba\(255, 247, 226/);
  // 마지막에 실리는 이 파일이 민트로 덮어써야 한다. ID를 써야 클래스
  // 두 개짜리 규칙을 이긴다. 색은 홈 규칙 카드의 4/6 타일과 같은 밝은
  // 민트다 - 진한 민트는 판 위에서 너무 세게 눌렀다.
  assert.match(polish, /#play-screen \.board-entry \{[\s\S]*?background: linear-gradient\(180deg, #eefffa, #cdf3e9\)/);
  assert.match(polish, /#play-screen \.play-center-notice \{[\s\S]*?background: linear-gradient\(180deg, #eefffa, #cdf3e9\)/);
});

test('the speech bubble keeps its own art - no painted rectangle over it', async () => {
  const [polish, html] = await Promise.all([read('css/claude-polish.css'), read('index.html')]);

  // 플레이 화면의 말풍선은 글자에 배경이 없다. 모양은 뒤에 깔린 그림이
  // 만든다. 배경색을 주면 둥근 그림 위에 각진 사각형이 덧그려진다.
  assert.match(html, /speech-bubble-wide-v4\.webp/);
  assert.doesNotMatch(polish, /\.cat-message\[data-tone="classicBoard"\]/);
  assert.doesNotMatch(polish, /\.cat-message\[data-tone="classicRule"\]/);
});

test('the run visibly ends before the ad offer arrives', async () => {
  const [game, ui, html] = await Promise.all([read('js/game.js'), read('js/ui.js'), read('index.html')]);

  const offer = game.slice(game.indexOf('async maybeOfferAdContinue'), game.indexOf('async openContactsInviteReward'));
  const stampAt = offer.indexOf('stampTimeUp');
  const askAt = offer.indexOf('showContinueOffer');
  assert.ok(stampAt > 0, '제안 경로에 종료 도장이 없다');
  assert.ok(askAt > 0);
  // 순서가 뒤집히면 "게임이 끝나기도 전에 광고부터"가 그대로 돌아온다.
  assert.ok(stampAt < askAt, '광고 제안이 종료 연출보다 먼저 온다');
  // 소리도 제안 전에 나야 끝난 줄 안다.
  assert.ok(offer.indexOf('playGameOverSound') < askAt, '종료 소리가 제안 뒤로 밀렸다');

  // 도장에는 이번 판 점수가 실린다 - 그게 이 판의 결말이다.
  assert.match(offer, /stampTimeUp\(this\.state\.score\)/);
  assert.match(html, /id="time-up-score"/);
  assert.match(ui, /async stampTimeUp\(/);
});

test('TIME UP is not stamped twice on the same run', async () => {
  const [game, ui] = await Promise.all([read('js/game.js'), read('js/ui.js')]);

  // 제안 전에 찍었으면 결과로 넘어갈 때는 건너뛴다. 같은 TIME UP을 두 번
  // 보면 끝이 두 번 나는 것처럼 어색하다.
  assert.match(ui, /async animateGameEnd\(\{ answers = \[\], stamped = false \} = \{\}\)/);
  // 이미 찍었으면 쓸어내는 연출까지 통째로 건너뛰고 결과로 간다 - 그
  // 연출이 남아 있으면 '결과 보기'를 눌러도 끝이 한 번 더 나는 느낌이다.
  assert.match(ui, /if \(stamped\) \{[\s\S]{0,200}?return;/);
  assert.match(game, /animateGameEnd\(\{ answers: endAnswers, stamped \}\)/);
  // 되살아나면 기억을 지운다 - 다음 종료는 처음부터 다시 보여줘야 한다.
  assert.ok(game.split('this.adStampedTimeUp = false;').length - 1 >= 3);
});

test('a rewarded ad that never appears says so instead of going quiet', async () => {
  const [ads, entry, bundle, game] = await Promise.all([
    read('js/ads.js'), read('tools/toss-game-center-entry.mjs'),
    read('js/vendor/toss-game-center-v1.js'), read('js/game.js'),
  ]);

  // 광고를 못 띄운 것(failedToShow)은 우리 사정이라 알려줘야 한다 - 조용히
  // 결과로 보내면 "버튼이 먹통"으로 읽힌다(실기기 제보).
  //
  // 예전에는 "보다가 중간에 닫은 것은 본인 선택이라 아무 말도 필요 없다"고
  // 보고 그 경우를 조용히 뒀다. 판단을 바꿨다. 우리는 중간에 닫은 사람과
  // 보상 신호가 유실된 사람을 구별할 방법이 없고, 뒤쪽 사람에게 침묵은
  // 그냥 먹튀다. 중간에 닫은 사람에게도 "그래서 못 받았다"는 확인이라
  // 잡음이 아니다. 그래서 이제 둘 다 알린다(문구만 다르다).
  assert.match(entry, /else if \(event\.type === 'failedToShow'\) \{[\s\S]{0,80}failed = true/);
  assert.match(entry, /onError: \(\) => \{ failed = true; settle\('error'\); \}/);

  // 어떤 이벤트도 안 오면 약속이 영원히 안 끝나고, 그 위에서 기다리던
  // 게임이 통째로 굳는다(이어하기는 finishing, 도움팩은 paused). 토스
  // 공식 문서에도 dismissed가 오지 않은 안드로이드 버전이 적혀 있다.
  assert.match(entry, /LOAD_TIMEOUT_MS = \d+/);
  assert.match(entry, /SHOW_TIMEOUT_MS = \d+/);
  assert.match(entry, /function withDeadline\(ms, run\)/);
  assert.match(entry, /timer = setTimeout\(\(\) => settle\('timeout'\), ms\)/);
  // 시간 제한에 걸렸어도 보상 이벤트를 이미 봤다면 지급한다 - 끝까지 본
  // 사람에게서 닫힘 이벤트만 유실된 경우다.
  assert.match(entry, /if \(how === 'timeout' && !rewarded\) failed = true;/);
  assert.ok(bundle.includes('failed'), '다리를 다시 굽지 않았다');
  assert.match(ads, /shown: !result\?\.failed/);
  assert.match(game, /shown \? '광고 보상을 못 받았다냥[\s\S]{0,80}'광고를 못 불러왔다냥/);

  // 묵은 광고는 띄우기 직전에 SDK에게 다시 물어본다. 다만 다시 못 불러와도
  // 포기하지 않고 띄워는 본다 - isRewardedAdLoaded가 기기에 따라 실제와
  // 다르게 false를 줄 수 있는데, 거기서 포기하면 예전 같으면 떴을 광고까지
  // 안 뜨게 된다.
  assert.match(ads, /isRewardedAdLoaded\(adGroupId\)/);
  assert.match(ads, /if \(reloaded\) loadedKinds\.add\(kind\);/);
  const stale = ads.slice(ads.indexOf('if (!live) {'), ads.indexOf('const result = await module.showRewardedAd'));
  assert.ok(!stale.includes('return'), '다시 못 불러왔다고 띄워보지도 않고 포기한다');
});
