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

function tone(frequency, startOffset, duration, volume = 0.1, type = 'sine') {
  const ctx = getContext();
  if (!ctx) return;
  const start = ctx.currentTime + startOffset;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0008, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
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

export function playSuccessSound(combo = 1) {
  const lift = Math.min(combo, 8) * 18;
  [523.25, 622.25, 783.99].forEach((frequency, index) => {
    tone(frequency + lift, index * 0.055, 0.17, 0.11, 'sine');
  });
  tone(1850 + lift * 2, 0.03, 0.12, 0.035, 'triangle');
}

export function playComboSound(combo) {
  const notes = combo >= 8
    ? [1046, 1318, 1568, 2093]
    : combo >= 5
      ? [784, 988, 1318]
      : [659, 830];
  notes.forEach((frequency, index) => tone(frequency, index * 0.055, 0.19, 0.105, 'sine'));
}

export function playFailSound() {
  tone(520, 0, 0.09, 0.09, 'triangle');
  tone(520, 0.09, 0.09, 0.09, 'triangle');
}

export function playHintSound() {
  [600, 800, 1000, 1400].forEach((frequency, index) => tone(frequency, index * 0.055, 0.14, 0.085, 'triangle'));
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
    filter.frequency.value = 2450 + pass * 650;
    gain.gain.setValueAtTime(0.055, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    source.start(start);
  }
}

export function playRoundClearSound() {
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => tone(frequency, index * 0.07, 0.27, index === 3 ? 0.16 : 0.11));
  tone(2093, 0.3, 0.18, 0.05);
}

export function playGameOverSound() {
  [392, 523, 659, 784].forEach((frequency, index) => tone(frequency, index * 0.105, index === 3 ? 0.42 : 0.16, 0.08, 'sine'));
}
