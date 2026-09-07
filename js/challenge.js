// 도전장.
//
// 친구가 공유한 링크에 점수가 실려 온다. 그 링크로 들어온 사람은 "넘어야 할
// 점수"를 들고 게임을 시작하고, 넘으면 되받아칠 링크를 만든다.
//
// 서버도 계정도 없다. 숫자가 주소 안에 들어 있으니 어디에도 저장할 데가
// 없다 - 자체 랭킹을 만들지 않는다는 원칙 그대로다. 기기에 잠깐 적어두는
// 것뿐이고, 그건 "링크를 받고 나중에 켠 사람"을 위한 것이다.
//
// 이 파일은 DOM을 모른다. 읽고, 판정하고, 지운다. 화면은 ui.js가 그린다.

import { parseChallengeScore } from './data.js';
import { storageAdapter } from './adapters.js';

// 이번 실행에서 도전장을 링크로 새로 받았는지. 홈에서 "친구가 도전장을
// 보냈다냥!" 한 번만 띄우려고 들고 있다 - 켤 때마다 말을 거는 건 잔소리다.
let arrivedThisSession = false;

// 링크를 타고 들어왔는지 본다. 토스 안에서는 진입 스킴 주소를, 웹에서는
// 지금 주소를 읽는다. 새 도전장이 있으면 기기에 적고 그 값을 돌려준다.
//
// 이미 들고 있던 도전장이 있으면 새 것으로 덮는다. 가장 최근에 받은 도전장이
// 지금 하려는 그 도전장이기 때문이다.
export function receiveChallenge({ schemeUrl = '', search = '' } = {}) {
  const incoming = parseChallengeScore(schemeUrl) || parseChallengeScore(search);
  if (incoming > 0) {
    arrivedThisSession = true;
    storageAdapter.saveChallengeScore(incoming);
    return incoming;
  }
  return storageAdapter.getChallengeScore();
}

export function challengeScore() {
  return storageAdapter.getChallengeScore();
}

export function isFreshChallenge() {
  return arrivedThisSession;
}

// 홈 안내를 한 번 쓰고 나면 내린다.
export function markChallengeSeen() {
  arrivedThisSession = false;
}

// 판이 끝났을 때의 판정. 도전장이 없으면 null이라 부르는 쪽이 그냥 넘어간다.
//
// 같은 점수는 이긴 것으로 본다. 소수점도 없는 정수 점수에서 딱 맞추는 일은
// 드물고, 그 드문 순간에 "졌다"고 말하는 건 야박하다.
export function judgeChallenge(score) {
  const target = storageAdapter.getChallengeScore();
  if (target <= 0) return null;
  const mine = Math.max(0, Math.round(Number(score) || 0));
  return Object.freeze({
    target,
    score: mine,
    won: mine >= target,
    diff: Math.max(0, target - mine),
  });
}

// 넘었으면 도전장을 지운다. 다음 판부터는 다시 자기 기록과 싸운다 - 한 번
// 이긴 상대가 계속 화면에 붙어 있으면 그때부터는 목표가 아니라 잔상이다.
export function clearChallengeIfWon(score) {
  const verdict = judgeChallenge(score);
  if (verdict?.won) {
    storageAdapter.clearChallengeScore();
    arrivedThisSession = false;
  }
  return verdict;
}

// 시험에서 상태를 되돌리기 위한 것. 게임 코드는 부르지 않는다.
export function __resetChallengeForTest() {
  arrivedThisSession = false;
  storageAdapter.clearChallengeScore();
}
