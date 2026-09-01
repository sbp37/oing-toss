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

  const rows = isAllTime
    ? await sql`
        WITH ranked AS (
          SELECT
            b.player_id,
            p.nickname,
            b.score,
            b.achieved_at,
            dense_rank() OVER (ORDER BY b.score DESC, b.achieved_at ASC) AS rank
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
            dense_rank() OVER (ORDER BY w.score DESC, w.achieved_at ASC) AS rank
          FROM weekly_best w
          JOIN oing_players p ON p.id = w.player_id
        )
        SELECT * FROM ranked ORDER BY rank ASC, achieved_at ASC LIMIT ${safeLimit}
      `;

  let me = null;
  if (playerId) {
    const meRows = isAllTime
      ? await sql`
          WITH ranked AS (
            SELECT b.player_id, p.nickname, b.score, b.achieved_at,
              dense_rank() OVER (ORDER BY b.score DESC, b.achieved_at ASC) AS rank
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
              dense_rank() OVER (ORDER BY w.score DESC, w.achieved_at ASC) AS rank
            FROM weekly_best w JOIN oing_players p ON p.id = w.player_id
          ) SELECT * FROM ranked WHERE player_id = ${playerId}
        `;
    me = meRows[0] || null;
  }
  return { rows, me };
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
