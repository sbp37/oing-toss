import { getSharedAudioContext, holdAudioContext } from './audio.js';

let musicAudio = null;
let musicContext = null;
let musicGain = null;
let fadeTimer = null;
let duckTimer = null;
let enabled = false;
let volume = 0.4;
let gameActive = false;
let holding = false;

const targetGain = () => (volume > 0 ? volume * volume : 0);

function ensureRouting() {
  if (musicGain || !musicAudio) return;
  try {
    // One context for the whole app: a second one doubles the audio thread's
    // standing cost for nothing, since both ends want the same destination.
    musicContext = getSharedAudioContext();
    if (!musicContext) return;
    const source = musicContext.createMediaElementSource(musicAudio);
    musicGain = musicContext.createGain();
    musicGain.gain.value = targetGain();
    source.connect(musicGain);
    musicGain.connect(musicContext.destination);
    musicAudio.volume = 1;
  } catch {
    musicContext = null;
    musicGain = null;
    musicAudio.volume = targetGain();
  }
}

// The context is shared now, so music asks for it to be held open rather than
// resuming and suspending it behind the sound effects' back.
function resumeContext() {
  if (holding) return;
  holding = true;
  holdAudioContext(true);
}

function suspendContext() {
  if (!holding) return;
  holding = false;
  holdAudioContext(false);
}

function applyGain(value = targetGain()) {
  if (musicGain) musicGain.gain.value = value;
  else if (musicAudio) musicAudio.volume = value;
}

export function duckMusic(duration = 360, ratio = 0.62) {
  if (!enabled || !gameActive || !musicAudio || musicAudio.paused) return;
  const hold = Math.max(120, Number(duration) || 360);
  const depth = Math.max(0.28, Math.min(0.9, Number(ratio) || 0.62));
  const normal = targetGain();
  clearTimeout(duckTimer);
  if (musicGain && musicContext) {
    const now = musicContext.currentTime;
    musicGain.gain.cancelScheduledValues?.(now);
    musicGain.gain.setValueAtTime(musicGain.gain.value, now);
    musicGain.gain.linearRampToValueAtTime(normal * depth, now + 0.045);
    musicGain.gain.linearRampToValueAtTime(normal, now + hold / 1000);
  } else {
    applyGain(normal * depth);
    duckTimer = setTimeout(() => applyGain(normal), hold);
  }
}

export function configureMusic(audioElement, settings = {}) {
  musicAudio = audioElement;
  enabled = Boolean(settings.enabled);
  volume = Math.max(0, Math.min(1, Number(settings.volume) || 0));
  if (!musicAudio) return;
  // 'metadata' on a 2.5MB mp3 is not cheap: with no range support the browser
  // pulls the whole file, so the home screen was spending its bandwidth on
  // music nobody has asked to hear yet while the art queued behind it.
  // prepareMusic() flips this to 'auto' and load()s at the first tap, which is
  // the only moment the data is actually needed.
  musicAudio.preload = 'none';
  applyGain();
}

export function prepareMusic() {
  if (!enabled || !musicAudio || volume <= 0) return;
  musicAudio.preload = 'auto';
  musicAudio.load();
  ensureRouting();
  resumeContext();
}

// Mobile browsers often require the media element itself to play during the
// original tap. Prime it silently here so the delayed GO cue can start BGM.
export async function unlockMusic() {
  if (!enabled || !musicAudio || volume <= 0) return false;
  prepareMusic();
  if (gameActive) {
    try {
      await musicAudio.play();
      return true;
    } catch {
      return false;
    }
  }
  const wasMuted = Boolean(musicAudio.muted);
  try {
    musicAudio.muted = true;
    await musicAudio.play();
    musicAudio.pause();
    musicAudio.currentTime = 0;
    musicAudio.muted = wasMuted;
    return true;
  } catch {
    musicAudio.muted = wasMuted;
    return false;
  }
}

// 재생이 거부됐을 때 다시 붙잡기 위한 것. 두 번 걸지 않도록 들고 있는다.
let retryTimer = null;
let retryOnTap = null;

