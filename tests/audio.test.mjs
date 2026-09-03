import assert from 'node:assert/strict';
import test from 'node:test';

class AudioParamMock {
  constructor() {
    this.value = 0;
    this.events = [];
  }

  record(kind, value, time) {
    this.value = value;
    this.events.push({ kind, value, time });
  }

  setValueAtTime(value, time) { this.record('set', value, time); }
  linearRampToValueAtTime(value, time) { this.record('linear', value, time); }
  exponentialRampToValueAtTime(value, time) { this.record('exponential', value, time); }
}

class NodeMock {
  connect() { return this; }
}

class OscillatorMock extends NodeMock {
  constructor() {
    super();
    this.type = 'sine';
    this.frequency = new AudioParamMock();
  }

  start(time) { this.startTime = time; }
  stop(time) { this.stopTime = time; }
}

class GainMock extends NodeMock {
  constructor() {
    super();
    this.gain = new AudioParamMock();
  }
}

class BufferSourceMock extends NodeMock {
  start(time) { this.startTime = time; }
}

class BiquadFilterMock extends NodeMock {
  constructor() {
    super();
    this.type = 'lowpass';
    this.frequency = new AudioParamMock();
  }
}

class AudioContextMock {
  constructor() {
    AudioContextMock.latest = this;
    this.currentTime = 10;
    this.state = 'running';
    this.destination = new NodeMock();
    this.oscillators = [];
    this.sampleRate = 48000;
    this.bufferSources = [];
  }

