import { getDatabase } from './db.js';

export async function bootstrapPlayer({ provider, providerUserKey, fallbackNickname }) {
  const sql = getDatabase();
  const rows = await sql`
    SELECT * FROM oing_bootstrap_player(
      ${provider},
      ${providerUserKey},
      ${fallbackNickname}
    )
  `;
  return rows[0] || null;
}

export async function startRun({ playerId, clientRunId }) {
  const sql = getDatabase();
  const rows = await sql`
    INSERT INTO oing_runs (player_id, client_run_id)
    VALUES (${playerId}, ${clientRunId})
    ON CONFLICT (player_id, client_run_id) DO UPDATE
      SET client_run_id = EXCLUDED.client_run_id
    RETURNING id, player_id, client_run_id, started_at
  `;
  return rows[0] || null;
}

export async function finishRun({
  runId,
  playerId,
  score,
  durationMs,
  successCount,
  status,
  reasons,
  stats,
}) {
  const sql = getDatabase();
  const rows = await sql`
    SELECT * FROM oing_finish_run(
      ${runId},
      ${playerId},
      ${score},
      ${durationMs},
      ${successCount},
      ${status},
      ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(reasons || [])}::jsonb)),
      ${JSON.stringify(stats || {})}::jsonb
    )
  `;
  return rows[0] || null;
}

