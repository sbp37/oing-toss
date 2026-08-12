// B. 아이템 등장률 전/후 비교. simulateRun 을 여러 판 돌려서
// 판당 평균 등장 횟수 + "한 번이라도 등장한 판 비율"을 잰다.
import { simulateRun } from '../js/balance.js';

const RUNS = Number(process.argv[2]) || 200;
const PROFILES = ['regular', 'expert'];
const ITEMS = ['bomb', 'clock', 'megabomb', 'freeze', 'clover'];

for (const profile of PROFILES) {
  const runs = Array.from({ length: RUNS }, (_, i) => simulateRun({ profile, seed: 700000 + i }));
  const totals = Object.fromEntries(ITEMS.map((id) => [id, 0]));
  const anyRun = Object.fromEntries(ITEMS.map((id) => [id, 0]));
  let maxRoundSum = 0;
  for (const run of runs) {
    maxRoundSum += run.round;
    for (const id of ITEMS) {
      const n = run.itemsEarned[id] || 0;
      totals[id] += n;
      if (n > 0) anyRun[id] += 1;
    }
  }
  console.log(`\n=== profile: ${profile}  (${RUNS}판, 평균 도달 스테이지 ${(maxRoundSum / RUNS).toFixed(1)}) ===`);
  console.log('아이템      판당평균   등장판비율');
  for (const id of ITEMS) {
    const mean = (totals[id] / RUNS).toFixed(2);
    const pct = ((anyRun[id] / RUNS) * 100).toFixed(0);
    console.log(`${id.padEnd(10)} ${String(mean).padStart(8)}   ${String(pct).padStart(8)}%`);
  }
}
