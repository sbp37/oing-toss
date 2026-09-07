import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CANDY_PER_FEED,
  CANDY_STARTER_MINIMUM,
  CANDY_MIN_PER_RUN,
  CANDY_MAX_PER_RUN,
  CANDY_FEED_MILESTONES,
  CANDY_HAPPY_POSES,
  MESSAGES,
  candyForRun,
  pickMessage,
} from '../js/data.js';

// 별사탕은 "한 판 = 간식 한 번"의 리듬이 전부다. 그 리듬은 두 숫자에만
// 걸려 있어서(한 판 수급량, 먹이기 값) 한쪽이 흔들리면 조용히 망가진다 -
// 첫 판(점수/120, 상한 60)이 그렇게 실기기에서 사탕 30개를 쌓았다.

test('a run pays about one feeding, never a stockpile', () => {
  for (const score of [0, 500, 3600, 6000, 12000, 99999]) {
    const earned = candyForRun(score);
    assert.ok(earned >= CANDY_MIN_PER_RUN, `${score}점이 최소치보다 적다`);
    assert.ok(earned <= CANDY_MAX_PER_RUN, `${score}점이 상한을 넘었다`);
  }

  // 못한 판은 한 번 먹이기에 모자라 다음 판까지 모으고, 잘한 판도 두 번은
  // 못 준다. 이 두 줄이 무너지면 사탕이 쌓이기만 하고 줄 이유가 사라진다.
  assert.ok(candyForRun(0) < CANDY_PER_FEED, '바닥 판이 곧바로 한 번치를 준다');
  assert.ok(candyForRun(999999) < CANDY_PER_FEED * 2, '한 판에 두 번치가 나온다');

  // 보통 판(6,000점 언저리)은 딱 한 번.
  assert.equal(candyForRun(6000), CANDY_PER_FEED);
});

test('the feeding lines are many enough not to repeat within a session', () => {
  const pool = MESSAGES.candyFeed;
  assert.ok(Array.isArray(pool));
  // 사람이 "또 같은 말이네"를 느끼는 건 서너 번째 반복부터다. 한 판에 한 번
  // 먹인다고 보면 하루 대여섯 번이니, 열다섯 개 아래로 내려가면 티가 난다.
  assert.ok(pool.length >= 15, `대사가 ${pool.length}개뿐이다`);
  assert.equal(new Set(pool).size, pool.length, '같은 대사가 두 번 들어 있다');

  // 직전 대사는 반드시 빠진다 - 연속 중복이 제일 눈에 띈다.
  for (const previous of pool) {
    for (let i = 0; i < 12; i += 1) {
      assert.notEqual(pickMessage('candyFeed', previous), previous);
    }
  }
});

test('the first feeding and the milestones get their own lines', () => {
  assert.ok(MESSAGES.candyFeedFirst.length >= 1);
  assert.ok(MESSAGES.candyFeedMilestone.length >= CANDY_FEED_MILESTONES.length - 1);
  assert.ok(MESSAGES.candyHowTo.length >= 1);
  // 특별한 자리의 말이 평소 말과 섞여 있으면 특별하지 않다.
  const ordinary = new Set(MESSAGES.candyFeed);
  for (const line of [...MESSAGES.candyFeedFirst, ...MESSAGES.candyFeedMilestone]) {
    assert.ok(!ordinary.has(line), `${line}이 평소 대사에도 있다`);
  }
});

test('feeding poses rotate through art that actually exists', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(CANDY_HAPPY_POSES.length >= 3, '포즈가 셋보다 적다');
  // 고양이 그림은 여섯 장뿐이고 fail은 이 자리에 못 쓴다. 없는 파일을
  // 가리키면 먹인 순간 고양이가 통째로 사라진다.
  for (const pose of CANDY_HAPPY_POSES) {
    assert.match(pose, /^assets\/characters\/cat-[a-z]+\.webp$/);
    assert.ok(!pose.includes('cat-fail'), '먹였는데 시무룩한 그림이 뜬다');
  }
  assert.match(html, /id="candy-heart"/);
});