export async function leaderboard({ mode = 'weekly', limit = 100, playerId = null }) {
  const sql = getDatabase();
  const safeLimit = Math.min(100, Math.max(3, Math.round(Number(limit) || 100)));
  const isAllTime = mode === 'all';
  const isFriends = mode === 'friends';

  if (isFriends && !playerId) return { rows: [], me: null };

  const rows = isFriends
    ? await sql`
        WITH friend_set AS (
          SELECT ${playerId}::uuid AS player_id
          UNION
          SELECT friend_player_id FROM oing_friendships WHERE owner_player_id = ${playerId}
        ), weekly_best AS (
          SELECT DISTINCT ON (r.player_id)
            r.player_id, r.score, r.finished_at AS achieved_at
          FROM oing_runs r
          JOIN friend_set f ON f.player_id = r.player_id
          WHERE r.status = 'accepted'
            AND r.finished_at >= date_trunc('week', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
          ORDER BY r.player_id, r.score DESC, r.finished_at ASC
        ), ranked AS (
          SELECT
            w.player_id,
            p.nickname,
            w.score,
            w.achieved_at,
            dense_rank() OVER (ORDER BY w.score DESC, w.achieved_at ASC) AS rank,
            (w.player_id <> ${playerId}::uuid) AS is_friend,
            (w.achieved_at >= now() - interval '24 hours') AS hot
          FROM weekly_best w
          JOIN oing_players p ON p.id = w.player_id
        )
        SELECT * FROM ranked ORDER BY rank ASC, achieved_at ASC LIMIT ${safeLimit}
      `
    : isAllTime
    ? await sql`
        WITH ranked AS (
          SELECT
            b.player_id,
            p.nickname,
            b.score,
            b.achieved_at,
            dense_rank() OVER (ORDER BY b.score DESC, b.achieved_at ASC) AS rank,
            CASE WHEN ${playerId}::uuid IS NULL THEN false ELSE EXISTS (
              SELECT 1 FROM oing_friendships f
              WHERE f.owner_player_id = ${playerId}::uuid AND f.friend_player_id = b.player_id
            ) END AS is_friend,
            (b.achieved_at >= now() - interval '24 hours') AS hot
          FROM oing_leaderboard_best b
          JOIN oing_players p ON p.id = b.player_id
        )
        SELECT * FROM ranked ORDER BY rank ASC, achieved_at ASC LIMIT ${safeLimit}
      `
    : await sql`
        WITH weekly_best AS (
          SELECT DISTINCT ON (r.player_id)
            r.player_id, r.score, r.finished_at AS achieved_at
          FROM oing_runs r
          WHERE r.status = 'accepted'
            AND r.finished_at >= date_trunc('week', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
          ORDER BY r.player_id, r.score DESC, r.finished_at ASC
        ), ranked AS (
          SELECT
            w.player_id,
            p.nickname,
            w.score,
            w.achieved_at,
            dense_rank() OVER (ORDER BY w.score DESC, w.achieved_at ASC) AS rank,
            CASE WHEN ${playerId}::uuid IS NULL THEN false ELSE EXISTS (
              SELECT 1 FROM oing_friendships f
              WHERE f.owner_player_id = ${playerId}::uuid AND f.friend_player_id = w.player_id
            ) END AS is_friend,
            (w.achieved_at >= now() - interval '24 hours') AS hot
          FROM weekly_best w
          JOIN oing_players p ON p.id = w.player_id
        )
        SELECT * FROM ranked ORDER BY rank ASC, achieved_at ASC LIMIT ${safeLimit}
      `;

  let me = null;
  if (playerId) {
    if (isFriends) {
      me = rows.find((row) => row.player_id === playerId) || null;
    } else {
      const meRows = isAllTime
      ? await sql`
          WITH ranked AS (
            SELECT b.player_id, p.nickname, b.score, b.achieved_at,
              dense_rank() OVER (ORDER BY b.score DESC, b.achieved_at ASC) AS rank,
              false AS is_friend,
              (b.achieved_at >= now() - interval '24 hours') AS hot
            FROM oing_leaderboard_best b JOIN oing_players p ON p.id = b.player_id
          ) SELECT * FROM ranked WHERE player_id = ${playerId}
        `
      : await sql`
          WITH weekly_best AS (
            SELECT DISTINCT ON (r.player_id) r.player_id, r.score, r.finished_at AS achieved_at
            FROM oing_runs r
            WHERE r.status = 'accepted'
              AND r.finished_at >= date_trunc('week', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
            ORDER BY r.player_id, r.score DESC, r.finished_at ASC
          ), ranked AS (
            SELECT w.player_id, p.nickname, w.score, w.achieved_at,
              dense_rank() OVER (ORDER BY w.score DESC, w.achieved_at ASC) AS rank,
              false AS is_friend,
              (w.achieved_at >= now() - interval '24 hours') AS hot
            FROM weekly_best w JOIN oing_players p ON p.id = w.player_id
          ) SELECT * FROM ranked WHERE player_id = ${playerId}
        `;
      me = meRows[0] || null;
    }
  }

  const scoreGap = (entry) => {
    if (!entry || Number(entry.rank) === 1) return 0;
    const ahead = [...rows].reverse().find((candidate) => Number(candidate.rank) < Number(entry.rank));
    return ahead ? Math.max(0, Number(ahead.score) - Number(entry.score) + 1) : null;
  };
  rows.forEach((row) => { row.score_to_next = scoreGap(row); });
  if (me) me.score_to_next = scoreGap(me);

  if (!isAllTime) {
    const previousRows = isFriends
      ? await sql`
          WITH friend_set AS (
            SELECT ${playerId}::uuid AS player_id
            UNION
            SELECT friend_player_id FROM oing_friendships WHERE owner_player_id = ${playerId}
          ), previous_best AS (
            SELECT DISTINCT ON (r.player_id) r.player_id, r.score, r.finished_at AS achieved_at
            FROM oing_runs r
            JOIN friend_set f ON f.player_id = r.player_id
            WHERE r.status = 'accepted'
              AND r.finished_at >= (date_trunc('week', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul') - interval '1 week'
              AND r.finished_at < date_trunc('week', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
            ORDER BY r.player_id, r.score DESC, r.finished_at ASC
          )
          SELECT player_id, dense_rank() OVER (ORDER BY score DESC, achieved_at ASC) AS rank
          FROM previous_best
        `
      : await sql`
          WITH previous_best AS (
            SELECT DISTINCT ON (r.player_id) r.player_id, r.score, r.finished_at AS achieved_at
            FROM oing_runs r
            WHERE r.status = 'accepted'
              AND r.finished_at >= (date_trunc('week', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul') - interval '1 week'
              AND r.finished_at < date_trunc('week', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
            ORDER BY r.player_id, r.score DESC, r.finished_at ASC
          )
          SELECT player_id, dense_rank() OVER (ORDER BY score DESC, achieved_at ASC) AS rank
          FROM previous_best
        `;
    const previousRanks = new Map(previousRows.map((row) => [row.player_id, Number(row.rank)]));
    const addMovement = (entry) => {
      if (!entry) return;
      const previousRank = previousRanks.get(entry.player_id);
      entry.previous_rank = previousRank || null;
      entry.is_new = !previousRank;
      entry.rank_delta = previousRank ? previousRank - Number(entry.rank) : null;
    };
    rows.forEach(addMovement);
    addMovement(me);
  }
  return { rows, me };
}

