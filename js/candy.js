// 별사탕 먹이기.
//
// 판이 끝나면 점수만큼 사탕이 쌓이고, 홈에서 고양이에게 끌어다 준다.
// 성장 단계도, 배고픔도, 시간 계산도 없다 - 주면 좋아하고 안 주면 그대로다.
// 가볍게 2분 하고 기분 좋아지는 게임에 의무감을 얹지 않기 위해서다.
//
// 반응은 세 겹이다: 포즈가 바뀌고(그림 세 장 돌려쓰기), 한 번 통통 튀고,
// 말풍선이 뜬다. 실기기 제보로 "왜 사탕이 생겼는지 모르겠고 끌어서 주라는
// 안내도 없다"는 말이 나와서, 첫 안내와 결과창 표시를 같이 붙였다.
import {
  CANDY_PER_FEED,
  CANDY_FEED_MILESTONES,
  CANDY_HAPPY_POSES,
  pickMessage,
} from './data.js';
import { storageAdapter } from './adapters.js';
import { playCatBonusSound } from './audio.js';

const IDLE_POSE = 'assets/characters/cat-idle.webp';
const HAPPY_MS = 1800;
const BUBBLE_MS = 2600;
// 첫 안내는 조금 더 오래 둔다 - 읽고 나서 손을 움직일 시간이 필요하다.
const HOWTO_MS = 5200;
// 첫 한 입 뒤에 사탕이 어디서 나는지 알려주는 두 번째 말. 첫 대사가
// 사라질 즈음 이어 붙는다.
const FIRST_TIP_DELAY_MS = 2400;

export function installCandyFeeding({ onFed } = {}) {
  const tray = document.querySelector('#candy-tray');
  const piece = document.querySelector('#candy-piece');
  const count = document.querySelector('#candy-count');
  const cat = document.querySelector('.home-cat');
  const stage = document.querySelector('.home-character-stage');
  const bubble = document.querySelector('#home-bubble');
  const heart = document.querySelector('#candy-heart');
  if (!tray || !piece || !count || !cat || !stage) return { refresh() {} };

  let happyTimer = 0;
  let bubbleTimer = 0;
  let tipTimer = 0;
  let dragging = false;
  let pointerId = null;
  let suppressClickUntil = 0;
  let lastLine = '';

  // 홈 말풍선은 평소에 없다. 무슨 일이 일어났을 때만 잠깐 떴다 사라지므로
  // "말풍선이 떴다 = 방금 뭔가 있었다"는 신호가 된다. 상시로 띄우면 첫
  // 화면이 시끄러워지고, 아래쪽은 버튼과 고양이로 이미 빡빡하다.
  const say = (text, ms = BUBBLE_MS) => {
    if (!bubble || !text) return;
    clearTimeout(bubbleTimer);
    bubble.textContent = text;
    bubble.hidden = false;
    // 같은 말을 연달아 띄울 때도 등장 애니메이션이 다시 돌게 한다.
    bubble.classList.remove('is-visible');
    void bubble.offsetWidth;
    bubble.classList.add('is-visible');
    bubbleTimer = window.setTimeout(() => {
      bubble.classList.remove('is-visible');
      bubble.hidden = true;
    }, ms);
  };

  const hush = () => {
    if (!bubble) return;
    clearTimeout(bubbleTimer);
    clearTimeout(tipTimer);
    bubble.classList.remove('is-visible');
    bubble.hidden = true;
  };

  // 먹였을 때 할 말. 첫 번째와 마디마다(10·30·50번째)는 따로 준비된 말이
  // 우선한다. 그 밖에는 스무 개 중에서 직전 것만 빼고 고른다.
  const lineForFeed = (fedCount) => {
    if (fedCount === 1) return pickMessage('candyFeedFirst', '');
    const milestone = CANDY_FEED_MILESTONES.indexOf(fedCount);
    if (milestone >= 0) return pickMessage('candyFeedMilestone', '');
    const line = pickMessage('candyFeed', lastLine);
    lastLine = line;
    return line;
  };

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

    // 아직 한 번도 안 줘 본 사람에게만 끌어서 주라고 알려 준다. 한 번
    // 먹이고 나면 이 길은 영영 닫힌다.
    const unfed = storageAdapter.getFedCount() <= 0;
    piece.classList.toggle('is-nudge', enough && unfed);
    if (enough && unfed) say(pickMessage('candyHowTo', ''), HOWTO_MS);
    else hush();
  };

  const showHappy = () => {
    clearTimeout(happyTimer);
    // 포즈 세 장을 돌려쓴다. 직전과 같은 그림은 피해서 매번 조금씩 다르게.
    const poses = CANDY_HAPPY_POSES.filter((pose) => pose !== cat.getAttribute('src'));
    const pool = poses.length ? poses : CANDY_HAPPY_POSES;
    cat.src = pool[Math.floor(Math.random() * pool.length)];
    stage.classList.add('is-happy');
    // 게임 안에서 고양이를 터뜨릴 때 나는 소리. 같은 소리를 쓰는 이유는
    // 그 소리가 이미 "고양이가 기뻐한다"는 뜻으로 학습돼 있기 때문이다.
    // 기본 인자는 0.15초 늦게 울리므로 여기서는 0으로 당긴다.
    try { playCatBonusSound(0); } catch {}
    // 통통 튀는 한 박자. transform/opacity만 쓰므로 합성만으로 끝난다 -
    // 이 게임이 오래 켜져 있어도 뜨거워지지 않는 이유다.
    stage.classList.remove('is-munching');
    void stage.offsetWidth;
    stage.classList.add('is-munching');
    if (heart) {
      heart.classList.remove('is-flying');
      void heart.offsetWidth;
      heart.classList.add('is-flying');
    }
    happyTimer = window.setTimeout(() => {
      cat.src = IDLE_POSE;
      stage.classList.remove('is-happy');
      stage.classList.remove('is-munching');
      heart?.classList.remove('is-flying');
    }, HAPPY_MS);
  };

  const feed = () => {
    if (!storageAdapter.spendCandy(CANDY_PER_FEED)) return false;
    storageAdapter.markFed();
    const fedCount = storageAdapter.getFedCount();
    refresh();
    showHappy();
    say(lineForFeed(fedCount));
    // 처음 먹인 사람에게만, 첫 대사가 끝날 즈음 사탕의 출처를 한 번 더
    // 짚어 준다. 결과창에도 적혀 있지만 그 화면을 그냥 넘긴 사람이 있다.
    if (fedCount === 1) {
      clearTimeout(tipTimer);
      tipTimer = window.setTimeout(() => say(pickMessage('candyFeedFirstTip', '')), FIRST_TIP_DELAY_MS);
    }
    onFed?.(fedCount);
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
    // 손이 닿은 순간 안내 동작은 멈춘다 - 이미 알아들었다는 뜻이다.
    piece.classList.remove('is-nudge');
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
