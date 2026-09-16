const requestedLanguage = new URLSearchParams(globalThis.location?.search || '').get('lang');
const deviceLanguage = String(globalThis.navigator?.language || 'ko').toLowerCase();

export const language = requestedLanguage === 'ko' || requestedLanguage === 'en'
  ? requestedLanguage
  : (deviceLanguage.startsWith('ko') ? 'ko' : 'en');
export const isEnglish = language === 'en';
export const numberLocale = isEnglish ? 'en-US' : 'ko-KR';

const EN = new Map(Object.entries({
  '오잉': 'OING',
  '홈': 'Home',
  '설정': 'Settings',
  '닫기': 'Close',
  '업데이트': 'Updates',
  '시작하기': 'Play',
  '랭킹': 'Ranking',
  '내오잉': 'My OING',
  '내 정원': 'My Garden',
  '최고점수': 'Best Score',
  '첫 목표': 'First Goal',
  '이번 버전 최고': 'Version Best',
  '친구의 기록': "Friend's Score",
  '사각형': 'Rectangle',
  '으로 묶어서 합이': ' — drag numbers, sum ',
  '이면, 뿅!': ' = POP!',
  '오잉!': 'OING!',
  '판': 'ROUND',
  '점': 'PTS',
  '점수': 'SCORE',
  '콤보': 'COMBO',
  '최고': 'BEST',
  '목표': 'GOAL',
  '합': 'SUM',
  '준비!': 'READY!',
  '합이 10이면': 'MAKE 10',
  '슥 묶어서 10!': 'DRAG TO MAKE 10!',
  '힌트': 'Hint',
  '섞기': 'Shuffle',
  '폭탄': 'Bomb',
  '시계': 'Clock',
  '이번 판 기록': 'RUN RESULT',
  '게임 플레이': 'Gameplay',
  '게임 결과': 'Game Result',
  '일시정지': 'Pause',
  '남은 시간': 'Time Remaining',
  '시간': 'TIME',
  '없다냥!': "'S UP!",
  '소진': 'EMPTY',
  '잠금': 'LOCKED',
  '상대': 'RIVAL',
  '빨리빨리!': 'HURRY!',
  '시간 없다냥!': "TIME'S UP!",
  '10초 남았어!': '10 SECONDS LEFT!',
  '서둘러라냥!': 'HURRY, MEOW!',
  '준비됐으면 바로 가자!': "READY? LET'S GO!",
  '깔끔했다!': 'NICE CLEAR!',
  '현재 게임 상태': 'Current Game Status',
  '숫자 보드': 'Number Board',
  '공유하기': 'Share',
  '진행한 판': 'Rounds Played',
  '도달 스테이지': 'Stage Reached',
  '최고 콤보': 'Best Combo',
  '새 그림 보기': 'View New Scene',
  '한 판 더!': 'Play Again!',
  '홈으로': 'Home',
  '홈으로 나가기': 'Exit to Home',
  '내 기록 보기': 'View My Record',
  '결과 보기': 'View Result',
  '결과로 돌아가기': 'Back to Result',
  '남은 답 보기': 'See Remaining Answers',
  '랭킹 등록 다시 시도': 'Retry Ranking Upload',
  '화면을 누르면 계속': 'Tap to Continue',
  '잠깐 쉬어가자': 'Taking a Break',
  '시간도 같이 멈췄어': 'The timer is paused too',
  '계속하기': 'Continue',
  '음악': 'Music',
  '효과음': 'Sound',
  '다시 시작': 'Restart',
  '방법': 'How to Play',
  '10 만드는 법': 'How to Make 10',
  '시작 칸에서 반대쪽 칸까지 드래그': 'Drag from one corner to the opposite corner',
  '네모 안의 모든 숫자를 더해봐': 'Add every number inside the rectangle',
  '합이 10이면 바로 뿅!': 'If the sum is 10, they pop!',
  '빈칸은 0': 'Empty cells count as 0',
  '양 끝 칸을 차례로 눌러도 돼': 'You can also tap two opposite corners',
  '고양이 칸도 0': 'Cat cells count as 0',
  '함께 지우면 보너스 점수를 받아!': 'Clear one with your match for bonus points!',
  '알겠어, 계속할게!': 'Got It!',
  '내 취향에 맞춰보자냥!': 'Make the game feel just right!',
  '배경음악': 'Music',
  '진동': 'Haptics',
  '진동 설정': 'Haptic Settings',
  '배경음악 크기': 'Music Volume',
  '개인정보 처리방침': 'Privacy Policy',
  '기록': 'Stats',
  '수집': 'Collection',
  '내오잉 보기 전환': 'My OING Tabs',
  '내 기록 요약': 'My Record Summary',
  '이번 버전 · 이 기기에 저장된 최근 7판이야': 'Your latest 7 runs saved on this device',
  '이번 버전 최고기록': 'Best This Version',
  '최근 점수': 'Latest Score',
  '평균 점수': 'Average Score',
  '저장된 판': 'Saved Runs',
  '이전 최고기록': 'Previous Best',
  '최근 점수 흐름': 'Recent Score Trend',
  '플레이하면서 모은 것들이야': 'Everything you have collected while playing',
  '오잉 카드': 'OING Cards',
  '오잉 카드 수집': 'OING Card Collection',
  '고양이의 모험': "Cat's Adventure",
  '모험 장면 수집': 'Adventure Scene Collection',
  '플레이할수록 한 장씩 열린다냥': 'Keep playing to unlock more cards!',
  '판을 넘길수록 새 장면이 열린다냥': 'Reach new rounds to unlock more scenes!',
  '한 판 더 하기': 'Play Again',
  '오잉 랭킹': 'OING RANK',
  '기존 랭킹': 'Legacy Ranking',
  '이번주': 'Weekly',
  '전체': 'Global',
  '친구': 'Friends',
  '전체 랭킹': 'GLOBAL RANKING',
  '친구 랭킹': 'FRIENDS RANKING',
  '랭킹 기간': 'Ranking Period',
  '내 랭킹 요약': 'My Ranking Summary',
  '상위 세 명': 'Top Three',
  '지금까지 가장 높은 기록을 모았다냥!': 'The best scores of all time!',
  '내 순위': 'MY RANK',
  '순위 밖': 'Unranked',
  '다음 순위까지': 'TO NEXT RANK',
  '순위 변동 없음': 'No rank change',
  '점 남았다냥!': 'PTS TO GO!',
  '🏅 내 기록 보기': '🏅 View My Record',
  '최근 활발히 플레이 중': 'Recently active',
  '최근에도 활발히 플레이했어요': 'This player has been active recently',
  '지난주 기록이 아직 없다냥': 'No previous-week record yet',
  '별명 등록하기': 'Set Nickname',
  '별명 수정': 'Edit Nickname',
  '길게 누르면 친구 등록 · 다시 길게 누르면 해제': 'Press and hold to add or remove a friend',
  '기록을 불러오는 중이다냥…': 'Loading scores…',
  '랭킹 별명 만들기': 'Create a Ranking Nickname',
  '랭킹 별명 바꾸기': 'Change Ranking Nickname',
  '랭킹에 어떤 이름으로 올라갈까?': 'What name should appear on the ranking?',
  '나만의 별명을 정해보라냥! 게임을 마치면 이 이름으로 랭킹에 등록돼요.': 'Choose a nickname. Your scores will appear under this name.',
  '별명': 'Nickname',
  '2~6자 한글·영문·숫자': '2–6 letters or numbers',
  '다음에': 'Later',
  '나중에': 'Later',
  '저장하기': 'Save',
  '이 이름으로 시작!': 'Use This Name',
  '더 시원하고 재미있어졌어요!': 'Faster, Smoother, More Fun!',
  '확인했어요': 'Got It',
  '도움이 필요해?': 'Need a Hand?',
  '광고 한 번에 둘 다 챙겨준다냥': 'Watch once and get both items!',
  '광고 보고': 'Watch Ad',
  '도움팩': 'Help Pack',
  '받기': 'Get',
  '괜찮아': 'No Thanks',
  '한 판당 1회만': 'Once per run',
  '아깝다냥! 조금만 더?': 'So close! Need a little more time?',
  '정답 발견': 'ANSWER FOUND',
  '딱 10!': 'PERFECT 10!',
  '합10 여기!': 'MAKE 10 HERE!',
  '이어서 10 만들기!': 'KEEP GOING TO 10!',
  '터치': 'TAP',
  '펑!': 'BOOM!',
  '광고 준비 중...': 'Preparing ad…',
  '가능한 보드를 준비했어!': 'A fresh board is ready!',
  '터뜨릴 숫자가 없어!': 'No numbers to blast!',
  '이 아이템은 다음 업데이트에서 열려!': 'This item is coming in a future update!',
  '친구로 등록됐어요': 'Friend added',
  '친구 등록이 해제됐어요': 'Friend removed',
  '랭킹 별명을 저장했다냥!': 'Ranking nickname saved!',
  '공유창을 열었다냥!': 'Share menu opened!',
  '이 브라우저에선 공유가 어렵다냥': 'Sharing is not available in this browser',
  '지원 안 됨': 'Unavailable',
  '미지원': 'Unavailable',
  '완료': 'Complete',
  '수집 완료': 'Collected',
  '새싹': 'Sprout',
  '꽃밭': 'Flower Garden',
  '하트꽃': 'Heart Bloom',
  '별꽃': 'Star Bloom',
  '반짝임': 'Sparkle',
  '구름다리': 'Cloud Bridge',
  '나': 'ME',
  '새 오잉 카드!': 'New OING Card!',
  '첫 걸음': 'First Steps',
  '첫 판 끝내기': 'Finish your first run',
  '단골 손님': 'Regular Player',
  '10판 플레이': 'Play 10 runs',
  '고양이 친구': 'Cat Friend',
  '고양이 300마리': 'Rescue 300 cats',
  '시원한 손': 'Big Clear',
  '5칸 이상 한 번에 300번': 'Clear 5+ cells 300 times',
  '반짝이는 기록': 'Shining Record',
  '한 판 4,000점': 'Score 4,000 in one run',
  '일주일 개근': 'Seven-Day Streak',
  '서로 다른 7일 플레이': 'Play on 7 different days',
  '대청소': 'Big Cleanup',
  '지운 칸 20,000개': 'Clear 20,000 cells',
  '한 달의 친구': 'Month-Long Friend',
  '서로 다른 30일 플레이': 'Play on 30 different days',
  '오잉 고수': 'OING Master',
  '한 판 10,000점': 'Score 10,000 in one run',
  '비밀의 정원': 'Secret Garden',
  '이끼 숲길': 'Mossy Forest Path',
  '반짝이는 개울': 'Sparkling Stream',
  '고양이 마을': 'Cat Village',
  '노을 언덕': 'Sunset Hill',
  '별밤 지붕': 'Starry Rooftops',
  '오로라 항구': 'Aurora Harbor',
  '폭탄 효과': 'Bomb effects',
  '와 점수 오르는 손맛을 강화했어요.': ' and score feedback feel more satisfying.',
  '쉬운 답을 모두 찾으면': 'When all easy matches are gone,',
  '다음 판으로 빠르게 넘어가요.': ' you move to the next board faster.',
  '내 기록과 가까운 목표': 'Goals close to your own best',
  '가 보여 도전하는 재미가 커졌어요.': ' make every run more exciting.',
  '첫 플레이 후': 'After your first run,',
  '나만의 랭킹 별명을 정할 수 있어요.': ' you can choose your ranking nickname.',
  '첫 기록을 만들었다냥!': 'You set your first record!',
  '첫 판을 기다리고 있다냥!': 'Play your first run!',
  '첫 주인공을 기다려요': 'Waiting for the first challenger',
  '한 판을 끝내면 여기에 기록이 쌓인다냥!': 'Finish a run to start your history!',
  '놓친 답을 천천히 확인해보라냥!': 'Take a closer look at the answers you missed!',
  '10을 찾아보자냥!': 'Find combinations that make 10!',
  '한 번 더 누르면 나가요': 'Press back again to exit',
  '게임을 멈춰뒀어': 'Game Paused',
  '돌아오면 계속하기를 눌러달라냥': 'Tap Continue when you are ready',
  '한 번 더': 'Tap Again',
}));

