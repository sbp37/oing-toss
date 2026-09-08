export function createNicknamePromptGate(storage, key = 'oing_nickname_result_prompt_v1') {
  let shown = false;
  try { shown = storage?.getItem(key) === 'shown'; } catch {}
  return {
    shouldShow(player) { return !shown && player?.nicknameCustomized === false; },
    markShown() {
      shown = true;
      try { storage?.setItem(key, 'shown'); } catch {}
    },
  };
}
