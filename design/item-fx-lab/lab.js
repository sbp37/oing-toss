import {
  unlockAudio,
  playHintSound,
  playShuffleSound,
  playBombSound,
  playMegaBombSound,
  playClockSound,
  playFreezeSound,
  playCloverSound,
} from '../../js/audio.js';

const ITEMS = Object.freeze({
  hint: {
    icon: '../../assets/icons/items/hint.webp',
    label: '합10 여기!',
    details: {
      current: '민트 테두리와 기존 힌트음. 기능은 잘 보이지만 선이 먼저 느껴져.',
      soft: '정답 범위만 부드럽게 밝혀주고 낮은 벨로 시선을 안내해.',
      punchy: '정답 범위를 빠르게 팝업하고 짧은 상승음으로 즉시 찾게 해.',
    },
  },
  shuffle: {
    icon: '../../assets/icons/items/shuffle.webp',
    label: '착! 새 판',
    details: {
      current: '현재의 얇은 회전선과 사각거리는 섞기 소리.',
      soft: '선 대신 두툼한 민트 시럽 덩어리와 낮은 말랑 소리를 사용해.',
      punchy: '타일이 빠르게 모였다 붙고 한 번의 선명한 착 소리로 끝나.',
    },
  },
  bomb: {
    icon: '../../assets/icons/items/bomb.webp',
    label: 'POP!',
    details: {
      current: '현재의 링·번개 파편·시럽 방울과 원조 폭탄음.',
      soft: '폭탄 그림을 반복하지 않고 코랄 젤리 파동과 낮은 퐁 소리로 터져.',
      punchy: '더 빠른 충격파와 큰 점수감을 주되 전체 화면은 흔들지 않아.',
    },
  },
  clock: {
    icon: '../../assets/icons/hud/time.webp',
    label: '+5초',
    details: {
      current: '현재의 긴 세 음 벨과 타이머 도착 연출.',
      soft: '시계가 타이머에 말랑하게 붙고 낮고 둥근 세 음으로 보상해.',
      punchy: '+5초가 더 크게 튀며 빠른 네 음으로 위기 탈출을 강조해.',
    },
  },
  megabomb: {
    icon: '../../assets/icons/items/megabomb.webp',
    label: 'MEGA POP!',
    details: {
      current: '현재의 큰 아이콘·다중 링·강한 파편과 긴 충격음.',
      soft: '깊은 저음과 두꺼운 젤리 충격파로 크지만 귀 아프지 않게 해.',
      punchy: '두 번의 충격과 별 파편으로 희귀 아이템다운 순간을 만들어.',
    },
  },
  freeze: {
    icon: '../../assets/icons/items/freeze.webp',
    label: '시간 정지',
    details: {
      current: '현재의 높은 얼음 파편음과 보드 전체 서리 효과.',
      soft: '고음을 낮추고 맑은 얼음막이 조용히 퍼지는 느낌으로 바꿔.',
      punchy: '짧은 얼음 균열 뒤 타이머가 멈추는 순간을 또렷하게 보여줘.',
    },
  },
  clover: {
    icon: '../../assets/icons/items/clover.webp',
    label: '정답 발견',
    details: {
      current: '현재의 초록 링과 높은 행운 아르페지오.',
      soft: '연두빛이 답에 모이고 따뜻한 네 음으로 행운을 표현해.',
      punchy: '별이 답으로 모이는 빠른 집중 연출과 밝은 보상음을 사용해.',
    },
  },
});

const CURRENT_SOUND = Object.freeze({
  hint: playHintSound,
  shuffle: playShuffleSound,
  bomb: playBombSound,
  megabomb: playMegaBombSound,
  clock: playClockSound,
  freeze: playFreezeSound,
  clover: playCloverSound,
});

const NUMBERS = [2, 8, 4, 6, 3, 7, 1, 9, 5, 5, 2, 8, 6, 4, 7, 3];
let selectedItem = 'hint';
let candidateContext = null;
let candidateBus = null;