const RULES = [
  [/^(.+), 길게 눌러 친구 저장$/, '$1, press and hold to add friend'],
  [/^(.+), 길게 눌러 친구 해제$/, '$1, press and hold to remove friend'],
  [/^(힌트|섞기|폭탄|시계), (\d+)회 남음$/, (_, item, count) => `${translateEnglishText(item)}, ${count} left`],
  [/^첫 목표 ([\d,]+)점 목표$/, 'First goal: $1 pts'],
  [/^첫 목표 ([\d,]+)점$/, 'First goal: $1 pts'],
  [/^첫 목표 · ([\d,]+)점 도전!$/, 'FIRST GOAL · REACH $1 PTS!'],
  [/^(.+) · ([\d,]+)점 도전!$/, '$1 · BEAT $2 PTS!'],
  [/^(.+) ([\d,]+)점 목표$/, '$1 target: $2 pts'],
  [/^콤보 (\d+)$/, 'Combo $1'],
  [/^장면 (\d+)\/(\d+) 수집$/, 'Scenes $1/$2'],
  [/^(\d+)번째 판 (\d+)%$/, 'Round $1 · clear $2%'],
  [/^첫 걸음 수집 완료, 첫 판 끝내기$/, 'First Steps collected · finish your first run'],
  [/^잠긴 카드, (.+), ([\d,]+) \/ ([\d,]+)$/, (_, requirement, current, target) => `Locked card · ${translateEnglishText(requirement)} · ${current}/${target}`],
  [/^잠긴 장면, (.+) 필요$/, (_, requirement) => `Locked scene · requires ${translateEnglishText(requirement)}`],
  [/^5칸 이상 한 번에 ([\d,]+)번 \(([\d,]+)\/([\d,]+)\)$/, 'Clear 5+ cells $1 times ($2/$3)'],
  [/^한 판 ([\d,]+)점 \(([\d,]+)\/([\d,]+)\)$/, 'Score $1 in one run ($2/$3)'],
  [/^서로 다른 ([\d,]+)일 플레이 \(([\d,]+)\/([\d,]+)\)$/, 'Play on $1 different days ($2/$3)'],
  [/^지운 칸 ([\d,]+)개 \(([\d,]+)\/([\d,]+)\)$/, 'Clear $1 cells ($2/$3)'],
  [/^(\d+)위$/, 'Rank $1'],
  [/^(\d+)점$/, '$1 pts'],
  [/^([\d,]+)점$/, '$1 pts'],
  [/^(\d+)판$/, 'Round $1'],
  [/^(\d+)마리$/, '$1 cats'],
  [/^고양이 ([\d,]+)마리$/, '$1 cats'],
  [/^카드 (\d+)\/(\d+)$/, 'Cards $1/$2'],
  [/^(\d+)초$/, '$1 sec'],
  [/^(\d+)초 정지$/, 'Freeze $1 sec'],
  [/^\+(\d+)초$/, '+$1 sec'],
  [/^\+(\d+)초 · 힌트 (\d+)$/, '+$1 sec · $2 hint'],
  [/^결과 보기 \((\d+)\)$/, 'View Result ($1)'],
  [/^STAGE (\d+) 도달 · 성공 (\d+)회$/, 'REACHED STAGE $1 · $2 CLEARS'],
  [/^(\d+)판 진행 · 성공 (\d+)회$/, '$1 ROUNDS · $2 CLEARS'],
  [/^최고기록 도전 (\d+)%$/, 'BEST SCORE PROGRESS $1%'],
  [/^다음 순위까지 ([\d,]+)점 남았다냥!$/, '$1 pts to the next rank!'],
  [/^([\d,]+)점 남았다냥!$/, '$1 pts to go!'],
  [/^시간 (\d+)초 멈춤!$/, 'TIME FROZEN FOR $1 SEC!'],
  [/^\+(\d+)초 이어간다냥!$/, '+$1 SECONDS!'],
  [/^시간 보너스 MAX · \+([\d,]+)점$/, 'TIME BONUS MAX · +$1'],
  [/^고양이 보너스 ×(\d+)$/, 'CAT BONUS ×$1'],
  [/^고양이 보너스$/, 'CAT BONUS'],
  [/^외 (\d+)장$/, '+$1 MORE'],
  [/^새 장면도 열렸어 · (.+)$/, 'NEW SCENE UNLOCKED · $1'],
  [/^([\d,]+)점 올랐다냥!$/, 'UP $1 PTS!'],
  [/^지난 판보다 \+([\d,]+)점 올랐다냥!$/, '+$1 PTS FROM LAST RUN!'],
  [/^지난 판과 같은 점수야!$/, 'SAME SCORE AS LAST RUN!'],
  [/^([\d,]+)점 차이다냥.*$/, '$1 PTS FROM YOUR BEST!'],
  [/^최고기록까지.*$/, 'KEEP PUSHING FOR A NEW BEST!'],
  [/^(.+)님 랭킹 자동 등록 완료!.*$/, '$1, your score is on the ranking!'],
  [/^랭킹 자동 등록 완료!$/, 'Score added to the ranking!'],
  [/^토스포인트 (\d+)원 받았다냥!$/, 'You received $1 Toss Points!'],
  [/^힌트 \+(\d+) · 셔플 \+(\d+)$/, '+$1 hints · +$2 shuffles'],
  [/^([\d,]+)점$/, '$1 pts'],
];

