let enabled = true;
let context = null;
let primed = false;
let mixContext = null;
let mixBus = null;

function getMixBus(ctx) {
  if (mixBus && mixContext === ctx) return mixBus;
  mixContext = ctx;
  mixBus = ctx.createGain();
  mixBus.gain.value = 0.72;
  if (typeof ctx.createDynamicsCompressor === 'function') {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;
    mixBus.connect(limiter);
    limiter.connect(ctx.destination);
  } else {
    mixBus.connect(ctx.destination);
  }
  return mixBus;
}

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
  gain.connect(getMixBus(ctx));
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
  if (enabled && context?.state === 'suspended') context.resume().catch(() => {});
}

export function isSoundEnabled() {
  return enabled;
}

export async function unlockAudio() {
  const ctx = getContext();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    if (!primed && ctx.state === 'running') {
      const source = ctx.createBufferSource();
      source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      source.connect(ctx.destination);
      source.start(ctx.currentTime);
      primed = true;
    }
    return ctx.state === 'running';
  } catch {
    return false;
  }
}

export function playStartSound() {
  const ctx = getContext();
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  scheduleTone(ctx, 659.25, now, 0.11, 0.075, 'sine', 0.008);
  scheduleTone(ctx, 880, now + 0.08, 0.16, 0.09, 'sine', 0.008);
}

// Original OING playCountNum(): 3→2→1 rises 400→520→640Hz with a soft harmonic.
// The countdown, GO!, combo and game-over voices are ports of the original
// OING's own oscillator scripts — same frequencies, same envelopes, and now
// the same gains. They had been mixed roughly a third as loud, which is why
// the start of a run felt limp next to the original's.
export function playReadyCountSound(number) {
  const ctx = getContext();
  if (!ctx) return;
  const count = Math.min(3, Math.max(1, Math.round(Number(number) || 1)));
  const now = ctx.currentTime;
  const frequency = 400 + (3 - count) * 120;

  const voice = ctx.createOscillator();
  const voiceGain = ctx.createGain();
  voice.type = 'sine';
  voice.frequency.setValueAtTime(frequency, now);
  voice.frequency.exponentialRampToValueAtTime(frequency * 1.1, now + 0.08);
  voiceGain.gain.setValueAtTime(0.0001, now);
  voiceGain.gain.linearRampToValueAtTime(0.45, now + 0.02);
  voiceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  voice.connect(voiceGain); voiceGain.connect(getMixBus(ctx));
  voice.start(now); voice.stop(now + 0.24);

  scheduleTone(ctx, frequency * 2, now, 0.18, 0.12, 'triangle', 0.006);
}

// Original OING playGo(): rising C5–C6 fanfare followed by a high sparkle.
export function playGoSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [523, 659, 784, 1046].forEach((frequency, index) => {
    scheduleTone(ctx, frequency, now + index * 0.08, 0.25, 0.3, index === 3 ? 'triangle' : 'sine', 0.02);
  });
  const sparkle = ctx.createOscillator();
  const sparkleGain = ctx.createGain();
  sparkle.type = 'triangle';
  sparkle.frequency.setValueAtTime(2000, now + 0.24);
  sparkle.frequency.exponentialRampToValueAtTime(3500, now + 0.45);
  sparkleGain.gain.setValueAtTime(0.12, now + 0.24);
  sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  sparkle.connect(sparkleGain); sparkleGain.connect(getMixBus(ctx));
  sparkle.start(now + 0.24); sparkle.stop(now + 0.52);
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
    scheduleTone(ctx, frequency, now + index * 0.07, 0.18, 0.13, 'sine', 0.02);
  });
  const sparkle = ctx.createOscillator();
  const sparkleGain = ctx.createGain();
  sparkle.type = 'triangle';
  sparkle.frequency.setValueAtTime(1800, now);
  sparkle.frequency.exponentialRampToValueAtTime(2400, now + 0.12);
  sparkleGain.gain.setValueAtTime(0.032, now);
  sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  sparkle.connect(sparkleGain);
  sparkleGain.connect(getMixBus(ctx));
  sparkle.start(now);
  sparkle.stop(now + 0.18);
}