function buildBoards() {
  document.querySelectorAll('.mini-board').forEach((board) => {
    board.replaceChildren(...NUMBERS.map((number, index) => {
      const tile = document.createElement('span');
      tile.className = 'mini-tile';
      tile.textContent = String(number);
      tile.style.setProperty('--i', String(index));
      tile.style.setProperty('--soft-delay', `${index * 11}ms`);
      tile.style.setProperty('--punch-delay', `${index * 8}ms`);
      tile.style.setProperty('--mega-delay', `${index * 10}ms`);
      tile.style.setProperty('--jitter', `${index % 2 ? -1 : 1}deg`);
      return tile;
    }));
  });
}

function candidateAudio() {
  if (candidateContext?.state === 'closed') candidateContext = null;
  if (!candidateContext) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    candidateContext = new Context();
    const compressor = candidateContext.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 14;
    compressor.ratio.value = 7;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.2;
    candidateBus = candidateContext.createGain();
    candidateBus.gain.value = 0.58;
    candidateBus.connect(compressor);
    compressor.connect(candidateContext.destination);
  }
  if (candidateContext.state === 'suspended') candidateContext.resume().catch(() => {});
  return candidateContext;
}

function note(ctx, frequency, offset, duration, volume, type = 'sine', endFrequency = null) {
  const start = ctx.currentTime + offset;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration * 0.72);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(volume, start + Math.min(.018, duration * .18));
  gain.gain.exponentialRampToValueAtTime(0.0008, start + duration);
  oscillator.connect(gain);
  gain.connect(candidateBus);
  oscillator.start(start);
  oscillator.stop(start + duration + .03);
}

function puff(ctx, offset, duration, volume, cutoff) {
  const start = ctx.currentTime + offset;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = (Math.random() * 2 - 1) * Math.exp(-index / (ctx.sampleRate * duration * .16));
  }
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(.0008, start + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(candidateBus);
  source.start(start);
}

function playCandidateSound(item, mode) {
  const ctx = candidateAudio();
  if (!ctx) return;
  const strong = mode === 'punchy';
  const gain = strong ? 1 : .78;

  if (item === 'hint') {
    const notes = strong ? [523, 698, 932] : [392, 523, 659];
    notes.forEach((frequency, index) => note(ctx, frequency, index * .055, strong ? .18 : .24, (.09 - index * .012) * gain, 'sine'));
    return;
  }
  if (item === 'shuffle') {
    puff(ctx, 0, strong ? .14 : .2, .2 * gain, strong ? 1250 : 760);
    puff(ctx, strong ? .1 : .13, strong ? .12 : .18, .15 * gain, strong ? 1680 : 980);
    note(ctx, strong ? 659 : 440, strong ? .19 : .24, .18, .1 * gain, 'triangle', strong ? 988 : 587);
    return;
  }
  if (item === 'bomb' || item === 'megabomb') {
    const mega = item === 'megabomb';
    puff(ctx, 0, mega ? .42 : .3, (mega ? .56 : .38) * gain, strong ? 520 : 340);
    note(ctx, mega ? 120 : 170, 0, mega ? .38 : .26, (mega ? .28 : .22) * gain, 'sine', mega ? 52 : 86);
    const notes = strong
      ? (mega ? [392, 523, 698, 932] : [440, 587, 784])
      : (mega ? [262, 349, 440, 587] : [330, 440, 554]);
    notes.forEach((frequency, index) => note(ctx, frequency, .05 + index * (strong ? .045 : .065), mega ? .25 : .18, (.09 - index * .008) * gain, 'triangle'));
    if (strong && mega) puff(ctx, .16, .24, .24, 440);
    return;
  }
  if (item === 'clock') {
    const notes = strong ? [587, 784, 1046, 1318] : [440, 587, 698];
    notes.forEach((frequency, index) => note(ctx, frequency, index * (strong ? .055 : .09), strong ? .24 : .34, (.12 - index * .014) * gain, index === notes.length - 1 ? 'triangle' : 'sine'));
    return;
  }
  if (item === 'freeze') {
    const notes = strong ? [880, 1175, 1397, 1046] : [587, 784, 932, 698];
    notes.forEach((frequency, index) => note(ctx, frequency, index * .045, strong ? .22 : .3, (.08 - index * .009) * gain, 'sine'));
    puff(ctx, 0, .16, .08 * gain, strong ? 1800 : 1050);
    return;
  }
  if (item === 'clover') {
    const notes = strong ? [523, 698, 880, 1175] : [392, 523, 659, 784];
    notes.forEach((frequency, index) => note(ctx, frequency, index * (strong ? .055 : .075), strong ? .22 : .3, (.09 - index * .008) * gain, index === 3 ? 'triangle' : 'sine'));
  }
}

