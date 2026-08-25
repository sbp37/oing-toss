// 별사탕 먹이기.
//
// 판이 끝나면 점수만큼 사탕이 쌓이고, 홈에서 고양이에게 끌어다 준다.
// 성장 단계도, 배고픔도, 시간 계산도 없다 - 주면 좋아하고 안 주면 그대로다.
// 가볍게 2분 하고 기분 좋아지는 게임에 의무감을 얹지 않기 위해서다.
import { CANDY_PER_FEED } from './data.js';
import { storageAdapter } from './adapters.js';

const HAPPY_POSE = 'assets/characters/cat-success.webp';
const IDLE_POSE = 'assets/characters/cat-idle.webp';
const HAPPY_MS = 1600;

export function installCandyFeeding({ onFed } = {}) {
  const tray = document.querySelector('#candy-tray');
  const piece = document.querySelector('#candy-piece');
  const count = document.querySelector('#candy-count');
  const cat = document.querySelector('.home-cat');
  const stage = document.querySelector('.home-character-stage');
  if (!tray || !piece || !count || !cat || !stage) return { refresh() {} };

  let happyTimer = 0;
  let dragging = false;
  let pointerId = null;
  let suppressClickUntil = 0;

  const refresh = () => {
    const balance = storageAdapter.getCandy();
    count.textContent = String(balance);
    // 한 번 먹일 만큼도 없으면 접시를 숨긴다 - 못 쓰는 버튼은 없느니만 못하다.
    // hidden 속성만으로는 안 숨는다 - .candy-tray의 display:grid가 이긴다.
    // 클래스로 확실히 감춘다(실측: 사탕 2개인데 접시가 그대로 보였다).
    const enough = balance >= CANDY_PER_FEED;
    tray.hidden = !enough;
    tray.classList.toggle('is-hidden', !enough);
    piece.disabled = !enough;
  };

  const showHappy = () => {
    clearTimeout(happyTimer);
    cat.src = HAPPY_POSE;
    stage.classList.add('is-happy');
    happyTimer = window.setTimeout(() => {
      cat.src = IDLE_POSE;
      stage.classList.remove('is-happy');
    }, HAPPY_MS);
  };

  const feed = () => {
    if (!storageAdapter.spendCandy(CANDY_PER_FEED)) return false;
    storageAdapter.markFed();
    refresh();
    showHappy();
    onFed?.();
    return true;
  };

  // 사탕을 고양이 위에 놓았는가. 손가락 좌표가 고양이 사각형 안이면 된다.
  const overCat = (x, y) => {
    const r = cat.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  const moveTo = (x, y) => {
    const r = tray.getBoundingClientRect();
    piece.style.setProperty('--drag-x', `${x - r.left - r.width / 2}px`);
    piece.style.setProperty('--drag-y', `${y - r.top - r.height / 2}px`);
  };

  const endDrag = (x, y) => {
    if (!dragging) return;
    dragging = false;
    // 포인터로 끝낸 제스처는 브라우저가 click도 이어서 쏜다. 그대로 두면
    // 한 번 끌었는데 두 번 먹는다(실측: 사탕이 5가 아니라 10 줄었다).
    suppressClickUntil = performance.now() + 400;
    piece.classList.remove('is-dragging');
    piece.style.removeProperty('--drag-x');
    piece.style.removeProperty('--drag-y');
    stage.classList.remove('is-feed-target');
    if (pointerId !== null && piece.hasPointerCapture?.(pointerId)) {
      try { piece.releasePointerCapture(pointerId); } catch {}
    }
    pointerId = null;
    if (overCat(x, y)) feed();
  };

  piece.addEventListener('pointerdown', (event) => {
    if (piece.disabled) return;
    event.preventDefault();
    dragging = true;
    pointerId = event.pointerId;
    piece.classList.add('is-dragging');
    stage.classList.add('is-feed-target');
    try { piece.setPointerCapture(pointerId); } catch {}
    moveTo(event.clientX, event.clientY);
  });

  piece.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    event.preventDefault();
    moveTo(event.clientX, event.clientY);
    // 고양이 위에 올라오면 미리 알려 준다 - 놓아도 되는지 손이 알게.
    stage.classList.toggle('is-feed-hover', overCat(event.clientX, event.clientY));
  });

  piece.addEventListener('pointerup', (event) => {
    stage.classList.remove('is-feed-hover');
    endDrag(event.clientX, event.clientY);
  });

  piece.addEventListener('pointercancel', () => {
    stage.classList.remove('is-feed-hover');
    endDrag(-1, -1);
  });

  // 끌지 않고 그냥 눌러도 먹인다. 드래그가 어려운 사람을 막지 않는다.
  // 다만 방금 끌기를 끝냈다면 그 click은 같은 제스처의 꼬리이므로 무시한다.
  piece.addEventListener('click', (event) => {
    event.preventDefault();
    if (performance.now() < suppressClickUntil) return;
    if (!piece.disabled) feed();
  });

  refresh();
  return { refresh };
}
