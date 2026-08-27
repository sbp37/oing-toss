import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CHALLENGE_MAX_SCORE,
  CHALLENGE_PARAM,
  parseChallengeScore,
  withChallengeParam,
} from '../js/data.js';

// 도전장은 링크 안의 숫자 하나가 전부다. 서버도 계정도 없으니 그 숫자를
// 읽고 쓰는 두 함수가 이 기능의 뼈대이고, 여기가 틀리면 조용히 아무 일도
// 일어나지 않는다 - 오류도 안 나고 그냥 도전장이 없는 것처럼 군다.
// 그래서 눈으로는 못 잡는다.

test('도전 점수는 스킴 주소와 웹 주소 양쪽에서 읽힌다', () => {
  // 토스는 진입 스킴 주소를 그대로 돌려준다. URL 객체로는 못 읽는 모양이라
  // 질의 부분만 떼어 넘기는데, 그 처리가 두 형태 모두에서 돌아야 한다.
  assert.equal(parseChallengeScore('intoss://oing-game?vs=8235'), 8235);
  assert.equal(parseChallengeScore('intoss://oing-game?referrer=x&vs=1200'), 1200);
  assert.equal(parseChallengeScore('https://sbp37.github.io/oing-toss/?vs=640'), 640);
  assert.equal(parseChallengeScore('?vs=7'), 7);
});

test('도전장이 없거나 말이 안 되면 0이다', () => {
  // 0은 "도전장 없음"이고, 부르는 쪽은 평소대로 돈다. 링크에 질의를 못 실어
  // 보내는 경우(토스가 떼어버리는 경우)가 여기로 떨어지므로, 이 값이 공유를
  // 망가뜨리지 않는다는 것이 이 기능의 안전장치다.
  assert.equal(parseChallengeScore(''), 0);
  assert.equal(parseChallengeScore('intoss://oing-game'), 0);
  assert.equal(parseChallengeScore('intoss://oing-game?other=3'), 0);
  assert.equal(parseChallengeScore('?vs=abc'), 0);
  assert.equal(parseChallengeScore('?vs=0'), 0);
  assert.equal(parseChallengeScore('?vs=-500'), 0);
  // 주소를 손으로 고쳐 넣은 값은 거른다. 사람이 낼 수 있는 점수가 아니다.
  assert.equal(parseChallengeScore(`?vs=${CHALLENGE_MAX_SCORE + 1}`), 0);
  assert.equal(parseChallengeScore(null), 0);
});

test('딥링크에 점수를 붙일 때 기존 질의를 밟지 않는다', () => {
  assert.equal(withChallengeParam('intoss://oing-game', 8235), 'intoss://oing-game?vs=8235');
  // getSchemeUri가 referrer를 달고 오는 경우가 있어서 &로 이어야 한다.
  assert.equal(
    withChallengeParam('intoss://oing-game?referrer=abc', 8235),
    'intoss://oing-game?referrer=abc&vs=8235',
  );
  // 점수가 없으면 주소를 건드리지 않는다 - 예전과 똑같은 링크가 나가야
  // 도전장을 못 실어도 공유 자체는 그대로 된다.
  assert.equal(withChallengeParam('intoss://oing-game', 0), 'intoss://oing-game');
  assert.equal(withChallengeParam('', 8235), '');
});

test('붙인 것을 그대로 다시 읽어낸다', () => {
  for (const score of [1, 640, 8235, 123456, CHALLENGE_MAX_SCORE]) {
    assert.equal(parseChallengeScore(withChallengeParam('intoss://oing-game', score)), score);
  }
});

test('공유 글귀는 되받아친 판에서만 말이 달라진다', async () => {
  const { buildShareText } = await import('../js/adapters.js');
  const plain = buildShareText({ score: 8235, maxCombo: 12, round: 7, classic: {} });
  assert.match(plain, /8,235점/);
  assert.match(plain, /이겨보라냥/);
  assert.ok(!plain.includes('넘었다냥'), '평범한 판이 되받아치기 글귀를 쓴다');

  // 진 사람이 다시 던지는 자리다. "이겼다"가 앞에 와야 다음 한 판이 걸린다.
  const rematch = buildShareText({ score: 9100, maxCombo: 14, round: 8, classic: {}, beatScore: 8235 });
  assert.match(rematch, /8,235점 넘었다냥/);
  assert.match(rematch, /9,100점/);
});