// Original OING playWow(): three rising major chords and a bright tail.
export function playWideClearSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const chords = [
    [523, 659, 784],
    [587, 740, 880],
    [659, 830, 988],
  ];
  chords.forEach((chord, chordIndex) => {
    chord.forEach((frequency) => {
      scheduleTone(ctx, frequency, now + chordIndex * 0.1, 0.22, 0.078, 'sine', 0.02);
    });
  });
  const sparkle = ctx.createOscillator();
  const sparkleGain = ctx.createGain();
  sparkle.type = 'triangle';
  sparkle.frequency.setValueAtTime(1400, now + 0.28);
  sparkle.frequency.exponentialRampToValueAtTime(3200, now + 0.55);
  sparkleGain.gain.setValueAtTime(0.06, now + 0.28);
  sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  sparkle.connect(sparkleGain); sparkleGain.connect(getMixBus(ctx));
  sparkle.start(now + 0.28); sparkle.stop(now + 0.62);
}

// Original OING playMeow(): the same immediate rising "nyang" glide and mix.
export function playCatBonusSound(startOffset = 0.15) {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime + Math.max(0, Number(startOffset) || 0);

  const voice = ctx.createOscillator();
  const voiceGain = ctx.createGain();
  voice.type = 'sine';
  voice.frequency.setValueAtTime(900, now);
  voice.frequency.exponentialRampToValueAtTime(1400, now + 0.07);
  voice.frequency.exponentialRampToValueAtTime(1100, now + 0.18);
  voiceGain.gain.setValueAtTime(0.0001, now);
  voiceGain.gain.linearRampToValueAtTime(0.19, now + 0.03);
  voiceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  voice.connect(voiceGain); voiceGain.connect(getMixBus(ctx));
  voice.start(now); voice.stop(now + 0.24);

  const harmonic = ctx.createOscillator();
  const harmonicGain = ctx.createGain();
  harmonic.type = 'triangle';
  harmonic.frequency.setValueAtTime(1800, now);
  harmonic.frequency.exponentialRampToValueAtTime(2800, now + 0.07);
  harmonic.frequency.exponentialRampToValueAtTime(2200, now + 0.18);
  harmonicGain.gain.setValueAtTime(0.045, now);
  harmonicGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  harmonic.connect(harmonicGain); harmonicGain.connect(getMixBus(ctx));
  harmonic.start(now); harmonic.stop(now + 0.22);

  const tail = ctx.createOscillator();
  const tailGain = ctx.createGain();
  tail.type = 'sine';
  tail.frequency.setValueAtTime(2600, now + 0.15);
  tail.frequency.exponentialRampToValueAtTime(3200, now + 0.22);
  tailGain.gain.setValueAtTime(0.03, now + 0.15);
  tailGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  tail.connect(tailGain); tailGain.connect(getMixBus(ctx));
  tail.start(now + 0.15); tail.stop(now + 0.26);
}

export function playItemDropSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [783.99, 1046.5, 1318.5].forEach((frequency, index) => {
    scheduleTone(ctx, frequency, now + index * 0.055, 0.16, 0.052 - index * 0.006, 'sine', 0.008);
  });
  scheduleTone(ctx, 2093, now + 0.18, 0.11, 0.016, 'triangle', 0.006);
}

export function playItemCollectSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [880, 1174.66, 1567.98].forEach((frequency, index) => {
    scheduleTone(ctx, frequency, now + index * 0.045, 0.13, 0.065 - index * 0.008, 'sine', 0.007);
  });
  scheduleTone(ctx, 2349.32, now + 0.15, 0.09, 0.022, 'triangle', 0.005);
}

