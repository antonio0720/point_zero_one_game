-- ===========================================================================
-- FILE: migrations/0010_multiplayer_sovereignty.sql
-- Point Zero One — Sovereign Multiplayer Schema
-- 
-- Run: psql -d pzo -f migrations/0010_multiplayer_sovereignty.sql
-- ===========================================================================

-- ─── EXTENSIONS ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for fast ILIKE search on alliance names

-- ─── ALLIANCES ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alliances (
  id                    TEXT PRIMARY KEY,
  tag                   VARCHAR(6) NOT NULL UNIQUE,
  name                  VARCHAR(50) NOT NULL,
  description           VARCHAR(300) NOT NULL DEFAULT '',
  level                 INT NOT NULL DEFAULT 1,
  xp                    BIGINT NOT NULL DEFAULT 0,
  capacity              INT NOT NULL DEFAULT 25,
  member_count          INT NOT NULL DEFAULT 0,
  vault                 BIGINT NOT NULL DEFAULT 0,
  is_open               BOOLEAN NOT NULL DEFAULT true,
  requirement_min_level INT NOT NULL DEFAULT 0,
  language              VARCHAR(5) NOT NULL DEFAULT 'en',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  r5_id                 TEXT NOT NULL,
  active_war_id         TEXT,
  banner_color_primary   VARCHAR(7) NOT NULL DEFAULT '#FFD700',
  banner_color_secondary VARCHAR(7) NOT NULL DEFAULT '#1A1A2E',
  banner_icon_id        TEXT NOT NULL DEFAULT 'icon_star'
);

CREATE INDEX IF NOT EXISTS idx_alliances_tag  ON alliances (tag);
CREATE INDEX IF NOT EXISTS idx_alliances_name ON alliances USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_alliances_open ON alliances (is_open, member_count DESC);

-- ─── ALLIANCE MEMBERS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alliance_members (
  user_id           TEXT NOT NULL,
  alliance_id       TEXT NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  rank              VARCHAR(2) NOT NULL DEFAULT 'R1' CHECK (rank IN ('R1','R2','R3','R4','R5')),
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  war_points        BIGINT NOT NULL DEFAULT 0,
  total_contributed BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, alliance_id)
);

CREATE INDEX IF NOT EXISTS idx_alliance_members_alliance ON alliance_members (alliance_id, rank);
CREATE INDEX IF NOT EXISTS idx_alliance_members_user     ON alliance_members (user_id);

