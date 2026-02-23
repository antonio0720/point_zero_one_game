#!/bin/bash
# =============================================================================
# PZO — FULL PRODUCTION DEPLOY
# Copies all files, installs packages, patches App.tsx, runs migration guide
# =============================================================================

SRC="$HOME/Downloads/pzo-production-files"
REPO="$HOME/workspaces/adam/Projects/adam/point_zero_one_master"
SERVER="$REPO/pzo-server/src"
WEB="$REPO/pzo-web/src"
APP="$WEB/App.tsx"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     PZO — PRODUCTION DEPLOY: AUTH + HATERS + BRUTAL     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Preflight ─────────────────────────────────────────────────────────────────

[ ! -d "$REPO" ]  && echo "❌ Repo not found: $REPO"  && exit 1
[ ! -f "$APP"  ]  && echo "❌ App.tsx not found: $APP" && exit 1
[ ! -d "$SRC"  ]  && echo "❌ Source folder not found: $SRC" && echo "   Place all downloaded files in $SRC" && exit 1
echo "✔  Preflight passed."
echo ""

# ── Step 1: Copy backend files ────────────────────────────────────────────────

echo "── STEP 1: Backend files ────────────────────────────────"

mkdir -p "$SERVER/auth"
cp -f "$SRC/authService.ts"     "$SERVER/auth/authService.ts"
cp -f "$SRC/authRouter.ts"      "$SERVER/auth/authRouter.ts"
cp -f "$SRC/authMiddleware.ts"  "$SERVER/auth/authMiddleware.ts"
echo "✅  auth/ (3 files)  →  pzo-server/src/auth/"

mkdir -p "$SERVER/haters"
cp -f "$SRC/HaterEngine.ts"     "$SERVER/haters/HaterEngine.ts"
echo "✅  HaterEngine.ts   →  pzo-server/src/haters/"

cp -f "$SRC/server.ts"          "$SERVER/server.ts"
echo "✅  server.ts        →  pzo-server/src/"

# ── Step 2: Copy migration ────────────────────────────────────────────────────

echo ""
echo "── STEP 2: Migration ────────────────────────────────────"
cp -f "$SRC/002_users_auth.sql" "$REPO/migrations/002_users_auth.sql"
echo "✅  002_users_auth.sql  →  migrations/"

# ── Step 3: Copy frontend files ───────────────────────────────────────────────

echo ""
echo "── STEP 3: Frontend files ───────────────────────────────"

mkdir -p "$WEB/hooks"
cp -f "$SRC/useAuth.ts"         "$WEB/hooks/useAuth.ts"
echo "✅  useAuth.ts       →  pzo-web/src/hooks/"

mkdir -p "$WEB/components/auth"
cp -f "$SRC/AuthGate.tsx"       "$WEB/components/auth/AuthGate.tsx"
echo "✅  AuthGate.tsx     →  pzo-web/src/components/auth/"

cp -f "$SRC/useChatEngine.ts"   "$WEB/components/chat/useChatEngine.ts"
echo "✅  useChatEngine.ts →  pzo-web/src/components/chat/ (REPLACED)"

# ── Step 4: Install server packages ──────────────────────────────────────────

echo ""
echo "── STEP 4: Install server packages ─────────────────────"
cd "$REPO/pzo-server"

# Check if package.json exists, create if not
if [ ! -f "package.json" ]; then
  npm init -y > /dev/null 2>&1
fi

npm install --save \
  express \
  bcryptjs \
  jsonwebtoken \
  pg \
  uuid \
  cors \
  cookie-parser \
  helmet \
  compression \
  express-rate-limit \
  socket.io \
  dotenv \
  2>&1 | tail -3

npm install --save-dev \
  @types/express \
  @types/bcryptjs \
  @types/jsonwebtoken \
  @types/pg \
  @types/uuid \
  @types/cors \
  @types/cookie-parser \
  @types/compression \
  typescript \
  ts-node \
  tsx \
  2>&1 | tail -3

echo "✅  Server packages installed."

# ── Step 5: Install frontend socket.io-client ─────────────────────────────────

echo ""
echo "── STEP 5: Frontend packages ────────────────────────────"
cd "$REPO/pzo-web"
npm install --save socket.io-client 2>&1 | tail -2
echo "✅  socket.io-client installed."

# ── Step 6: Create .env files ─────────────────────────────────────────────────

echo ""
echo "── STEP 6: Environment files ────────────────────────────"

if [ ! -f "$REPO/pzo-server/.env" ]; then
  JWT_SECRET=$(openssl rand -hex 64 2>/dev/null || echo "CHANGE_ME_$(date +%s)_$(head -c 16 /dev/urandom | xxd -p)")
  cat > "$REPO/pzo-server/.env" << ENV
NODE_ENV=development
PORT=3001
DATABASE_URL=postgres://postgres:postgres@localhost:5432/pzo
JWT_SECRET=$JWT_SECRET
CLIENT_ORIGIN=http://localhost:5173
ENV
  echo "✅  pzo-server/.env created with generated JWT_SECRET."
  echo "    ⚠️  Update DATABASE_URL with your actual Postgres credentials."