function effectMarkup(item) {
  const definition = ITEMS[item];
  const showCore = !['hint', 'shuffle', 'clock'].includes(item);
  const showRings = !['shuffle'].includes(item);
  return `
    ${showRings ? '<i class="fx-ring"></i><i class="fx-ring r2"></i>' : ''}
    ${showCore ? `<img class="fx-core" src="${definition.icon}" alt="">` : ''}
    ${item === 'shuffle' ? '<i class="fx-wave"></i><i class="fx-wave w2"></i><i class="fx-wave w3"></i>' : ''}
    <i class="fx-spark s1"></i><i class="fx-spark s2"></i><i class="fx-spark s3"></i><i class="fx-spark s4"></i>
    <strong class="fx-label">${definition.label}</strong>
    ${item === 'freeze' ? '<i class="fx-veil"></i>' : ''}
  `;
}

function seedItemTile(stage, item) {
  const board = stage.querySelector('.mini-board');
  board.querySelectorAll('.mini-tile').forEach((tile, index) => {
    tile.classList.remove('is-item');
    tile.textContent = String(NUMBERS[index]);
  });
  if (!['bomb', 'megabomb', 'freeze', 'clover', 'clock'].includes(item)) return;
  const tile = board.children[5];
  tile.classList.add('is-item');
  tile.replaceChildren(Object.assign(document.createElement('img'), { src: ITEMS[item].icon, alt: '' }));
}

function resetStage(stage, item, mode) {
  stage.classList.remove('is-running');
  stage.dataset.item = item;
  stage.dataset.mode = mode;
  stage.querySelector('.fx-layer').replaceChildren();
  stage.querySelector('.mini-timer').textContent = '00:38';
  seedItemTile(stage, item);
}

function playPreview(card) {
  const mode = card.dataset.mode;
  const stage = card.querySelector('.demo-stage');
  clearTimeout(Number(stage.dataset.resetTimer || 0));
  resetStage(stage, selectedItem, mode);
  stage.querySelector('.fx-layer').innerHTML = effectMarkup(selectedItem);
  void stage.offsetWidth;
  stage.classList.add('is-running');
  if (selectedItem === 'clock') {
    window.setTimeout(() => { stage.querySelector('.mini-timer').textContent = '00:43'; }, mode === 'punchy' ? 230 : 330);
  }
  if (mode === 'current') {
    unlockAudio().then(() => CURRENT_SOUND[selectedItem]?.());
  } else {
    playCandidateSound(selectedItem, mode);
  }
  stage.dataset.resetTimer = String(window.setTimeout(() => resetStage(stage, selectedItem, mode), 1250));
}

function updateItem(item) {
  selectedItem = item;
  document.querySelectorAll('.item-tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.item === item));
  document.querySelectorAll('.variant-card').forEach((card) => {
    const mode = card.dataset.mode;
    resetStage(card.querySelector('.demo-stage'), item, mode);
    card.querySelector('.variant-detail').textContent = ITEMS[item].details[mode];
  });
}

buildBoards();
document.querySelectorAll('.item-tab').forEach((tab) => tab.addEventListener('click', () => updateItem(tab.dataset.item)));
document.querySelectorAll('.variant-card').forEach((card) => card.querySelector('.preview-button').addEventListener('click', () => playPreview(card)));
updateItem(selectedItem);