function fallbackSentence(text) {
  if (!/[\uAC00-\uD7A3]/.test(text) || text.length < 8) return text;
  if (/광고/.test(text)) return 'The ad is not ready yet. Please try again soon!';
  if (/별명|이름/.test(text)) return 'Choose a nickname for the ranking.';
  if (/랭킹|순위/.test(text)) return 'Keep playing to climb the ranking!';
  if (/고양이/.test(text)) return 'Clear a cat tile for bonus points! 🐱';
  if (/콤보/.test(text)) return 'Keep the combo going! ⚡';
  if (/기록|점수/.test(text)) return 'A new best is within reach! 🏆';
  if (/시간/.test(text)) return 'Keep an eye on the timer! ⏱️';
  if (/숫자|합|10/.test(text)) return 'Find numbers that add up to 10!';
  if (/다냥|냥[!?~.… ]|보라냥|가자냥/.test(text)) return 'Nice run! Keep going, meow! 🐱';
  return "Let's go! You got this! 🐱";
}

export function translateEnglishText(value) {
  const text = String(value ?? '');
  if (!/[\uAC00-\uD7A3]/.test(text)) return text;
  const exact = EN.get(text.trim());
  if (exact) return text.replace(text.trim(), exact);
  for (const [pattern, replacement] of RULES) {
    if (pattern.test(text.trim())) return text.replace(text.trim(), text.trim().replace(pattern, replacement));
  }
  return text.replace(text.trim(), fallbackSentence(text.trim()));
}