else
  echo "⏭️  pzo-server/.env already exists — skipping."
fi

if [ ! -f "$REPO/pzo-web/.env" ]; then
  cat > "$REPO/pzo-web/.env" << ENV
VITE_API_URL=http://localhost:3001
ENV
  echo "✅  pzo-web/.env created."
else
  echo "⏭️  pzo-web/.env already exists — skipping."
fi

# ── Step 7: App.tsx patches ───────────────────────────────────────────────────

echo ""
echo "── STEP 7: App.tsx patches ──────────────────────────────"
cp "$APP" "$APP.pre-production.bak"
echo "✔  Backup saved: App.tsx.pre-production.bak"

# Patch 1: Add imports (if not present)
if ! grep -q "AuthGate" "$APP"; then
  sed -i '' \
    "/import MechanicsBridgeDevPanel/a\\
import { AuthGate } from './components/auth/AuthGate';\\
import { useAuth } from './hooks/useAuth';\\
import type { SabotageEvent, SabotageCardType } from './components/chat/useChatEngine';" \
    "$APP"
  echo "✅  Auth imports added."
else
  echo "⏭️  Auth imports already present."
fi

# Patch 2: Brutal constants
if ! grep -q "FATE_TICKS" "$APP"; then
  sed -i '' \
    "s/const STARTING_CASH     = 50_000;/const STARTING_CASH     = 28_000;/" "$APP"
  sed -i '' \
    "s/const STARTING_INCOME   = 3_500;/const STARTING_INCOME   = 2_100;/" "$APP"
  sed -i '' \
    "s/const STARTING_EXPENSES = 4_200;/const STARTING_EXPENSES = 4_800;/" "$APP"
  sed -i '' \
    "/const STARTING_EXPENSES = 4_800;/a\\
const FATE_TICKS     = 18;\\
const FATE_FUBAR_PCT = 0.42;\\
const FATE_MISSED_PCT= 0.32;\\
const FATE_SO_PCT    = 0.21;" \
    "$APP"
  echo "✅  Brutal difficulty constants applied."
else
  echo "⏭️  Brutal constants already applied."
fi

# Patch 3: More frequent macro events (90 → 55)
if grep -q "tick % 90 === 0" "$APP"; then
  sed -i '' "s/tick % 90 === 0/tick % 55 === 0/" "$APP"
  echo "✅  Macro events: 90 ticks → 55 ticks (more frequent)."
else
  echo "⏭️  Macro event frequency already updated."
fi

# Patch 4: Player hand = OPPORTUNITY + IPA only
if grep -q "drawRandomCards(deckPool, 1, rngRef.current)" "$APP"; then
  sed -i '' \
    "s/const draws = drawRandomCards(deckPool, 1, rngRef.current);/const playablePool = deckPool.filter((c) => c.type === 'OPPORTUNITY' || c.type === 'IPA');\n        const draws = drawRandomCards(playablePool, 1, rngRef.current);/" \
    "$APP"
  echo "✅  Player hand filtered to OPPORTUNITY + IPA only."
else
  echo "⏭️  Hand filter already applied."
fi

# Patch 5: Brutal FUBAR multiplier in handlePlayCard
if grep -q "riskScale = 1 + intelligence.risk" "$APP"; then
  sed -i '' \
    "s/const riskScale = 1 + intelligence.risk \* 0.4 + intelligence.volatility \* 0.2;/const riskScale = 2.0 + intelligence.risk * 0.8 + intelligence.volatility * 0.5; \/\/ BRUTAL/" \
    "$APP"
  echo "✅  FUBAR multiplier: 1x → 2x base (brutal)."
else
  echo "⏭️  FUBAR multiplier already updated."
fi

# ── Step 8: Commit ────────────────────────────────────────────────────────────

echo ""
echo "── STEP 8: Git commit ───────────────────────────────────"
cd "$REPO"
git add \
  pzo-server/src/auth/ \
  pzo-server/src/haters/ \
  pzo-server/src/server.ts \
  pzo-web/src/hooks/ \
  pzo-web/src/components/auth/ \
  pzo-web/src/components/chat/useChatEngine.ts \
  pzo-web/src/App.tsx \
  migrations/002_users_auth.sql

git commit -m "feat: production auth, 5 ML hater bots, brutal difficulty, forced fate cards"
git push

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                   DEPLOY COMPLETE                        ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
echo "║  1. Run DB migration:                                    ║"
echo "║     psql -d pzo -f migrations/002_users_auth.sql         ║"
echo "║                                                          ║"
echo "║  2. Update pzo-server/.env with real DATABASE_URL        ║"
echo "║                                                          ║"
echo "║  3. Start server:                                        ║"
echo "║     cd pzo-server && npx tsx src/server.ts               ║"
echo "║                                                          ║"
echo "║  4. Start frontend:                                      ║"
echo "║     cd pzo-web && npm run dev                            ║"
echo "║                                                          ║"
echo "║  5. Apply manual App.tsx patches from:                   ║"
echo "║     App.tsx.brutal-patch (fate deck + sabotage handler)  ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
