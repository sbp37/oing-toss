export const NICKNAME_CHANGE_MS = 7 * 24 * 60 * 60 * 1000;

export function nicknameClaimKey(value) {
  return String(value || '').trim().normalize('NFKC').toLowerCase();
}

export function nicknameChangeAvailableAtMs(player = {}) {
  const changedAt = player.nicknameChangedAt?.toMillis?.()
    || player.nicknameChangedAt?.toDate?.()?.getTime?.()
    || new Date(player.nicknameChangedAt || 0).getTime();
  if (Number.isFinite(changedAt) && changedAt > 0) return changedAt + NICKNAME_CHANGE_MS;
  return player.nicknameChangeAvailableAt?.toMillis?.()
    || player.nicknameChangeAvailableAt?.toDate?.()?.getTime?.()
    || new Date(player.nicknameChangeAvailableAt || 0).getTime();
}

const AUTOMATIC_PREFIXES = Object.freeze([
  '햇살', '노을', '새벽', '달빛', '별빛', '구름', '하늘', '바다',
  '민트', '복숭', '라일락', '단풍', '눈꽃', '봄날', '여름', '겨울',
  '포근', '말랑', '몽글', '반짝', '살랑', '방울', '도토리', '모카',
  '크림', '치즈', '자두', '보리', '호두', '라떼', '코코', '솜사탕',
]);

const AUTOMATIC_SUFFIXES = Object.freeze([
  '젤리', '꼬리', '수염', '발바닥', '콩', '솜', '별', '달',
  '꽃', '구슬', '리본', '쿠키', '사탕', '푸딩', '마카롱', '토끼',
  '여우', '다람쥐', '꿈', '바람', '나비', '보석', '하트', '미소',
  '깡총', '총총', '쪼꼬', '두부', '송이', '루루', '모모', '냥',
]);

export function automaticNickname(providerKey) {
  const key = String(providerKey || '').padEnd(16, '0');
  const prefixIndex = Number.parseInt(key.slice(0, 8), 16) % AUTOMATIC_PREFIXES.length;
  const suffixIndex = Number.parseInt(key.slice(8, 16), 16) % AUTOMATIC_SUFFIXES.length;
  return `${AUTOMATIC_PREFIXES[prefixIndex]}${AUTOMATIC_SUFFIXES[suffixIndex]}`;
}

export function isLegacyAutomaticNickname(value) {
  // `오잉이` is the owner's chosen nickname, not an automatic placeholder.
  return /^(?:오잉냥\d{1,4}|새싹냥\d{1,4}|OINGTEMP)$/i.test(String(value || '').trim());
}

export function nicknameReason(value) {
  const nickname = String(value || '').trim();
  const length = Array.from(nickname).length;
  if (length < 2 || length > 6) return 'nickname-length';
  if (!/^[\p{Script=Hangul}A-Za-z0-9]+$/u.test(nickname)) return 'nickname-characters';
  if (/(https?|www|\.com|\.kr|\d{8,})/i.test(nickname)) return 'nickname-contact';
  if (/(시발|씨발|개새|병신|fuck|sex|운영자|관리자)/i.test(nickname)) return 'nickname-blocked';
  return '';
}
