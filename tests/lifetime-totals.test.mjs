// 도감 카드가 보는 평생 누적값들.
//
// 이 값들이 한 번 어긋나면 카드가 영영 안 열리거나 공짜로 열린다. 그런데
// 어긋나도 화면에는 아무 표시가 없어서, 사람이 몇 판을 돌려보기 전에는
// 모른다. 그래서 저장 규칙 자체를 테스트로 붙잡아 둔다.
import assert from 'node:assert/strict';
import test from 'node:test';

function withLocalStorage(run) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  try {
    return run(store);
  } finally {
    delete globalThis.localStorage;
  }
}

const load = async () => (await import('../js/adapters.js')).storageAdapter;

test('누적값은 더해지고, 더한 결과를 곧바로 돌려준다', async () => {
  const adapter = await load();
  withLocalStorage(() => {
    assert.equal(adapter.getRunsPlayed(), 0);
    assert.equal(adapter.addRunPlayed(), 1);
    assert.equal(adapter.addRunPlayed(), 2);

    assert.equal(adapter.addBigClears(3), 3);
    assert.equal(adapter.addBigClears(4), 7);

    assert.equal(adapter.addCellsCleared(154), 154);
    assert.equal(adapter.addCellsCleared(680), 834);
  });
});

test('음수나 이상한 값이 와도 누적을 깎지 않는다', async () => {
  const adapter = await load();
  withLocalStorage(() => {
    adapter.addCellsCleared(100);
    assert.equal(adapter.addCellsCleared(-50), 100);
    assert.equal(adapter.addCellsCleared('아무거나'), 100);
    assert.equal(adapter.addBigClears(null), 0);
  });
});

test('출석은 서로 다른 날만 센다 - 같은 날 여러 판은 하루다', async () => {
  const adapter = await load();
  withLocalStorage(() => {
    adapter.addPlayDay('2026-08-21');
    adapter.addPlayDay('2026-08-21');
    adapter.addPlayDay('2026-08-21');
    assert.deepEqual(adapter.getPlayDays(), ['2026-08-21']);

    // 하루 빠져도 초기화되지 않는다. 연속이 아니라 총 며칠이기 때문이다.
    adapter.addPlayDay('2026-08-23');
    adapter.addPlayDay('2026-09-30');
    assert.equal(adapter.getPlayDays().length, 3);
  });
});

test('최고 콤보는 내려가지 않는다', async () => {
  const adapter = await load();
  withLocalStorage(() => {
    assert.equal(adapter.saveClassicBestCombo(108), 108);
    assert.equal(adapter.saveClassicBestCombo(35), 108);
    assert.equal(adapter.saveClassicBestCombo(178), 178);
  });
});

test('저장이 막혀 있어도 게임이 죽지 않는다', async () => {
  const adapter = await load();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => { throw new Error('차단됨'); },
    setItem: () => { throw new Error('차단됨'); },
  };
  try {
    assert.doesNotThrow(() => adapter.addRunPlayed());
    assert.doesNotThrow(() => adapter.addPlayDay('2026-08-21'));
    assert.deepEqual(adapter.getPlayDays(), []);
  } finally {
    if (previous) globalThis.localStorage = previous; else delete globalThis.localStorage;
  }
});