  createOscillator() {
    const oscillator = new OscillatorMock();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain() { return new GainMock(); }
  createBuffer(_channels, length) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    const source = new BufferSourceMock();
    this.bufferSources.push(source);
    return source;
  }
  createBiquadFilter() { return new BiquadFilterMock(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
}

globalThis.window = { AudioContext: AudioContextMock };
const audio = await import('../js/audio.js');

function newOscillators(action) {
  const ctx = AudioContextMock.latest;
  const before = ctx?.oscillators.length ?? 0;
  action();
  return AudioContextMock.latest.oscillators.slice(before);
}

test('success sound keeps the original OING note sequence', () => {
  const oscillators = newOscillators(() => audio.playSuccessSound());
  assert.deepEqual(oscillators.slice(0, 3).map((item) => item.frequency.events[0].value), [523.25, 622.25, 783.99]);
  assert.equal(oscillators[3].type, 'triangle');
  assert.equal(oscillators[3].frequency.events[0].value, 1800);
});

test('wide clear keeps the original OING WOW chord rise', () => {
  const oscillators = newOscillators(() => audio.playWideClearSound());
  assert.deepEqual(oscillators.slice(0, 9).map((item) => item.frequency.events[0].value), [523, 659, 784, 587, 740, 880, 659, 830, 988]);
  assert.equal(oscillators.at(-1).type, 'triangle');
  assert.deepEqual(oscillators.at(-1).frequency.events.map((event) => event.value), [1400, 3200]);
});

test('cat bonus keeps the original OING rising meow glide', () => {
  const oscillators = newOscillators(() => audio.playCatBonusSound());
  assert.equal(oscillators.length, 3);
  assert.deepEqual(oscillators[0].frequency.events.map((event) => event.value), [900, 1400, 1100]);
  assert.deepEqual(oscillators[1].frequency.events.map((event) => event.value), [1800, 2800, 2200]);
  assert.deepEqual(oscillators[2].frequency.events.map((event) => event.value), [2600, 3200]);
});

test('item drop uses a bright compact reward flourish', () => {
  const oscillators = newOscillators(() => audio.playItemDropSound());
  assert.deepEqual(oscillators.map((item) => item.frequency.events[0].value), [783.99, 1046.5, 1318.5, 2093]);
  assert.equal(oscillators.at(-1).type, 'triangle');
});

test('item collection confirms the inventory arrival with a separate rising chime', () => {
  const oscillators = newOscillators(() => audio.playItemCollectSound());
  assert.deepEqual(oscillators.map((item) => item.frequency.events[0].value), [880, 1174.66, 1567.98, 2349.32]);
  assert.equal(oscillators.at(-1).type, 'triangle');
});

test('start sound confirms mobile audio unlock with a short two-note cue', async () => {
  assert.equal(await audio.unlockAudio(), true);
  const oscillators = newOscillators(() => audio.playStartSound());
  assert.deepEqual(oscillators.map((item) => item.frequency.events[0].value), [659.25, 880]);
});

test('ready count reuses the original rising 3 2 1 pitch steps', () => {
  const three = newOscillators(() => audio.playReadyCountSound(3));
  const two = newOscillators(() => audio.playReadyCountSound(2));
  const one = newOscillators(() => audio.playReadyCountSound(1));
  assert.deepEqual(three.map((item) => item.frequency.events[0].value), [400, 800]);
  assert.deepEqual(two.map((item) => item.frequency.events[0].value), [520, 1040]);
  assert.deepEqual(one.map((item) => item.frequency.events[0].value), [640, 1280]);
});

test('go sound keeps the original rising fanfare and sparkle glide', () => {
  const oscillators = newOscillators(() => audio.playGoSound());
  assert.deepEqual(oscillators.slice(0, 4).map((item) => item.frequency.events[0].value), [523, 659, 784, 1046]);
  assert.deepEqual(oscillators.at(-1).frequency.events.map((event) => event.value), [2000, 3500]);
});

test('a growing classic board extends the normal clear chime by one step', () => {
  const oscillators = newOscillators(() => audio.playBoardGrowSound());
  assert.deepEqual(
    oscillators.slice(0, 6).map((item) => item.frequency.events[0].value),
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568],
  );
  assert.equal(oscillators.at(-1).type, 'triangle');
  assert.deepEqual(oscillators.at(-1).frequency.events.map((event) => event.value), [1800, 3600]);
});

test('combo sound keeps two notes normally and reserves the original fanfare for multiples of seven', () => {
  const combo2 = newOscillators(() => audio.playComboSound(2));
  const combo5 = newOscillators(() => audio.playComboSound(5));
  const combo7 = newOscillators(() => audio.playComboSound(7));
  const combo8 = newOscillators(() => audio.playComboSound(8));
  assert.deepEqual(combo2.map((item) => item.frequency.events[0].value), [600, 750]);
  assert.deepEqual(combo5.map((item) => item.frequency.events[0].value), [840, 1050]);
  assert.deepEqual(combo7.map((item) => item.frequency.events[0].value), [1046, 1318, 1568, 2093]);
  assert.deepEqual(combo8.map((item) => item.frequency.events[0].value), [920, 1150]);
});

test('final countdown grows brighter for the last three seconds', () => {
  const second10 = newOscillators(() => audio.playCountdownTick(10));
  const second3 = newOscillators(() => audio.playCountdownTick(3));
  const second1 = newOscillators(() => audio.playCountdownTick(1));
  assert.equal(second10.length, 1);
  assert.equal(second3.length, 2);
  assert.equal(second1.length, 2);
  assert.ok(second1[0].frequency.events[0].value > second3[0].frequency.events[0].value);
});

test('game over keeps the original layered six-note fanfare and sparkle', () => {
  const oscillators = newOscillators(() => audio.playGameOverSound());
  assert.equal(oscillators.length, 13);
  assert.deepEqual(oscillators.slice(0, 12).map((item) => item.frequency.events[0].value), [392, 392, 523, 523, 659, 659, 784, 784, 659, 659, 784, 784]);
  assert.equal(oscillators.at(-1).type, 'triangle');
  assert.equal(oscillators.at(-1).frequency.events[0].value, 1200);
});

test('a new record adds a restrained four-note victory tail', () => {
  const oscillators = newOscillators(() => audio.playGameOverSound(true));
  assert.equal(oscillators.length, 17);
  assert.deepEqual(oscillators.slice(-4).map((item) => item.frequency.events[0].value), [523.25, 659.25, 783.99, 1046.5]);
});

test('bomb sound keeps the previous OING impact', () => {
  const before = AudioContextMock.latest.bufferSources.length;
  const oscillators = newOscillators(() => audio.playBombSound());
  assert.deepEqual(oscillators.map((item) => item.frequency.events[0].value), [800, 1200, 600]);
  assert.equal(AudioContextMock.latest.bufferSources.length, before + 1);
});

test('mega bomb sound keeps the previous OING impact', () => {
  const before = AudioContextMock.latest.bufferSources.length;
  const oscillators = newOscillators(() => audio.playMegaBombSound());
  assert.deepEqual(oscillators.map((item) => item.frequency.events[0].value), [800, 1200, 600, 400, 1600]);
  assert.equal(AudioContextMock.latest.bufferSources.length, before + 1);
});

test('clock sound keeps the original OING three-note bell', () => {
  const oscillators = newOscillators(() => audio.playClockSound());
  assert.deepEqual(oscillators.map((item) => item.frequency.events[0].value), [880, 1320, 1760]);
});

test('time freeze keeps the original OING ice shards and closing bells', () => {
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  try {
    const oscillators = newOscillators(() => audio.playFreezeSound());
    assert.equal(oscillators.length, 8);
    assert.deepEqual(oscillators.slice(0, 6).map((item) => item.frequency.events[0].value), Array(6).fill(2900));
    assert.deepEqual(oscillators.slice(6).map((item) => item.frequency.events[0].value), [1760, 2637]);
  } finally {
    Math.random = originalRandom;
  }
});

test('clover sound uses the chosen warm four-note flourish', () => {
  const oscillators = newOscillators(() => audio.playCloverSound());
  assert.deepEqual(oscillators.map((item) => item.frequency.events[0].value), [392, 523, 659, 784]);
  assert.equal(oscillators.at(-1).type, 'triangle');
});

test('hint and shuffle use the chosen lower soft cues', () => {
  const hint = newOscillators(() => audio.playHintSound());
  assert.deepEqual(hint.map((item) => item.frequency.events[0].value), [392, 523, 659]);
  const before = AudioContextMock.latest.bufferSources.length;
  const shuffle = newOscillators(() => audio.playShuffleSound());
  assert.deepEqual(shuffle.map((item) => item.frequency.events[0].value), [440]);
  assert.deepEqual(shuffle[0].frequency.events.map((event) => event.value), [440, 587]);
  assert.equal(AudioContextMock.latest.bufferSources.length, before + 2);
});
