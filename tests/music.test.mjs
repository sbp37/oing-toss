import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = {};

const music = await import('../js/music.js');

test('music ducks under important effects and returns to the selected level', async () => {
  const audio = {
    currentTime: 4,
    paused: true,
    preload: 'none',
    volume: 1,
    load() {},
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
  };

  music.configureMusic(audio, { enabled: true, volume: 0.5 });
  music.playMusic();
  assert.equal(audio.volume, 0.25);
  assert.equal(audio.paused, false);

  music.duckMusic(120, 0.5);
  assert.equal(audio.volume, 0.125);
  await new Promise((resolve) => setTimeout(resolve, 145));
  assert.equal(audio.volume, 0.25);

  music.stopMusic();
  assert.equal(audio.paused, true);
  assert.equal(audio.currentTime, 0);
});
