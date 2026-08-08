let musicAudio = null;
let musicContext = null;
let musicGain = null;
let fadeTimer = null;
let duckTimer = null;
let enabled = false;
let volume = 0.4;
let gameActive = false;

const targetGain = () => (volume > 0 ? volume * volume : 0);

function ensureRouting() {
  if (musicGain || !musicAudio) return;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    musicContext = new Context();
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

function resumeContext() {
  if (musicContext?.state === 'suspended') musicContext.resume().catch(() => {});
}

function suspendContext() {
  if (musicContext?.state === 'running') musicContext.suspend().catch(() => {});
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
  musicAudio.preload = enabled ? 'metadata' : 'none';
  applyGain();
}

export function prepareMusic() {
  if (!enabled || !musicAudio || volume <= 0) return;
  musicAudio.preload = 'auto';
  musicAudio.load();
  ensureRouting();
  resumeContext();
}

export function playMusic({ restart = false } = {}) {
  gameActive = true;
  if (!enabled || !musicAudio || volume <= 0) return;
  ensureRouting();
  resumeContext();
  clearInterval(fadeTimer);
  fadeTimer = null;
  applyGain();
  if (restart) musicAudio.currentTime = 0;
  musicAudio.play().catch(() => {});
}

export function pauseMusic() {
  if (!musicAudio) return;
  clearTimeout(duckTimer);
  duckTimer = null;
  musicAudio.pause();
  suspendContext();
}

export function stopMusic() {
  gameActive = false;
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
      musicAudio.preload = 'metadata';
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
