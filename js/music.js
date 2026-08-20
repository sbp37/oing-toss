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
