import test from 'node:test';
import assert from 'node:assert/strict';

import { translateEnglishText } from '../js/i18n.js';

test('core game labels have concise English translations', () => {
  assert.equal(translateEnglishText('시작하기'), 'Play');
  assert.equal(translateEnglishText('내오잉'), 'My OING');
  assert.equal(translateEnglishText('길게 누르면 친구 등록 · 다시 길게 누르면 해제'),
    'Press and hold to add or remove a friend');
});

test('dynamic score and ranking copy keeps its values', () => {
  assert.equal(translateEnglishText('4,580점'), '4,580 pts');
  assert.equal(translateEnglishText('3위'), 'Rank 3');
  assert.equal(translateEnglishText('960점 남았다냥!'), '960 pts to go!');
  assert.equal(translateEnglishText('첫 목표 1,000점'), 'First goal: 1,000 pts');
  assert.equal(translateEnglishText('시간 10초 멈춤!'), 'TIME FROZEN FOR 10 SEC!');
  assert.equal(translateEnglishText('여름구슬 · 195점 도전!'), '여름구슬 · BEAT 195 PTS!');
  assert.equal(translateEnglishText('한 판 4,000점 (0/4,000)'), 'Score 4,000 in one run (0/4,000)');
});

test('unknown cat chatter never leaks Korean into the English game', () => {
  assert.equal(translateEnglishText('오늘 감각이 정말 좋다냥 🐱'), 'Nice run! Keep going, meow! 🐱');
});