-- ─── ALLIANCE APPLICATIONS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alliance_applications (
  id           TEXT PRIMARY KEY,
  alliance_id  TEXT NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  message      VARCHAR(200) NOT NULL DEFAULT '',
  applied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status       VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_applications_alliance ON alliance_applications (alliance_id, status);

-- ─── ALLIANCE AUDIT LOG ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alliance_audit_log (
  id           BIGSERIAL PRIMARY KEY,
  alliance_id  TEXT NOT NULL,
  actor_id     TEXT NOT NULL,
  target_id    TEXT,
  action       VARCHAR(30) NOT NULL,
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_alliance ON alliance_audit_log (alliance_id, created_at DESC);

-- ─── ALLIANCE AID REQUESTS ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alliance_aid_requests (
  id           TEXT PRIMARY KEY,
  alliance_id  TEXT NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL,
  type         VARCHAR(10) NOT NULL CHECK (type IN ('COINS','BOOST','SHIELD')),
  amount       BIGINT NOT NULL,
  fulfilled    BIGINT NOT NULL DEFAULT 0,
  target       BIGINT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aid_alliance ON alliance_aid_requests (alliance_id, expires_at);

-- ─── CHAT CHANNELS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_channels (
  id                TEXT PRIMARY KEY,
  type              VARCHAR(20) NOT NULL CHECK (type IN ('GLOBAL','SERVER','ALLIANCE','ALLIANCE_OFFICER','ROOM','DM')),
  name              VARCHAR(100) NOT NULL DEFAULT '',
  member_count      INT NOT NULL DEFAULT 0,
  slow_mode_seconds INT NOT NULL DEFAULT 0,
  is_locked         BOOLEAN NOT NULL DEFAULT false,
  pinned_message_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pre-seed global and server channels
INSERT INTO chat_channels (id, type, name, member_count, slow_mode_seconds, is_locked)
VALUES ('global', 'GLOBAL', 'Global', 0, 3, false)
ON CONFLICT DO NOTHING;

-- ─── CHAT MESSAGES ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_messages (
  id            TEXT PRIMARY KEY,
  channel_type  VARCHAR(20) NOT NULL,
  channel_id    TEXT NOT NULL,
  sender_id     TEXT NOT NULL,
  sender_name   VARCHAR(50) NOT NULL,
  sender_rank   VARCHAR(2),
  sender_title  VARCHAR(30),
  type          VARCHAR(20) NOT NULL DEFAULT 'TEXT',
  body          TEXT NOT NULL,
  metadata      JSONB,
  status        VARCHAR(20) NOT NULL DEFAULT 'SENT',
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at     TIMESTAMPTZ,
  unsent_at     TIMESTAMPTZ,
  deleted_by    TEXT,
  reply_to_id   TEXT REFERENCES chat_messages(id) ON DELETE SET NULL,
  flags         INT NOT NULL DEFAULT 0
);

-- Partitioned index for fast channel history lookups
CREATE INDEX IF NOT EXISTS idx_chat_channel_sent ON chat_messages (channel_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sender       ON chat_messages (sender_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_status       ON chat_messages (status) WHERE status != 'SENT';

-- Retention: auto-delete global/server messages older than 7 days
-- (implement via pg_cron job: DELETE FROM chat_messages WHERE channel_type IN ('GLOBAL','SERVER') AND sent_at < NOW() - INTERVAL '7 days')

-- ─── CHAT BLOCKS ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_blocks (
  blocker_id  TEXT NOT NULL,
  blocked_id  TEXT NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON chat_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON chat_blocks (blocked_id);

-- ─── CHAT REACTIONS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_reactions (
  message_id  TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  emoji       VARCHAR(10) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON chat_reactions (message_id);

-- ─── CHAT ROOMS ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_rooms (
  id             TEXT PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  type           VARCHAR(20) NOT NULL DEFAULT 'CUSTOM',
  creator_id     TEXT NOT NULL,
  max_members    INT NOT NULL DEFAULT 10,
  is_invite_only BOOLEAN NOT NULL DEFAULT false,
  invite_token   TEXT UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ,           -- null = permanent
  is_war_room    BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS chat_room_members (
  user_id    TEXT NOT NULL,
  room_id    TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  is_owner   BOOLEAN NOT NULL DEFAULT false,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_room_members ON chat_room_members (room_id);

-- ─── ALLIANCE WARS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alliance_wars (
  id              TEXT PRIMARY KEY,
  attacker_id     TEXT NOT NULL REFERENCES alliances(id),
  defender_id     TEXT NOT NULL REFERENCES alliances(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'DECLARED'
                  CHECK (status IN ('DECLARED','PREPARATION','ACTIVE','SETTLEMENT','ENDED')),
  declared_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  attacker_points BIGINT NOT NULL DEFAULT 0,
  defender_points BIGINT NOT NULL DEFAULT 0,
  outcome         VARCHAR(10) CHECK (outcome IN ('ATTACKER','DEFENDER','TIE')),
  proof_hash      TEXT,
  war_room_id     TEXT REFERENCES chat_rooms(id)
);

CREATE INDEX IF NOT EXISTS idx_wars_attacker ON alliance_wars (attacker_id, status);
CREATE INDEX IF NOT EXISTS idx_wars_defender ON alliance_wars (defender_id, status);

-- ─── PLAYER REPORTS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_reports (
  id              TEXT PRIMARY KEY,
  reporter_id     TEXT NOT NULL,
  reported_id     TEXT NOT NULL,
  channel_id      TEXT,
  message_id      TEXT,
  category        VARCHAR(30) NOT NULL CHECK (category IN ('SPAM','HARASSMENT','CHEATING','EXPLOITATION','HATE_SPEECH','OTHER')),
  description     TEXT NOT NULL DEFAULT '',
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','REVIEWED','ACTIONED','DISMISSED')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reports_reported ON player_reports (reported_id, status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON player_reports (reporter_id);

-- ─── BAN LOG ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ban_log (
  id           BIGSERIAL PRIMARY KEY,
  player_id    TEXT NOT NULL,
  banned_by    TEXT NOT NULL,
  reason       TEXT NOT NULL,
  ban_type     VARCHAR(20) NOT NULL CHECK (ban_type IN ('CHAT_MUTE','QUARANTINE','ACCOUNT_BAN','DEVICE_BAN')),
  expires_at   TIMESTAMPTZ,            -- null = permanent
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lifted_at    TIMESTAMPTZ,
  lifted_by    TEXT
);

CREATE INDEX IF NOT EXISTS idx_bans_player ON ban_log (player_id, ban_type) WHERE lifted_at IS NULL;

-- ─── DEVICE TRUST SCORES ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS device_trust_scores (
  device_fingerprint  TEXT PRIMARY KEY,
  player_id           TEXT,
  trust_score         FLOAT NOT NULL DEFAULT 1.0,
  flags               INT NOT NULL DEFAULT 0,  -- bitmask
  last_seen           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quarantined         BOOLEAN NOT NULL DEFAULT false
);

-- ─── PLAYER SESSIONS ─────────────────────────────────────────────────────────
-- (for online presence detection)

CREATE TABLE IF NOT EXISTS player_sessions (
  id          TEXT PRIMARY KEY,
  player_id   TEXT NOT NULL,
  server_id   TEXT NOT NULL DEFAULT 'default',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  last_ping   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_player ON player_sessions (player_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_server ON player_sessions (server_id, expires_at);

-- ─── LEADERBOARDS ─────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard_global AS
SELECT
  p.id as player_id,
  p.display_name,
  am.alliance_id,
  a.tag as alliance_tag,
  am.rank as alliance_rank,
  p.net_worth,
  p.total_cashflow,
  p.runs_completed,
  p.win_rate,
  p.level,
  am.war_points,
  ROW_NUMBER() OVER (ORDER BY p.net_worth DESC) as global_rank
FROM players p
LEFT JOIN alliance_members am ON am.user_id = p.id
LEFT JOIN alliances a ON a.id = am.alliance_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lb_global_player ON leaderboard_global (player_id);
CREATE INDEX IF NOT EXISTS idx_lb_global_rank         ON leaderboard_global (global_rank);

-- Refresh every 5 minutes via pg_cron:
-- SELECT cron.schedule('*/5 * * * *', $$REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_global$$);

-- ─── FUNCTIONS ────────────────────────────────────────────────────────────────

-- Auto-update member_count on alliance_members changes
CREATE OR REPLACE FUNCTION sync_alliance_member_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE alliances
  SET member_count = (
    SELECT COUNT(*) FROM alliance_members WHERE alliance_id = COALESCE(NEW.alliance_id, OLD.alliance_id)
  )
  WHERE id = COALESCE(NEW.alliance_id, OLD.alliance_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_member_count ON alliance_members;
CREATE TRIGGER trg_sync_member_count
AFTER INSERT OR DELETE ON alliance_members
FOR EACH ROW EXECUTE FUNCTION sync_alliance_member_count();
