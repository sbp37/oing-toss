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

class AudioContextMock {
  constructor() {
    AudioContextMock.latest = this;
    this.currentTime = 10;
    this.state = 'running';
    this.destination = new NodeMock();
    this.oscillators = [];
  }

  createOscillator() {
    const oscillator = new OscillatorMock();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain() { return new GainMock(); }
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

test('combo sound rises with the chain and uses the high milestone arpeggio', () => {
  const combo2 = newOscillators(() => audio.playComboSound(2));
  const combo5 = newOscillators(() => audio.playComboSound(5));
  const combo8 = newOscillators(() => audio.playComboSound(8));
  assert.deepEqual(combo2.map((item) => item.frequency.events[0].value), [600, 750]);
  assert.deepEqual(combo5.map((item) => item.frequency.events[0].value), [840, 1050]);
  assert.deepEqual(combo8.map((item) => item.frequency.events[0].value), [1046, 1318, 1568, 2093]);
});

test('game over keeps the original layered six-note fanfare and sparkle', () => {
  const oscillators = newOscillators(() => audio.playGameOverSound());
  assert.equal(oscillators.length, 13);
  assert.deepEqual(oscillators.slice(0, 12).map((item) => item.frequency.events[0].value), [392, 392, 523, 523, 659, 659, 784, 784, 659, 659, 784, 784]);
  assert.equal(oscillators.at(-1).type, 'triangle');
  assert.equal(oscillators.at(-1).frequency.events[0].value, 1200);
});
