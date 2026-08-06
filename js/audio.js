let enabled = true;
let context = null;

function getContext() {
  if (!enabled) return null;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    if (!context || context.state === 'closed') context = new Context();
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  } catch {
    return null;
  }
}

function scheduleTone(ctx, frequency, start, duration, volume = 0.1, type = 'sine', attack = 0.012) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(volume, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0008, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function tone(frequency, startOffset, duration, volume = 0.1, type = 'sine') {
  const ctx = getContext();
  if (!ctx) return;
  scheduleTone(ctx, frequency, ctx.currentTime + startOffset, duration, volume, type);
}

export function setSoundEnabled(value) {
  enabled = Boolean(value);
  if (!enabled && context?.state === 'running') context.suspend().catch(() => {});
}

export function isSoundEnabled() {
  return enabled;
}

export function unlockAudio() {
  getContext();
}

export function playSelectionSound(sum = 0) {
  const boundedSum = Math.min(Math.max(Number(sum) || 0, 0), 10);
  const frequency = 620 + boundedSum * 24;
  tone(frequency, 0, boundedSum === 10 ? 0.065 : 0.045, boundedSum === 10 ? 0.026 : 0.016, 'triangle');
}

// Original OING index.html playSuccess(): C5–D#5–G5 with a short sparkle.
export function playSuccessSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [523.25, 622.25, 783.99].forEach((frequency, index) => {
    scheduleTone(ctx, frequency, now + index * 0.07, 0.18, 0.16, 'sine', 0.02);
  });
  const sparkle = ctx.createOscillator();
  const sparkleGain = ctx.createGain();
  sparkle.type = 'triangle';
  sparkle.frequency.setValueAtTime(1800, now);
  sparkle.frequency.exponentialRampToValueAtTime(2400, now + 0.12);
  sparkleGain.gain.setValueAtTime(0.05, now);
  sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  sparkle.connect(sparkleGain);
  sparkleGain.connect(ctx.destination);
  sparkle.start(now);
  sparkle.stop(now + 0.18);
}

// Original OING index.html playComboUp()/playCombo7(), adapted to this game's
// visible milestones (3, 5, 8). Every chained clear climbs in pitch.
export function playComboSound(combo) {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  if (combo >= 8) {
    [1046, 1318, 1568, 2093].forEach((frequency, index) => {
      scheduleTone(ctx, frequency, now + index * 0.07, 0.2, 0.14, 'sine', 0.01);
    });
    return;
  }
  const base = 440 + Math.min(Math.max(combo, 2), 6) * 80;
  [base, base * 1.25].forEach((frequency, index) => {
    scheduleTone(ctx, frequency, now + index * 0.05, 0.15, 0.12, 'sine', 0.008);
  });
}

export function playFailSound() {
  tone(520, 0, 0.09, 0.14, 'triangle');
  tone(520, 0.09, 0.09, 0.14, 'triangle');
}

export function playHintSound() {
  [600, 800, 1000, 1400].forEach((frequency, index) => tone(frequency, index * 0.06, 0.14, 0.15, 'triangle'));
}

export function playShuffleSound() {
  const ctx = getContext();
  if (!ctx) return;
  for (let pass = 0; pass < 2; pass += 1) {
    const duration = 0.11;
    const start = ctx.currentTime + pass * 0.12;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = (Math.random() * 2 - 1) * (1 - index / samples.length);
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = 2500 + pass * 700;
    filter.Q.value = 0.9;
    gain.gain.setValueAtTime(0.09, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    source.start(start);
  }
}

export function playRoundClearSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    scheduleTone(ctx, frequency, now + index * 0.07, 0.28, index === 3 ? 0.22 : 0.15, 'sine', 0.015);
  });
  scheduleTone(ctx, 2093, now + 0.3, 0.2, 0.06, 'sine', 0.008);
}

export function playGameOverSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const fanfare = [
    { frequency: 392, offset: 0, duration: 0.12 },
    { frequency: 523, offset: 0.13, duration: 0.12 },
    { frequency: 659, offset: 0.26, duration: 0.12 },
    { frequency: 784, offset: 0.39, duration: 0.35 },
    { frequency: 659, offset: 0.45, duration: 0.12 },
    { frequency: 784, offset: 0.58, duration: 0.5 },
  ];
  fanfare.forEach(({ frequency, offset, duration }) => {
    scheduleTone(ctx, frequency, now + offset, duration, 0.02, 'sawtooth', 0.02);
    scheduleTone(ctx, frequency, now + offset, duration, 0.032, 'sine', 0.02);
  });

  const sparkle = ctx.createOscillator();
  const sparkleGain = ctx.createGain();
  sparkle.type = 'triangle';
  sparkle.frequency.setValueAtTime(1200, now + 0.6);
  sparkle.frequency.exponentialRampToValueAtTime(2800, now + 1.1);
  sparkleGain.gain.setValueAtTime(0.02, now + 0.6);
  sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  sparkle.connect(sparkleGain);
  sparkleGain.connect(ctx.destination);
  sparkle.start(now + 0.6);
  sparkle.stop(now + 1.25);
}
