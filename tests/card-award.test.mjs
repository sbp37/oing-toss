// 이번 판에 처음 열린 카드를 어떻게 골라내는가.
//
// 판정은 저장된 "획득 플래그"가 아니라 누적값에서 나온다. 그래서 이 테스트가
// 지키는 것은 두 가지다: 갤러리와 결과 화면이 같은 누적값을 보면 같은 답을
// 낸다는 것, 그리고 이미 열려 있던 카드는 두 번 축하받지 않는다는 것.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OING_CARDS,
  RARE_BOARD_ITEM_INTROS,
  newlyUnlockedOingCards,
  oingCardRows,
  unseenRareBoardItemTypes,
} from '../js/data.js';

// 아홉 장 전부를 여는 누적값. 카드가 늘어도 따라오도록 정의에서 만든다.
function totalsUnlockingAll() {
  const totals = {};
  for (const card of OING_CARDS) {
    totals[card.metric] = Math.max(totals[card.metric] || 0, card.goal);
  }
  return totals;
}

test('첫 판을 끝내면 첫 카드 한 장만 열린다', () => {
  const award = newlyUnlockedOingCards({ runs: 1 }, []);
  assert.equal(award.fresh.length, 1);
  assert.equal(award.fresh[0].key, 'first-run');
  assert.equal(award.unlockedCount, 1);
  assert.equal(award.total, OING_CARDS.length);
});

test('이미 열려 있던 카드는 다시 신규로 잡히지 않는다', () => {
  const award = newlyUnlockedOingCards({ runs: 1 }, ['first-run']);
  assert.deepEqual(award.fresh, []);
  // 열린 장수는 그대로 1 - 신규가 없다고 진행도가 0이 되지는 않는다.
  assert.equal(award.unlockedCount, 1);
});

test('한 판에 여러 장이 열리면 전부 돌려주고 순서는 정의 순서를 따른다', () => {
  const award = newlyUnlockedOingCards({ runs: 10, cats: 300 }, ['first-run']);
  assert.deepEqual(award.fresh.map((card) => card.key), ['ten-runs', 'cats-300']);
  // 결과 화면이 크게 세우는 것은 마지막 한 장 - 조건이 더 무거운 쪽이다.
  assert.equal(award.fresh.at(-1).key, 'cats-300');
  assert.equal(award.unlockedCount, 3);
});

test('조건 경계값: goal 직전은 안 열리고 goal에서 열린다', () => {
  for (const card of OING_CARDS) {
    const below = newlyUnlockedOingCards({ [card.metric]: card.goal - 1 }, []);
    assert.ok(
      !below.fresh.some((row) => row.key === card.key),
      `${card.key}가 ${card.goal - 1}에서 열렸다`,
    );
    const at = newlyUnlockedOingCards({ [card.metric]: card.goal }, []);
    assert.ok(
      at.fresh.some((row) => row.key === card.key),
      `${card.key}가 ${card.goal}에서 안 열렸다`,
    );
  }
});

test('아홉 장을 모두 열면 신규 아홉 장, 진행도 9/9', () => {
  const award = newlyUnlockedOingCards(totalsUnlockingAll(), []);
  assert.equal(award.fresh.length, OING_CARDS.length);
  assert.equal(award.unlockedCount, OING_CARDS.length);
  assert.equal(award.unlockedCount, award.total);
});

test('전부 열린 뒤에는 더 이상 신규가 나오지 않는다', () => {
  const totals = totalsUnlockingAll();
  const keys = OING_CARDS.map((card) => card.key);
  const award = newlyUnlockedOingCards(totals, keys);
  assert.deepEqual(award.fresh, []);
  assert.equal(award.unlockedCount, OING_CARDS.length);
});

test('결과 화면 판정과 갤러리 표시가 같은 누적값에서 갈라지지 않는다', () => {
  const totals = { runs: 12, cats: 140, bigClears: 40, cellsCleared: 900, playDays: 3, bestScore: 6000 };
  const galleryUnlocked = oingCardRows(totals).filter((row) => row.unlocked).map((row) => row.key);
  const award = newlyUnlockedOingCards(totals, []);
  assert.deepEqual(award.fresh.map((row) => row.key), galleryUnlocked);
  assert.equal(award.unlockedCount, galleryUnlocked.length);
});

test('누적값이 없으면 아무것도 열리지 않는다', () => {
  const award = newlyUnlockedOingCards({}, []);
  assert.deepEqual(award.fresh, []);
  assert.equal(award.unlockedCount, 0);
});

// 희귀 아이템 첫 등장 안내 -------------------------------------------------
test('세 아이템 모두 안내 문구를 갖는다', () => {
  for (const type of ['megabomb', 'freeze', 'clover']) {
    assert.equal(typeof RARE_BOARD_ITEM_INTROS[type], 'string');
    assert.ok(RARE_BOARD_ITEM_INTROS[type].length > 0);
  }
});

test('처음 보는 희귀 아이템만 골라낸다', () => {
  assert.deepEqual(unseenRareBoardItemTypes(['megabomb'], []), ['megabomb']);
  assert.deepEqual(unseenRareBoardItemTypes(['megabomb'], ['megabomb']), []);
});

test('폭탄과 시계는 안내 대상이 아니다', () => {
  assert.deepEqual(unseenRareBoardItemTypes(['bomb', 'clock'], []), []);
});

test('같은 종류가 한 판에 둘 놓여도 한 번만 잡힌다', () => {
  assert.deepEqual(unseenRareBoardItemTypes(['clover', 'clover'], []), ['clover']);
});

test('여러 종류가 같이 놓이면 순서대로 전부 돌려주되 본 것은 뺀다', () => {
  assert.deepEqual(
    unseenRareBoardItemTypes(['freeze', 'megabomb', 'clover'], ['megabomb']),
    ['freeze', 'clover'],
  );
});

// 저장 어댑터 쪽 - "각각 1회만"을 지키는 것은 이 두 줄이다.
test('본 아이템은 두 번 기록되지 않고, 종류별로 따로 쌓인다', async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  const { storageAdapter } = await import('../js/adapters.js');

  assert.deepEqual(storageAdapter.getSeenRareItems(), []);
  assert.deepEqual(storageAdapter.markRareItemSeen('megabomb'), ['megabomb']);
  assert.deepEqual(storageAdapter.markRareItemSeen('megabomb'), ['megabomb']);
  assert.deepEqual(storageAdapter.markRareItemSeen('clover'), ['megabomb', 'clover']);
  assert.deepEqual(storageAdapter.getSeenRareItems(), ['megabomb', 'clover']);

  // 한 번 본 종류는 다음 등장에서 걸러진다 - 게임이 실제로 하는 판단.
  assert.deepEqual(
    unseenRareBoardItemTypes(['megabomb', 'freeze'], storageAdapter.getSeenRareItems()),
    ['freeze'],
  );
  delete globalThis.localStorage;
});
