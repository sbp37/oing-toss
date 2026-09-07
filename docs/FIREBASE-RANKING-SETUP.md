# New OING Firebase ranking setup

This directory is connected to the dedicated `new-oing-toss` Firebase project.

## Architecture

- HTTPS function: `oingApi` in Seoul (`asia-northeast3`)
- Firestore is server-only; client reads and writes are denied by rules
- Toss anonymous key is verified with the Apps in Toss mTLS endpoint
- accepted runs update each player's weekly and all-time best score
- weekly/all top 100 are cached as one document each, so one ranking screen load
  normally costs one Firestore document read
- run audit documents carry an `expiresAt` field for an eight-week TTL policy
- the browser keeps its existing retry-safe player/run ticket protocol
- private Apps in Toss AIT tests use Toss' documented sandbox identity and are
  stored in `sandbox_*` collections; verified live Toss identities continue to
  use the production collections, so test scores never enter the live ranking

## One-time console work

1. Create a separate Firebase project for New OING under the same Google account.
2. Upgrade it to Blaze, choose the Seoul Firestore location, and enable Firestore.
3. Copy `.firebaserc.example` to `.firebaserc` and replace the project id.
4. Set these four Firebase Functions secrets:
   - `OING_IDENTITY_SECRET`: a new random secret
   - `OING_RUN_TICKET_SECRET`: another new random secret
   - `TOSS_MTLS_CERT_BASE64`: Apps in Toss certificate PEM encoded as base64
   - `TOSS_MTLS_KEY_BASE64`: matching private key PEM encoded as base64
5. Deploy only Firestore rules/indexes and the `oingApi` function.
6. Add a Firestore TTL policy for collection group `runs`, field `expiresAt`.
7. Build the AIT. The deployed URL is now the default, and can still be overridden:

   `OING_ONLINE_API_URL=https://asia-northeast3-PROJECT_ID.cloudfunctions.net/oingApi npm run build:ait`

The URL is injected into a meta tag during the build. Ordinary builds use the New
OING Firebase endpoint, so a later release cannot silently fall back to the old
ranking server when an environment variable is omitted.

## Cost guardrails

- keep `minInstances` at zero
- set budget alerts at KRW 1,000 and KRW 5,000
- never query 100 score documents from the client; use `ranking_cache`
- keep the eight-week TTL enabled for `runs`
- use a separate project so Original OING and New OING do not share quotas or risk