test('the heart does not squat on the pseudo-element that draws the cat shadow', async () => {
  const polish = await readFile(new URL('../css/claude-polish.css', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../css/styles.css', import.meta.url), 'utf8');

  // styles.css의 .home-character-stage::after는 고양이 바닥 그림자이고
  // z-index:-1로 깔려 있다. 하트를 거기에 그리면 고양이 뒤로 숨어 한 번도
  // 보이지 않고, 대신 그 1.2초 동안 그림자가 사라진다. 실측으로 잡은 버그다.
  assert.match(styles, /\.home-character-stage::after[\s\S]{0,200}z-index:\s*-1/);
  assert.doesNotMatch(polish, /\.home-character-stage\.is-happy::after/);
  assert.match(polish, /\.candy-heart\s*\{[\s\S]*?z-index:\s*[1-9]/);

  // 이모지는 기기 폰트에 기대는데 우리 폰트는 서브셋이라 그 글자가 없다.
  assert.match(polish, /\.candy-heart[\s\S]*?background:\s*url\("\.\.\/assets\/decor\/heart\.webp"/);
});

test('the result sheet says where the candy came from', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../js/ui.js', import.meta.url), 'utf8');
  const game = await readFile(new URL('../js/game.js', import.meta.url), 'utf8');

  // 실기기 제보: "왜 사탕이 생긴 건지 모르겠다." 홈에서 숫자만 늘어나면
  // 그것이 판의 대가라는 걸 알 길이 없다. 결과창이 유일한 설명 자리다.
  assert.match(html, /id="result-candy-earned"/);
  assert.match(ui, /resultCandyEarned/);
  // 받은 개수와 총 개수를 함께. 총량이 보여야 "홈 가서 줘야지"가 생긴다.
  assert.match(ui, /별사탕 \+\$\{earned\} · 모은 사탕 \$\{total\}개/);
  assert.match(game, /this\.lastResultSummary\.candy = \{/);
  assert.match(game, /total: storageAdapter\.getCandy\(\)/);
});

test('the drag hint shows only to someone who has never fed the cat', async () => {
  const candy = await readFile(new URL('../js/candy.js', import.meta.url), 'utf8');
  // 안내는 한 번 먹이면 영영 닫힌다. 홈에 상시 안내를 얹으면 첫 화면이
  // 시끄러워지고, 하단은 이미 버튼과 고양이로 빡빡하다.
  assert.match(candy, /getFedCount\(\) <= 0/);
  assert.match(candy, /is-nudge/);
  assert.match(candy, /candyHowTo/);
  // 손이 닿는 순간 안내 동작은 멈춘다.
  assert.match(candy, /piece\.classList\.remove\('is-nudge'\)/);
});

test('feeding sounds like the cat pop, and the first feed explains itself', async () => {
  const candy = await readFile(new URL('../js/candy.js', import.meta.url), 'utf8');

  // 게임 안에서 고양이를 터뜨릴 때 나는 소리를 그대로 쓴다. 그 소리는 이미
  // "고양이가 기뻐한다"는 뜻으로 학습돼 있어서 새로 가르칠 것이 없다.
  // 기본 인자가 0.15초 지연이라 0으로 당겨야 손과 소리가 붙는다.
  assert.match(candy, /import \{ playCatBonusSound \} from '\.\/audio\.js'/);
  assert.match(candy, /playCatBonusSound\(0\)/);

  // 처음 먹인 사람에게만 사탕이 어디서 나는지 한 번 더 짚는다.
  assert.match(candy, /fedCount === 1/);
  assert.match(candy, /candyFeedFirstTip/);
  assert.ok(MESSAGES.candyFeedFirstTip.length >= 1);
  assert.match(MESSAGES.candyFeedFirstTip[0], /게임/);
});

test('the home bubble clears the ears: centred, screen-wide, see-through', async () => {
  const polish = await readFile(new URL('../css/claude-polish.css', import.meta.url), 'utf8');
  const rule = polish.slice(polish.indexOf('.home-bubble {'), polish.indexOf('.home-bubble.is-visible'));

  // 무대 폭(186px)에 갇히면 스무 자 넘는 대사가 두세 줄이 되고, 늘어난
  // 줄이 아래로 자라 귀를 덮는다. 화면 폭을 써야 한 줄에 들어간다.
  assert.match(rule, /max-width: min\(88vw/);
  assert.match(rule, /width: max-content/);
  // 글자 길이에 맞춰 줄었다 늘었다 하며 화면 한가운데에 선다.
  assert.match(rule, /left: 50%/);
  assert.match(rule, /text-align: center/);
  assert.match(polish, /transform: translateX\(calc\(-50% - 8px\)\)/);
  // 어쩌다 귀에 걸려도 뒤가 비치게.
  assert.match(rule, /background: rgba\(255, 253, 246, \.82\)/);
  // 머리 위. top:0(무대 왼쪽 위)으로 돌아가면 귀를 다시 덮는다.
  assert.match(rule, /bottom: 90%/);
});

test('the feeding tally lives in the records sheet, not on the home screen', async () => {
  const [html, ui, game] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../js/ui.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/game.js', import.meta.url), 'utf8'),
  ]);

  // 준 것이 아무 데도 안 쌓이면 "이걸 왜 하지"가 남는다. 그렇다고 홈에
  // 숫자를 하나 더 붙이면 사탕 개수·최고점수 옆에 세 번째 숫자가 생겨
  // 첫 화면이 시끄러워진다. 누적은 기록 시트의 몫이다.
  const records = html.slice(html.indexOf('id="ranking-overlay"'), html.indexOf('id="ranking-bars"'));
  assert.match(records, /id="ranking-candy-line"/);
  assert.match(records, /id="ranking-candy-total"/);
  const home = html.slice(html.indexOf('id="home-screen"'), html.indexOf('id="play-screen"'));
  assert.doesNotMatch(home, /ranking-candy-total/);
  assert.doesNotMatch(home, /함께한 간식/);

  // 기록 시트를 열 때마다 지금 값으로 다시 그린다.
  assert.match(ui, /updateCandyFed\(total = 0\)/);
  assert.match(game, /refreshClassicRecordSurfaces\(\) \{[\s\S]*?updateCandyFed\(storageAdapter\.getFedCount\(\)\)/);

  // 한 번도 안 준 사람에게는 뜨지 않는다. 0인 줄은 알려주는 것이 없다.
  assert.match(ui, /rankingCandyLine\.hidden = count <= 0/);
});

test('a first-timer can always feed the cat after one game', async () => {
  const game = await readFile(new URL('../js/game.js', import.meta.url), 'utf8');
  const adapters = await readFile(new URL('../js/adapters.js', import.meta.url), 'utf8');

  // 실기기 제보: "한 판 하고 나면 별사탕 주는 게 안 생긴다." 맞았다.
  // 한 판 수급이 3~8인데 먹이기가 5라, 6,000점을 넘겨야 첫 판에 사탕이
  // 보인다. 처음 하는 사람은 그 점수를 못 낸다 - 기능이 있는 줄도 모르고
  // 끝난다. 이 시험이 그 문을 지킨다.
  assert.ok(candyForRun(0) < CANDY_PER_FEED, '보충이 필요 없다면 이 장치가 무의미하다');
  assert.equal(CANDY_STARTER_MINIMUM, CANDY_PER_FEED, '첫 판은 딱 한 번 먹일 만큼');
  assert.match(game, /claimCandyStarter\(CANDY_STARTER_MINIMUM\)/);
  assert.match(game, /this\.lastCandyEarned = earned \+ starter/);

  // 딱 한 번이어야 한다. "아직 안 먹였으면"으로 두면 모으기만 하는 사람에게
  // 매 판 보충이 나가 경제가 무너진다 - 받았다는 사실을 따로 적어 둔다.
  assert.match(adapters, /const CANDY_STARTER_KEY = 'oing_toss_v3_candy_starter'/);
  assert.match(adapters, /if \(safeRead\(CANDY_STARTER_KEY, ''\) === '1'\) return 0;/);
  const body = adapters.slice(
    adapters.indexOf('claimCandyStarter(minimum = 0) {'),
    adapters.indexOf('getFedCount() {'),
  );
  assert.ok(body.length > 0);
  assert.ok(!body.includes('getFedCount'), '먹인 횟수로 판단하면 매 판 보충이 나간다');
});