// Original OING playComboUp()/playCombo7() without extra notes or octave lifts.
export function playComboSound(combo) {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  if (combo > 0 && combo % 7 === 0) {
    [1046, 1318, 1568, 2093].forEach((frequency, index) => {
      scheduleTone(ctx, frequency, now + index * 0.07, 0.2, 0.14, 'sine', 0.01);
    });
    return;
  }
  const base = 440 + Math.min(Math.max(combo, 2), 6) * 80;
  [base, base * 1.25].forEach((frequency, index) => {
    scheduleTone(ctx, frequency, now + index * 0.05, 0.15, 0.12, 'sine', 0.001);
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
    source.connect(filter); filter.connect(gain); gain.connect(getMixBus(ctx));
    source.start(start);
  }
}

// Original OING playBomb(): low filtered impact noise plus three bright shards.
export function playBombSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = (Math.random() * 2 - 1) * Math.exp(-index / (ctx.sampleRate * 0.05));
  }
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  gain.gain.setValueAtTime(0.42, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  source.connect(filter); filter.connect(gain); gain.connect(getMixBus(ctx));
  source.start(now);
  [800, 1200, 600].forEach((frequency, index) => {
    scheduleTone(ctx, frequency, now + index * 0.04, 0.12, 0.1, 'sine', 0.005);
  });
}

// Original OING playMegaBomb(): a longer impact with five layered shards.
export function playMegaBombSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = (Math.random() * 2 - 1) * Math.exp(-index / (ctx.sampleRate * 0.07));
  }
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  gain.gain.setValueAtTime(0.62, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
  source.connect(filter); filter.connect(gain); gain.connect(getMixBus(ctx));
  source.start(now);
  [800, 1200, 600, 400, 1600].forEach((frequency, index) => {
    scheduleTone(ctx, frequency, now + index * 0.035, 0.16, 0.12, 'sine', 0.005);
  });
}

// Original OING playClock(): a clear three-note bell.
export function playClockSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [880, 1320, 1760].forEach((frequency, index) => {
    scheduleTone(ctx, frequency, now + index * 0.1, 0.5, 0.19, 'sine', 0.01);
  });
}

// Original OING playFreeze(): six ice shards followed by two clear bells.
export function playFreezeSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (let index = 0; index < 6; index += 1) {
    scheduleTone(ctx, 2000 + Math.random() * 1800, now + index * 0.025, 0.05, 0.055, 'sine', 0.003);
  }
  scheduleTone(ctx, 1760, now + 0.16, 0.35, 0.13, 'sine', 0.008);
  scheduleTone(ctx, 2637, now + 0.2, 0.35, 0.13, 'sine', 0.008);
}

export function playCloverSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [659.25, 880, 1046.5, 1318.5].forEach((frequency, index) => {
    scheduleTone(ctx, frequency, now + index * 0.065, 0.25, index === 3 ? 0.1 : 0.075, 'sine', 0.008);
  });
  scheduleTone(ctx, 2637, now + 0.22, 0.28, 0.045, 'triangle', 0.006);
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

// Original OING playTimeWarnBeeps(): one burst at ten seconds and then
// silence: three groups 0.56s apart, a high 1180Hz lead followed
// by two softer 940Hz taps. Ours used to tick every second with a rising
// pitch, which read as nagging rather than urgent.
export function playTimeWarnBeeps() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (let group = 0; group < 3; group += 1) {
    const base = now + group * 0.56;
    [0, 0.13, 0.26].forEach((offset, index) => {
      scheduleTone(
        ctx,
        index === 0 ? 1180 : 940,
        base + offset,
        0.12,
        index === 0 ? 0.05 : 0.035,
        'sine',
        0.025,
      );
    });
  }
}

export function playCountdownTick(seconds) {
  const remaining = Math.min(Math.max(Math.ceil(Number(seconds) || 0), 1), 10);
  const urgent = remaining <= 3;
  const frequency = urgent ? 1080 + (3 - remaining) * 110 : 760 + (10 - remaining) * 24;
  tone(frequency, 0, urgent ? 0.085 : 0.055, urgent ? 0.055 : 0.026, 'triangle');
  if (urgent) tone(frequency * 1.25, 0.055, 0.07, 0.032, 'sine');
}

export function playGameOverSound(newRecord = false) {
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
  sparkleGain.connect(getMixBus(ctx));
  sparkle.start(now + 0.6);
  sparkle.stop(now + 1.25);

  if (newRecord) {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      scheduleTone(ctx, frequency, now + 0.76 + index * 0.075, 0.34, index === 3 ? 0.045 : 0.028, 'sine', 0.012);
    });
  }
}
