CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS oing_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname text NOT NULL,
  nickname_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oing_player_identities (
  player_id uuid NOT NULL REFERENCES oing_players(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('toss', 'google-play', 'apple-game-center')),
  provider_user_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_user_key)
);

CREATE TABLE IF NOT EXISTS oing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES oing_players(id) ON DELETE CASCADE,
  client_run_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  score integer,
  duration_ms integer,
  success_count integer,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'accepted', 'pending', 'rejected')),
  review_reasons text[] NOT NULL DEFAULT '{}',
  stats jsonb NOT NULL DEFAULT '{}',
  UNIQUE (player_id, client_run_id)
);

CREATE INDEX IF NOT EXISTS oing_runs_weekly_rank_idx
  ON oing_runs (finished_at DESC, score DESC)
  WHERE status = 'accepted';

CREATE TABLE IF NOT EXISTS oing_leaderboard_best (
  player_id uuid PRIMARY KEY REFERENCES oing_players(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0),
  run_id uuid NOT NULL REFERENCES oing_runs(id),
  achieved_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS oing_leaderboard_best_score_idx
  ON oing_leaderboard_best (score DESC, achieved_at ASC);

CREATE TABLE IF NOT EXISTS oing_friendships (
  owner_player_id uuid NOT NULL REFERENCES oing_players(id) ON DELETE CASCADE,
  friend_player_id uuid NOT NULL REFERENCES oing_players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_player_id, friend_player_id),
  CHECK (owner_player_id <> friend_player_id)
);

CREATE INDEX IF NOT EXISTS oing_friendships_friend_idx
  ON oing_friendships (friend_player_id, owner_player_id);

CREATE TABLE IF NOT EXISTS oing_jelly_wallet (
  player_id uuid PRIMARY KEY REFERENCES oing_players(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oing_jelly_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES oing_players(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  idempotency_key text NOT NULL,
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS oing_jelly_ledger_player_idx
  ON oing_jelly_ledger (player_id, created_at DESC);

CREATE TABLE IF NOT EXISTS oing_cosmetic_catalog (
  item_key text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('nickname-color', 'nickname-effect', 'rank-frame', 'cat-skin')),
  price integer NOT NULL CHECK (price >= 0),
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS oing_player_cosmetics (
  player_id uuid NOT NULL REFERENCES oing_players(id) ON DELETE CASCADE,
  item_key text NOT NULL REFERENCES oing_cosmetic_catalog(item_key),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, item_key)
);

CREATE TABLE IF NOT EXISTS oing_equipped_cosmetics (
  player_id uuid NOT NULL REFERENCES oing_players(id) ON DELETE CASCADE,
  kind text NOT NULL,
  item_key text REFERENCES oing_cosmetic_catalog(item_key),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, kind)
);

INSERT INTO oing_cosmetic_catalog (item_key, kind, price, sort_order) VALUES
  ('color-coral', 'nickname-color', 30, 10),
  ('color-mint', 'nickname-color', 30, 20),
  ('color-sky', 'nickname-color', 30, 30),
  ('effect-sparkle', 'nickname-effect', 60, 40),
  ('frame-pink-ribbon', 'rank-frame', 80, 50),
  ('skin-blue-cat', 'cat-skin', 60, 60)
ON CONFLICT (item_key) DO NOTHING;

CREATE OR REPLACE FUNCTION oing_bootstrap_player(
  p_provider text,
  p_provider_user_key text,
  p_fallback_nickname text
) RETURNS TABLE (player_id uuid, nickname text, jelly_balance integer)
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_player_id uuid;
  resolved_nickname text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_provider_user_key, 0));

  SELECT p.id, p.nickname INTO resolved_player_id, resolved_nickname
    FROM oing_player_identities i
    JOIN oing_players p ON p.id = i.player_id
    WHERE i.provider = p_provider AND i.provider_user_key = p_provider_user_key;

  IF resolved_player_id IS NULL THEN
    INSERT INTO oing_players (nickname, nickname_key)
      VALUES (p_fallback_nickname, lower(p_fallback_nickname))
      RETURNING id, oing_players.nickname INTO resolved_player_id, resolved_nickname;
    INSERT INTO oing_player_identities (player_id, provider, provider_user_key)
      VALUES (resolved_player_id, p_provider, p_provider_user_key);
  END IF;

  INSERT INTO oing_jelly_wallet (player_id, balance)
    VALUES (resolved_player_id, 0)
    ON CONFLICT (player_id) DO NOTHING;

  RETURN QUERY
    SELECT resolved_player_id, resolved_nickname, w.balance
    FROM oing_jelly_wallet w
    WHERE w.player_id = resolved_player_id;
END;
$$;