export function translateText(value) {
  return isEnglish ? translateEnglishText(value) : String(value ?? '');
}

const ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt', 'data-lock-copy'];
let translating = false;

function walkNode(node) {
  if (!node) return;
  if (node.nodeType === Node.TEXT_NODE) {
    const next = translateText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  for (const name of ATTRIBUTES) {
    if (!node.hasAttribute(name)) continue;
    const value = node.getAttribute(name);
    const next = translateText(value);
    if (next !== value) node.setAttribute(name, next);
  }
  for (const child of node.childNodes) walkNode(child);
}

function localizeNode(node) {
  if (!isEnglish || translating || !node) return;
  translating = true;
  try {
    walkNode(node);
  } finally {
    translating = false;
  }
}

export function installLocalization(root = document.documentElement) {
  document.documentElement.lang = language;
  document.documentElement.classList.toggle('lang-en', isEnglish);
  if (!isEnglish) return;

  document.title = 'OING — Make 10 and Pop!';
  const description = document.querySelector('meta[name="description"]');
  description?.setAttribute('content', 'A fast, cute number puzzle: drag numbers that add up to 10.');
  localizeNode(root);

  const observer = new MutationObserver((mutations) => {
    if (translating) return;
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') localizeNode(mutation.target);
      for (const node of mutation.addedNodes) localizeNode(node);
      if (mutation.type === 'attributes') localizeNode(mutation.target);
    }
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRIBUTES,
  });
}