function clearMusicRetry() {
  if (retryTimer !== null) { clearTimeout(retryTimer); retryTimer = null; }
  if (retryOnTap) {
    window.removeEventListener('pointerdown', retryOnTap, true);
    retryOnTap = null;
  }
}

export function playMusic({ restart = false } = {}) {
  gameActive = true;
  if (!enabled || !musicAudio || volume <= 0) return;
  ensureRouting();
  resumeContext();
  clearInterval(fadeTimer);
  fadeTimer = null;
  clearMusicRetry();
  applyGain();
  if (restart) musicAudio.currentTime = 0;
  // 이 자리는 광고가 끝난 직후에도 불린다(game.js runRewardedAd의 finally).
  // 전체화면 영상 광고는 오디오 포커스를 가져가고, 돌려받는 순간의 play()가
  // 거부되는 일이 모바일에서 흔하다. 예전에는 실패를 통째로 삼켜서, 광고를
  // 한 번 보면 그 판의 남은 시간 동안 음악이 조용히 사라졌다 - 실기기에서
  // "광고 뒤에 게임이 끊겼다 다시 시작하는 느낌"으로 읽힌다.
  //
  // 그래서 두 번 더 붙잡는다. 잠깐 뒤에 한 번(포커스가 돌아오는 데 시간이
  // 걸린다), 그래도 안 되면 다음 손가락이 닿을 때 한 번. 뒤엣것은 정책상
  // 몸짓이 있어야만 재생이 되는 기기를 위한 것이다.
  //
  // 이어서 트는 것이지 처음부터 트는 게 아니다 - currentTime을 안 건드리므로
  // 광고 전에 듣던 자리에서 그대로 이어진다.
  musicAudio.play().catch(() => {
    if (!gameActive || !enabled) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!gameActive || !enabled || !musicAudio || !musicAudio.paused) return;
      musicAudio.play().catch(() => {
        if (!gameActive || retryOnTap) return;
        retryOnTap = () => {
          clearMusicRetry();
          if (gameActive && enabled && musicAudio?.paused) musicAudio.play().catch(() => {});
        };
        window.addEventListener('pointerdown', retryOnTap, true);
      });
    }, 400);
  });
}

export function pauseMusic() {
  if (!musicAudio) return;
  clearTimeout(duckTimer);
  duckTimer = null;
  clearMusicRetry();
  musicAudio.pause();
  suspendContext();
}

export function stopMusic() {
  gameActive = false;
  clearMusicRetry();
  clearInterval(fadeTimer);
  clearTimeout(duckTimer);
  duckTimer = null;
  fadeTimer = null;
  if (musicAudio) {
    musicAudio.pause();
    musicAudio.currentTime = 0;
  }
  applyGain();
  suspendContext();
}

export function fadeOutMusic(duration = 1100) {
  gameActive = false;
  clearTimeout(duckTimer);
  duckTimer = null;
  if (!musicAudio || musicAudio.paused) {
    stopMusic();
    return;
  }
  clearInterval(fadeTimer);
  const start = musicGain ? musicGain.gain.value : musicAudio.volume;
  const steps = 22;
  let step = 0;
  fadeTimer = setInterval(() => {
    step += 1;
    applyGain(Math.max(0, start * (1 - step / steps)));
    if (step >= steps) {
      clearInterval(fadeTimer);
      fadeTimer = null;
      musicAudio.pause();
      musicAudio.currentTime = 0;
      applyGain();
      suspendContext();
    }
  }, duration / steps);
}

export function setMusicEnabled(value) {
  enabled = Boolean(value);
  if (enabled) {
    if (gameActive) {
      prepareMusic();
      playMusic();
    } else if (musicAudio) {
      musicAudio.preload = 'none';
    }
  } else {
    pauseMusic();
  }
}

export function setMusicVolume(value) {
  const wasSilent = volume <= 0;
  volume = Math.max(0, Math.min(1, Number(value) || 0));
  applyGain();
  if (volume <= 0) pauseMusic();
  else if (wasSilent && enabled && gameActive) playMusic();
}

export function isMusicEnabled() {
  return enabled;
}

export function getMusicVolume() {
  return volume;
}