test('판정은 같은 점수를 이긴 것으로 본다', async () => {
  // 정수 점수에서 딱 맞추는 일은 드물고, 그 드문 순간에 "졌다"고 말하는 건
  // 야박하다. 이 한 줄이 뒤집히면 아무도 눈치채지 못한 채 기분만 나빠진다.
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const { judgeChallenge, clearChallengeIfWon } = await import('../js/challenge.js');
  const { storageAdapter } = await import('../js/adapters.js');

  assert.equal(judgeChallenge(1000), null, '도전장이 없는데 판정이 나온다');

  storageAdapter.saveChallengeScore(8235);
  assert.deepEqual(
    { ...judgeChallenge(5000) },
    { target: 8235, score: 5000, won: false, diff: 3235 },
  );
  assert.equal(judgeChallenge(8235).won, true, '동점이 패배로 잡힌다');

  // 못 넘은 판은 도전장을 남긴다 - 다시 도전할 사람에게서 목표를 뺏으면 안 된다.
  clearChallengeIfWon(5000);
  assert.equal(storageAdapter.getChallengeScore(), 8235);

  // 넘은 판은 지운다. 한 번 이긴 상대가 계속 붙어 있으면 잔상일 뿐이다.
  clearChallengeIfWon(9100);
  assert.equal(storageAdapter.getChallengeScore(), 0);
  assert.equal(judgeChallenge(100), null);

  delete globalThis.localStorage;
});

test('도전장 표면이 마크업과 다리에 실제로 들어 있다', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  // 띠는 시작 버튼 위여야 한다. 넘을 점수가 눌러야 할 버튼에서 멀면
  // "이걸 하러 왔다"가 첫 화면에서 안 읽힌다.
  const banner = html.indexOf('id="home-challenge"');
  const start = html.indexOf('id="start-button"');
  assert.ok(banner > 0 && start > banner, '도전장 띠가 시작 버튼 위에 없다');
  assert.match(html, /id="result-challenge"/);

  // 다리가 진입 주소를 돌려주지 않으면 토스 안에서는 도전장이 영영 안 온다.
  // 번들은 구운 결과물이라 소스만 고치고 굽지 않는 실수가 나오기 쉽다.
  const bundle = await readFile(new URL('../js/vendor/toss-game-center-v1.js', import.meta.url), 'utf8');
  assert.match(bundle, /getInitialSchemeUrl/, '번들에 진입 주소 읽기가 없다 - 다시 구워야 한다');
  assert.equal(CHALLENGE_PARAM, 'vs');
});

test('앱으로 묶인 빌드는 자기 주소 대신 공개 주소를 공유한다', async () => {
  // 구글플레이 빌드는 웹뷰가 자기 파일을 https://localhost/에서 띄운다.
  // 지금 주소를 그대로 공유하면 "https://localhost/?vs=8235"가 나가고,
  // 받는 사람에게는 죽은 링크다 - 도전장이 통째로 끊긴다. 스토어에 올리는
  // 바로 그 빌드에서 바이럴 루프가 죽는 것이라 눈으로는 절대 안 잡힌다
  // (개발자 폰에서는 localhost가 자기 자신이라 열리기도 한다).
  const adapters = await readFile(new URL('../js/adapters.js', import.meta.url), 'utf8');
  assert.match(adapters, /function isPackagedApp/, '앱으로 묶인 빌드를 가려내지 않는다');
  assert.match(adapters, /hostname[\s\S]{0,120}localhost/, 'localhost 판정이 없다');
  assert.match(
    adapters,
    /isPackagedApp\(\)\s*\?\s*PUBLIC_SITE_URL/,
    '앱 빌드에서 공개 주소로 안 바꾼다',
  );
});
