// 앱인토스 꾸러미(.ait) 굽기.
//
// 세 단계다. 공유 미리보기 그림을 뺀 배포본 만들기 -> 꾸러미 굽기 ->
// 웹용 완전본으로 되돌리기.
//
// 왜 스크립트가 필요한가. 예전에는 npm 스크립트에서 `&&`로 이어 붙였는데,
// 외부 검수에서 지적받았다 - 가운데 단계가 실패하면 마지막 되돌리기가 아예
// 안 돌고, dist/client가 공유 그림이 빠진 채로 남는다. 그 상태로 웹에 올리면
// 공유 링크의 미리보기가 조용히 빈칸이 된다. 빌드가 실패했다는 것은 알아도
// "배포본이 오염됐다"는 것은 아무도 모른다.
//
// 되돌리기를 finally에 둬서 무슨 일이 있어도 돌게 했다. 꾸러미 굽기가
// 실패해도 배포본은 언제나 완전본으로 남는다.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shareDir = resolve(root, 'dist/client/assets/share');

function run(label, command, args) {
  process.stdout.write(`\n[${label}] ${command} ${args.join(' ')}\n`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} 실패 (exit ${result.status})`);
}

let packaged = false;
try {
  run('꾸러미용 빌드', 'node', ['hosting/build-static.mjs', '--ait']);
  if (existsSync(shareDir)) {
    throw new Error('--ait 빌드인데 assets/share가 남아 있다 - 빌드 스크립트를 확인할 것');
  }
  run('꾸러미 굽기', 'npx', ['ait', 'build']);
  packaged = true;
} finally {
  // 무슨 일이 있어도 배포본은 완전본으로 돌려놓는다. 이 되돌리기가 실패하면
  // 그건 조용히 넘어가면 안 되는 사고라 크게 알린다.
  try {
    run('웹 배포본 복구', 'node', ['hosting/build-static.mjs']);
    if (!existsSync(shareDir)) {
      throw new Error('복구했는데도 assets/share가 없다');
    }
  } catch (error) {
    process.stdout.write(
      '\n!! dist/client 복구에 실패했다. 지금 상태로 웹에 올리면 공유 링크\n'
      + '!! 미리보기가 빈칸이 된다. `npm run build`를 손으로 한 번 돌릴 것.\n'
      + `!! ${error?.message || error}\n`,
    );
    throw error;
  }
}

if (packaged) process.stdout.write('\n완료: oing-game.ait (공유 그림 제외) / dist/client는 웹용 완전본\n');
