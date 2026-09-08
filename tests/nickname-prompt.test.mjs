import test from 'node:test';
import assert from 'node:assert/strict';
import { createNicknamePromptGate } from '../js/nickname-prompt.js';
import { readFileSync } from 'node:fs';

test('only a confirmed automatic nickname receives the one-time result prompt', () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const gate = createNicknamePromptGate(storage);
  assert.equal(gate.shouldShow(null), false);
  assert.equal(gate.shouldShow({ nickname: '오잉이' }), false);
  assert.equal(gate.shouldShow({ nicknameCustomized: true }), false);
  assert.equal(gate.shouldShow({ nicknameCustomized: false }), true);
  gate.markShown();
  assert.equal(gate.shouldShow({ nicknameCustomized: false }), false);
  assert.equal(createNicknamePromptGate(storage).shouldShow({ nicknameCustomized: false }), false);
});

test('blocked storage still suppresses repeat prompts in this session', () => {
  const gate = createNicknamePromptGate({ getItem() { throw Error(); }, setItem() { throw Error(); } });
  gate.markShown();
  assert.equal(gate.shouldShow({ nicknameCustomized: false }), false);
});

test('result prompt respects run lifetime and saving preserves entered names on failure', () => {
  const source = readFileSync(new URL('../js/game.js', import.meta.url), 'utf8');
  const prompt = source.slice(source.indexOf('  async showNicknameAfterResult'), source.indexOf('  async saveNickname'));
  assert.match(prompt, /runId !== this.activeOnlineRunId/);
  assert.match(prompt, /this.state.running/);
  assert.match(prompt, /result-screen/);
  assert.match(prompt, /openNicknameEditor[\s\S]*markShown/);
  assert.match(source, /showInterstitialAfterResult\(\)\.then\(\(\) => this.showNicknameAfterResult/);
  const save = source.slice(source.indexOf('  async saveNickname'), source.indexOf('  async refreshOingLeaderboard'));
  assert.match(save, /if \(this.nicknameSaving\) return/);
  assert.ok(save.indexOf('if (!result.ok)') < save.indexOf('this.closeNicknameEditor()'));
  assert.doesNotMatch(save, /input\.value\s*=/);
});
