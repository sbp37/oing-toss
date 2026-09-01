# 오잉 자체 랭킹·젤리 v1

기준 브랜치: `codex/custom-ranking-jelly-v1`

## 결정 사항

- 토스·Google Play의 기존 네이티브 랭킹은 삭제하거나 덮어쓰지 않는다.
- 새 `오잉 랭킹`은 별도 랭킹으로 시작한다.
- Classic 종료 시 기존 네이티브 점수 제출과 오잉 점수 제출을 서로 독립적으로 실행한다.
- 토스 Game Center에는 순위 목록을 읽거나 내보내는 API가 없어서 기존 약 50명 기록은 자동 이전하지 않는다. 기존 토스 랭킹 보기 버튼을 보조 경로로 계속 제공한다.
- 랭킹·지갑의 기준 키는 닉네임이 아니라 내부 `player_id`다.
- 젤리는 서버 전용 지갑과 추가 전용 원장을 단일 원본으로 사용한다. 클라이언트가 잔액을 직접 쓰지 않는다.
- 젤리는 꾸미기에만 사용하고 점수·시간·아이템에는 사용하지 않는다.

## 현재 구현 범위

### 클라이언트

- 홈·플레이·결과의 `오잉 랭킹` 버튼과 파스텔 랭킹 시트
- 이번주(월요일 00:00 KST부터) / 전체 최고점수
- 1~3위 시상대, 4위 이후 목록, 내 순위 고정줄
- 토스 안에서는 `토스 랭킹 보기`를 보조 버튼으로 유지
- 토스 밖 웹에서도 공개 순위 읽기 가능, 인증 실패·서버 장애 시 게임 흐름 유지
- 시작/성공 시각/종료 전송. 종료 응답이 유실되면 세션 저장소에 둔 서명 티켓으로 다음 실행 때 한 번 더 제출

### 서버

- Vercel Node Function: `api/oing/index.js`
- Neon Postgres 스키마와 트랜잭션 함수: `server/oing/schema.sql`
- 토스 `getUserKeyForGame()`의 게임 전용 hash를 mTLS로 확인
- hash 원문은 저장하지 않고 HMAC 키만 `oing_player_identities`에 저장
- 24시간 플레이어 토큰, 30분 run ticket
- run 시작 후에만 제출 가능, 같은 run 재제출은 읽기만 하고 중복 반영하지 않음
- 150,000점 초과, 15초 미만/15분 초과, 3초 12회 초과, 성공 원장 불일치는 `pending`
- 전체 최고점수는 max-only
- 첫 정상판 +10, 하루 첫 정상판 +1. 지급·점수·최고점수 반영은 한 DB 트랜잭션
- 꾸미기 카탈로그·구매·장착 API와 서버 전용 젤리 원장 기반 마련

## 아직 운영에 연결하지 않은 것

- Neon 데이터베이스 생성과 `schema.sql` 적용
- 토스 mTLS 인증서 환경변수 등록
- Vercel Preview/Production 배포
- 실제 토스 QR에서 hash 확인·점수 제출·주간 경계 확인
- Google Play / Apple Game Center 사용자의 오잉 계정 연결
- 젤리샵 화면과 최종 꾸미기 에셋

따라서 이 브랜치는 코드 검수용이며, 환경변수가 없는 현재 Production의 버튼을 바꾸면 안 된다. DB와 인증서를 Preview에서 검증한 뒤 기능 묶음으로 승격한다.

## 필요한 환경변수

| 이름 | 용도 |
| --- | --- |
| `DATABASE_URL` | Neon Postgres 연결 문자열 |
| `OING_IDENTITY_SECRET` | provider hash를 DB용 HMAC 키로 바꾸는 32바이트 이상 비밀값 |
| `OING_RUN_TICKET_SECRET` | 플레이어 토큰·run ticket 서명용 32바이트 이상 비밀값 |
| `TOSS_MTLS_CERT_BASE64` | 토스 파트너 mTLS 인증서 PEM의 base64 |
| `TOSS_MTLS_KEY_BASE64` | 토스 파트너 mTLS 개인키 PEM의 base64 |
| `OING_ALLOW_TEST_IDENTITY` | Preview 자동검증에서만 `true`; Production에는 절대 설정하지 않음 |

인증서·개인키·비밀값은 저장소에 커밋하지 않는다.

## API 계약

단일 엔드포인트 `/api/oing`에서 `action`으로 구분한다.

- `POST bootstrap`: 토스 게임 hash 확인 → 내부 플레이어와 bearer token
- `POST start-run`: bearer token + `clientRunId` → 서명 run ticket
- `POST finish-run`: run ticket + 점수/시간/성공 원장 → accepted 또는 pending
- `GET ?action=leaderboard&mode=weekly|all`: 공개 순위, bearer가 있으면 내 줄 포함
- `GET ?action=profile`, `GET ?action=catalog`: 로그인한 내 정보
- `POST purchase`, `POST equip`: 서버 트랜잭션으로 구매·장착

## 배포 순서

1. Preview용 Neon DB를 만들고 `server/oing/schema.sql`을 적용한다.
2. Vercel Preview 환경에 DB/서명 비밀값을 등록한다.
3. 앱인토스 콘솔에서 mTLS 인증서를 발급해 Preview 환경에만 등록한다.
4. Preview에서 테스트 식별자로 API의 중복 제출·동시 구매·pending 판정을 자동 검증한다.
5. 토스 QR 실기기에서 `getUserKeyForGame` → bootstrap → run → 랭킹 갱신을 확인한다.
6. 360×780 / 390×844 / 430×932에서 시트 잘림·스크롤·뒤로가기를 확인한다.
7. 개인정보 처리방침을 함께 배포하고, 사용자 승인 후에만 main/Production에 반영한다.

## Google Play·App Store 확장

DB와 화면은 공통이고 provider 인증 어댑터만 추가한다. 앱별로 랭킹 코드를 갈아끼우지 않는다.

- `toss`: 현재 구현된 게임 전용 hash + mTLS 확인
- `google-play`: Play Games 서버 인증코드 검증 뒤 `(google-play, provider_user_key)` 연결
- `apple-game-center`: Game Center 서명 검증 뒤 `(apple-game-center, provider_user_key)` 연결

서로 다른 플랫폼 계정을 같은 사람이라고 자동 추측하지 않는다. 이후 명시적인 계정 연결 절차를 만들 때만 여러 identity를 같은 `player_id`에 묶는다.

## 운영·롤백

- 서버 오류는 결과 화면과 네이티브 랭킹 제출을 막지 않는다.
- 새 랭킹 서버가 준비되지 않으면 시트에 안내를 보이고 기존 토스/Google 랭킹 경로를 유지한다.
- 치팅 의심 기록은 삭제 대신 `pending`으로 남겨 오탐을 복구할 수 있게 한다.
- 장애 시 클라이언트의 오잉 랭킹 진입만 되돌려도 기존 네이티브 랭킹과 로컬 `내 오잉` 기록은 그대로 동작한다.