CREATE OR REPLACE FUNCTION oing_apply_jelly(
  p_player_id uuid,
  p_delta integer,
  p_reason text,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  current_balance integer;
  next_balance integer;
  prior_balance integer;
BEGIN
  SELECT balance_after INTO prior_balance
    FROM oing_jelly_ledger
    WHERE player_id = p_player_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN prior_balance; END IF;

  INSERT INTO oing_jelly_wallet (player_id, balance)
    VALUES (p_player_id, 0)
    ON CONFLICT (player_id) DO NOTHING;

  SELECT balance INTO current_balance
    FROM oing_jelly_wallet
    WHERE player_id = p_player_id
    FOR UPDATE;

  next_balance := current_balance + p_delta;
  IF next_balance < 0 THEN RAISE EXCEPTION 'insufficient jelly'; END IF;

  UPDATE oing_jelly_wallet
    SET balance = next_balance, updated_at = now()
    WHERE player_id = p_player_id;

  INSERT INTO oing_jelly_ledger
    (player_id, delta, reason, idempotency_key, balance_after, metadata)
    VALUES (p_player_id, p_delta, p_reason, p_idempotency_key, next_balance, p_metadata);
  RETURN next_balance;
END;
$$;

CREATE OR REPLACE FUNCTION oing_purchase_cosmetic(
  p_player_id uuid,
  p_item_key text
) RETURNS TABLE (balance integer, owned boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  item_price integer;
  next_balance integer;
BEGIN
  -- Serialize ownership checks for the same player and item. Without this,
  -- two simultaneous taps could both charge while only one ownership row
  -- survives the final ON CONFLICT.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_player_id::text || ':' || p_item_key, 0));

  IF EXISTS (
    SELECT 1 FROM oing_player_cosmetics
    WHERE player_id = p_player_id AND item_key = p_item_key
  ) THEN
    SELECT w.balance INTO next_balance FROM oing_jelly_wallet w WHERE w.player_id = p_player_id;
    RETURN QUERY SELECT COALESCE(next_balance, 0), true;
    RETURN;
  END IF;

  SELECT price INTO item_price
    FROM oing_cosmetic_catalog
    WHERE item_key = p_item_key AND enabled = true;
  IF item_price IS NULL THEN RAISE EXCEPTION 'unknown cosmetic'; END IF;

  next_balance := oing_apply_jelly(
    p_player_id,
    -item_price,
    'cosmetic-purchase',
    -- Permanent ownership makes the item key the canonical idempotency key.
    -- A caller-selected key must never make a different item look paid for.
    'cosmetic:' || p_item_key,
    jsonb_build_object('itemKey', p_item_key)
  );

  INSERT INTO oing_player_cosmetics (player_id, item_key)
    VALUES (p_player_id, p_item_key)
    ON CONFLICT DO NOTHING;
  RETURN QUERY SELECT next_balance, true;
END;
$$;

CREATE OR REPLACE FUNCTION oing_finish_run(
  p_run_id uuid,
  p_player_id uuid,
  p_score integer,
  p_duration_ms integer,
  p_success_count integer,
  p_status text,
  p_review_reasons text[],
  p_stats jsonb
) RETURNS TABLE (
  run_status text,
  best_score integer,
  jelly_balance integer,
  jelly_earned integer,
  duplicate boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  run_row oing_runs%ROWTYPE;
  prior_accepted integer;
  prior_today integer;
  earned integer := 0;
  current_balance integer := 0;
  current_best integer := 0;
BEGIN
  SELECT * INTO run_row
    FROM oing_runs
    WHERE id = p_run_id AND player_id = p_player_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'run not found'; END IF;

  IF run_row.finished_at IS NOT NULL THEN
    SELECT COALESCE(MAX(score), 0) INTO current_best
      FROM oing_leaderboard_best WHERE player_id = p_player_id;
    SELECT COALESCE(balance, 0) INTO current_balance
      FROM oing_jelly_wallet WHERE player_id = p_player_id;
    RETURN QUERY SELECT run_row.status, current_best, current_balance, 0, true;
    RETURN;
  END IF;

  SELECT count(*) INTO prior_accepted
    FROM oing_runs WHERE player_id = p_player_id AND status = 'accepted';
  SELECT count(*) INTO prior_today
    FROM oing_runs
    WHERE player_id = p_player_id
      AND status = 'accepted'
      AND finished_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul';

  UPDATE oing_runs SET
    finished_at = now(),
    score = p_score,
    duration_ms = p_duration_ms,
    success_count = p_success_count,
    status = p_status,
    review_reasons = COALESCE(p_review_reasons, '{}'),
    stats = COALESCE(p_stats, '{}')
  WHERE id = p_run_id;

  IF p_status = 'accepted' THEN
    INSERT INTO oing_leaderboard_best (player_id, score, run_id, achieved_at)
      VALUES (p_player_id, p_score, p_run_id, now())
      ON CONFLICT (player_id) DO UPDATE SET
        score = EXCLUDED.score,
        run_id = EXCLUDED.run_id,
        achieved_at = EXCLUDED.achieved_at
      WHERE EXCLUDED.score > oing_leaderboard_best.score;

    IF prior_accepted = 0 THEN
      current_balance := oing_apply_jelly(
        p_player_id, 10, 'welcome', 'welcome', jsonb_build_object('runId', p_run_id)
      );
      earned := earned + 10;
    END IF;
    IF prior_today = 0 THEN
      current_balance := oing_apply_jelly(
        p_player_id,
        1,
        'first-game',
        'first-game:' || to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD'),
        jsonb_build_object('runId', p_run_id)
      );
      earned := earned + 1;
    END IF;
  END IF;

  SELECT COALESCE(MAX(score), 0) INTO current_best
    FROM oing_leaderboard_best WHERE player_id = p_player_id;
  SELECT COALESCE(balance, 0) INTO current_balance
    FROM oing_jelly_wallet WHERE player_id = p_player_id;
  RETURN QUERY SELECT p_status, current_best, current_balance, earned, false;
END;
$$;
