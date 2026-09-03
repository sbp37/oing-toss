// android/gradlew를 어느 OS에서든 같은 명령으로 부르기 위한 얇은 껍데기.
// npm 스크립트에 `cd android && ./gradlew ...`를 그대로 적으면 윈도우에서
// 돌지 않는다.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const android = resolve(root, 'android');
const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const args = process.argv.slice(2);

const child = spawn(wrapper, args, { cwd: android, stdio: 'inherit', shell: process.platform === 'win32' });
child.on('exit', (code) => process.exit(code ?? 1));
