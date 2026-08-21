// 카드 그림이 게임을 느리게 만들지 않는지 지킨다.
//
// 그림은 나중에 한 장씩 들어온다. 그때 규격을 넘긴 파일이 섞여 들어와도
// 화면은 멀쩡해 보이고, 느려지는 것은 기록 창을 여는 사람뿐이라 늦게 발견된다.
// 그래서 용량과 "어디서 받는가"를 테스트로 붙잡아 둔다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OING_CARDS, oingCardArtUrl, oingCardThumbUrl } from '../js/data.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(new URL(path, new URL('..', import.meta.url)), 'utf8');

// 챕터 그림이 148~188KB, 그 썸네일이 10~12KB다. 카드도 같은 자리에 산다.
const FULL_BUDGET = 180 * 1024;
const THUMB_BUDGET = 14 * 1024;
// 기록 창을 열면 썸네일이 한꺼번에 뜬다. 이 합계가 그때 받는 양이다.
const THUMB_TOTAL_BUDGET = 150 * 1024;

test('격자에는 썸네일을, 크게 볼 때만 원본을 쓴다', () => {
  const card = { ...OING_CARDS[0], hasArt: true };
  assert.match(oingCardThumbUrl(card), /^assets\/cards\/thumbs\//);
  assert.match(oingCardArtUrl(card), /^assets\/cards\/[^/]+\.webp$/);
  assert.notEqual(oingCardThumbUrl(card), oingCardArtUrl(card));
});

test('그림이 없는 카드는 아무 주소도 내주지 않는다', () => {
  for (const card of OING_CARDS.filter((entry) => !entry.hasArt)) {
    assert.equal(oingCardArtUrl(card), null, `${card.key}: 없는 그림을 요청하려 한다`);
    assert.equal(oingCardThumbUrl(card), null);
  }
});

test('카드는 첫 화면에서 받지 않는다', () => {
  // 시작 화면 속도가 걸린 문제다. 카드는 기록 창을 열거나 카드를 눌러야 온다.
  assert.doesNotMatch(read('js/preload.js'), /assets\/cards/, 'preload가 카드를 미리 받는다');
  assert.doesNotMatch(read('sw.js'), /assets\/cards/, '서비스워커 셸에 카드가 들어 있다');
});

test('들어온 카드 그림은 용량 예산 안에 있다', () => {
  const fullDir = new URL('assets/cards/', new URL('..', import.meta.url));
  if (!existsSync(fullDir)) return;   // 아직 그림이 없으면 지킬 것도 없다

  const files = readdirSync(fullDir).filter((name) => name.endsWith('.webp'));
  for (const name of files) {
    const size = statSync(new URL(name, fullDir)).size;
    assert.ok(size <= FULL_BUDGET,
      `assets/cards/${name}이 ${Math.round(size / 1024)}KB다 (예산 ${FULL_BUDGET / 1024}KB)`);
  }

  const thumbDir = new URL('assets/cards/thumbs/', new URL('..', import.meta.url));
  if (!existsSync(thumbDir)) return;
  const thumbs = readdirSync(thumbDir).filter((name) => name.endsWith('.webp'));
  let total = 0;
  for (const name of thumbs) {
    const size = statSync(new URL(name, thumbDir)).size;
    total += size;
    assert.ok(size <= THUMB_BUDGET,
      `썸네일 ${name}이 ${Math.round(size / 1024)}KB다 (예산 ${THUMB_BUDGET / 1024}KB)`);
  }
  assert.ok(total <= THUMB_TOTAL_BUDGET,
    `썸네일 합계가 ${Math.round(total / 1024)}KB다 - 기록 창을 열 때 이만큼 받는다`);
});