export async function setFriend({ playerId, friendPlayerId, saved }) {
  const sql = getDatabase();
  if (saved) {
    const rows = await sql`
      INSERT INTO oing_friendships (owner_player_id, friend_player_id)
      SELECT ${playerId}, p.id
      FROM oing_players p
      WHERE p.id = ${friendPlayerId} AND p.id <> ${playerId}::uuid
      ON CONFLICT DO NOTHING
      RETURNING friend_player_id
    `;
    if (!rows[0]) {
      const existing = await sql`
        SELECT friend_player_id FROM oing_friendships
        WHERE owner_player_id = ${playerId} AND friend_player_id = ${friendPlayerId}
      `;
      if (!existing[0]) return null;
    }
    return { friendPlayerId, saved: true };
  }

  await sql`
    DELETE FROM oing_friendships
    WHERE owner_player_id = ${playerId} AND friend_player_id = ${friendPlayerId}
  `;
  return { friendPlayerId, saved: false };
}

export async function getProfile(playerId) {
  const sql = getDatabase();
  const rows = await sql`
    SELECT
      p.id AS player_id,
      p.nickname,
      COALESCE(w.balance, 0) AS jelly_balance,
      COALESCE(b.score, 0) AS best_score
    FROM oing_players p
    LEFT JOIN oing_jelly_wallet w ON w.player_id = p.id
    LEFT JOIN oing_leaderboard_best b ON b.player_id = p.id
    WHERE p.id = ${playerId}
  `;
  return rows[0] || null;
}

export async function getCatalog(playerId) {
  const sql = getDatabase();
  const rows = await sql`
    SELECT
      c.item_key, c.kind, c.price, c.metadata,
      (o.item_key IS NOT NULL) AS owned,
      (e.item_key = c.item_key) AS equipped
    FROM oing_cosmetic_catalog c
    LEFT JOIN oing_player_cosmetics o
      ON o.player_id = ${playerId} AND o.item_key = c.item_key
    LEFT JOIN oing_equipped_cosmetics e
      ON e.player_id = ${playerId} AND e.kind = c.kind
    WHERE c.enabled = true
    ORDER BY c.sort_order ASC, c.item_key ASC
  `;
  return rows;
}

export async function purchaseCosmetic({ playerId, itemKey }) {
  const sql = getDatabase();
  const rows = await sql`
    SELECT * FROM oing_purchase_cosmetic(${playerId}, ${itemKey})
  `;
  return rows[0] || null;
}

export async function equipCosmetic({ playerId, itemKey }) {
  const sql = getDatabase();
  const rows = await sql`
    WITH owned AS (
      SELECT c.item_key, c.kind
      FROM oing_player_cosmetics o
      JOIN oing_cosmetic_catalog c ON c.item_key = o.item_key
      WHERE o.player_id = ${playerId} AND o.item_key = ${itemKey}
    )
    INSERT INTO oing_equipped_cosmetics (player_id, kind, item_key)
      SELECT ${playerId}, kind, item_key FROM owned
      ON CONFLICT (player_id, kind) DO UPDATE
        SET item_key = EXCLUDED.item_key, updated_at = now()
      RETURNING kind, item_key
  `;
  return rows[0] || null;
}
