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

const BLOCKED_NICKNAME_PATTERNS = Object.freeze([
  /시이*발|씨이*발|씨빨|씹|좆|존나|조까/,
  /개새|개세|새끼|병신|지랄|꺼져|닥쳐|엿먹/,
  /애미|느금마|창녀|한남|한녀|맘충|일베/,
  /보지|자지|섹스/,
  /fuck|shit|bitch|cunt|dick|pussy|sex/i,
  /ㅅㅂ|ㅆㅂ|ㅂㅅ|ㅈㄹ|ㅈㄴ|ㄱㅅㄲ|ㅅㄲ/,
  /운영자|운영진|관리자|오잉팀|토스팀|admin|staff/i,
]);

function nicknameModerationForms(value) {
  const normalized = String(value || '').trim().normalize('NFKC').toLowerCase();
  // 닉네임에는 구분 기호를 허용하지 않지만 숫자는 허용한다. 숫자를 글자
  // 사이에 넣는 우회와 sh1t 같은 영문 치환을 따로 검사한다.
  const withoutDigits = normalized.replace(/[0-9]/g, '');
  const latinLeet = normalized
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't');
  const collapse = (text) => text.replace(/(.)\1+/gu, '$1');
  const foldJamo = (text) => text.replace(/[ᄀᄁᄂᄇᄉᄊᄌᄅ]/g, (jamo) => ({
    ᄀ: 'ㄱ', ᄁ: 'ㄲ', ᄂ: 'ㄴ', ᄇ: 'ㅂ', ᄉ: 'ㅅ', ᄊ: 'ㅆ', ᄌ: 'ㅈ', ᄅ: 'ㄹ',
  })[jamo]);
  return [...new Set([
    normalized, withoutDigits, latinLeet,
    foldJamo(normalized), foldJamo(withoutDigits),
    collapse(foldJamo(withoutDigits)), collapse(latinLeet),
  ])];
}

export function nicknameReason(value) {
  const nickname = String(value || '').trim().normalize('NFKC');
  const length = Array.from(nickname).length;
  if (length < 2 || length > 6) return 'nickname-length';
  if (!/^[\p{Script=Hangul}A-Za-z0-9]+$/u.test(nickname)) return 'nickname-characters';
  if (/(https?|www|\.com|\.kr|\d{8,})/i.test(nickname)) return 'nickname-contact';
  if (nicknameModerationForms(nickname).some((form) => BLOCKED_NICKNAME_PATTERNS.some((pattern) => pattern.test(form)))) {
    return 'nickname-blocked';
  }
  return '';
}
