#!/usr/bin/env bash
# ============================================================================
# Point Zero One — Sovereign Database Migration Runner
# ============================================================================
# Density6 LLC · RA-OMEGA Infrastructure
#
# Usage:
#   ./run_migration.sh                    # Apply migration (idempotent)
#   ./run_migration.sh --nuke             # DROP ALL + rebuild from scratch
#   ./run_migration.sh --verify           # Verify schema integrity
#   ./run_migration.sh --count            # Count tables, indexes, enums
#   ./run_migration.sh --dry-run          # Parse-check only, no apply
#
# Environment:
#   DATABASE_URL    — Full postgres:// connection string
#   PGHOST          — Postgres host (fallback)
#   PGPORT          — Postgres port (fallback, default 5432)
#   PGDATABASE      — Database name (fallback, default pzo)
#   PGUSER          — Database user (fallback, default pzo_service)
#   PGPASSWORD      — Database password (fallback)
#
# For PgBouncer: point DATABASE_URL at port 6432
# For direct Postgres: point at port 5432
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_FILE="${SCRIPT_DIR}/0001_pzo_sovereign_schema.sql"
LOG_FILE="${SCRIPT_DIR}/migration_$(date +%Y%m%d_%H%M%S).log"

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()   { echo -e "${CYAN}[PZO]${NC} $1" | tee -a "$LOG_FILE"; }
ok()    { echo -e "${GREEN}[✓]${NC} $1" | tee -a "$LOG_FILE"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1" | tee -a "$LOG_FILE"; }
fail()  { echo -e "${RED}[✗]${NC} $1" | tee -a "$LOG_FILE"; exit 1; }

# ── Connection ──────────────────────────────────────────────────────────────
build_conn() {
    if [[ -n "${DATABASE_URL:-}" ]]; then
        echo "$DATABASE_URL"
    else
        local host="${PGHOST:-localhost}"
        local port="${PGPORT:-5432}"
        local db="${PGDATABASE:-pzo}"
        local user="${PGUSER:-pzo_service}"
        local pass="${PGPASSWORD:-}"
        if [[ -n "$pass" ]]; then
            echo "postgresql://${user}:${pass}@${host}:${port}/${db}"
        else
            echo "postgresql://${user}@${host}:${port}/${db}"
        fi
    fi
}

CONN="$(build_conn)"
SAFE_CONN="$(echo "$CONN" | sed -E 's/:[^@]+@/:***@/')"

run_psql() {
    psql "$CONN" -v ON_ERROR_STOP=1 "$@" 2>&1
}

run_psql_quiet() {
    psql "$CONN" -v ON_ERROR_STOP=1 -t -A "$@" 2>&1
}

# ── Preflight ───────────────────────────────────────────────────────────────
preflight() {
    log "Connection: ${SAFE_CONN}"

    if ! command -v psql &>/dev/null; then
        fail "psql not found. Install postgresql-client."
    fi

    if ! run_psql -c "SELECT 1" &>/dev/null; then
        fail "Cannot connect to database. Check credentials."
    fi

    ok "Database connection verified"

    # Check Postgres version
    local pg_version
    pg_version="$(run_psql_quiet -c "SHOW server_version_num")"
    if [[ "$pg_version" -lt 160000 ]]; then
        warn "PostgreSQL ${pg_version} detected. Recommended: 16+"
    else
        ok "PostgreSQL version: $(run_psql_quiet -c "SHOW server_version")"
    fi
}

# ── Nuke ────────────────────────────────────────────────────────────────────
nuke_database() {
    warn "⚠️  NUCLEAR OPTION: This will DROP ALL schemas and tables."
    warn "    Database: ${SAFE_CONN}"

    if [[ "${FORCE_NUKE:-}" != "1" ]]; then
        echo -e "\n${RED}${BOLD}Type 'DESTROY' to confirm:${NC} "
        read -r confirm
        if [[ "$confirm" != "DESTROY" ]]; then
            fail "Nuke cancelled."
        fi
    fi

    log "Dropping schemas..."
    run_psql <<'NUKE_SQL'
-- Drop dependent schemas first (CASCADE handles FK deps)
DROP SCHEMA IF EXISTS analytics CASCADE;
DROP SCHEMA IF EXISTS b2b CASCADE;
DROP SCHEMA IF EXISTS social CASCADE;
DROP SCHEMA IF EXISTS economy CASCADE;
DROP SCHEMA IF EXISTS game CASCADE;

-- Drop public schema tables (in reverse dependency order)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all tables in public schema
    FOR r IN (
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    ) LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;

    -- Drop all custom types in public schema
    FOR r IN (
        SELECT t.typname
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public'
          AND t.typtype = 'e'
    ) LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
END $$;

-- Drop utility functions
DROP FUNCTION IF EXISTS set_row_updated_at() CASCADE;
DROP FUNCTION IF EXISTS create_updated_at_trigger(TEXT, TEXT) CASCADE;
NUKE_SQL

    ok "All schemas, tables, types, and functions dropped."
}

# ── Apply ───────────────────────────────────────────────────────────────────
apply_migration() {
    if [[ ! -f "$MIGRATION_FILE" ]]; then
        fail "Migration file not found: ${MIGRATION_FILE}"
    fi

    local lines
    lines="$(wc -l < "$MIGRATION_FILE")"
    log "Applying migration: $(basename "$MIGRATION_FILE") (${lines} lines)"

    local start_time
    start_time="$(date +%s)"

    if run_psql -f "$MIGRATION_FILE" >> "$LOG_FILE" 2>&1; then
        local end_time
        end_time="$(date +%s)"
        local elapsed=$((end_time - start_time))
        ok "Migration applied successfully in ${elapsed}s"
    else
        fail "Migration FAILED. Check log: ${LOG_FILE}"
    fi
}

# ── Verify ──────────────────────────────────────────────────────────────────
verify_schema() {
    log "Verifying schema integrity..."

    local schemas
    schemas="$(run_psql_quiet -c "
        SELECT string_agg(nspname, ', ' ORDER BY nspname)
        FROM pg_namespace
        WHERE nspname IN ('public','game','economy','social','analytics','b2b')
    ")"
    ok "Schemas present: ${schemas}"

    # Count tables per schema
    for schema in public game economy social analytics b2b; do
        local count
        count="$(run_psql_quiet -c "
            SELECT COUNT(*) FROM pg_tables WHERE schemaname = '${schema}'
        ")"
        log "  ${schema}: ${count} tables"
    done

    # Count total indexes
    local idx_count
    idx_count="$(run_psql_quiet -c "
        SELECT COUNT(*) FROM pg_indexes
        WHERE schemaname IN ('public','game','economy','social','analytics','b2b')
    ")"
    ok "Total indexes: ${idx_count}"

    # Count custom types
    local type_count
    type_count="$(run_psql_quiet -c "
        SELECT COUNT(*)
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public' AND t.typtype = 'e'
    ")"
    ok "Custom enum types: ${type_count}"

    # Check critical tables exist
    local critical_tables=(
        "public.accounts"
        "public.users"
        "public.sessions"
        "public.global_event_store"
        "game.runs"
        "game.run_turns"
        "game.run_events"
        "game.card_definitions"
        "game.ruleset_versions"
        "social.matches"
        "social.rivalries"
        "social.legend_runs"
        "economy.entitlements"
        "economy.purchases"
        "analytics.run_scorecards"
        "analytics.ladders"
    )

    local missing=0
    for table in "${critical_tables[@]}"; do
        local schema_name="${table%%.*}"
        local table_name="${table##*.}"
        local exists
        exists="$(run_psql_quiet -c "
            SELECT EXISTS (
                SELECT 1 FROM pg_tables
                WHERE schemaname = '${schema_name}' AND tablename = '${table_name}'
            )
        ")"
        if [[ "$exists" != "t" ]]; then
            warn "MISSING: ${table}"
            missing=$((missing + 1))
        fi
    done

    if [[ $missing -eq 0 ]]; then
        ok "All ${#critical_tables[@]} critical tables verified"
    else
        fail "${missing} critical tables missing"
    fi

    # Check game_mode enum has correct values
    local modes
    modes="$(run_psql_quiet -c "
        SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'game_mode' AND n.nspname = 'public'
    ")"
    if [[ "$modes" == "EMPIRE,PREDATOR,SYNDICATE,PHANTOM" ]]; then
        ok "Game modes: ${modes}"
    else
        warn "Unexpected game modes: ${modes}"
    fi

    # Check FK integrity
    local fk_count
    fk_count="$(run_psql_quiet -c "
        SELECT COUNT(*)
        FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY'
          AND table_schema IN ('public','game','economy','social','analytics','b2b')
    ")"
    ok "Foreign key constraints: ${fk_count}"

    # Check triggers
    local trigger_count
    trigger_count="$(run_psql_quiet -c "
        SELECT COUNT(*)
        FROM information_schema.triggers
        WHERE trigger_schema IN ('public','game','economy','social','analytics','b2b')
          AND trigger_name LIKE '%_set_updated_at'
    ")"
    ok "updated_at triggers: ${trigger_count}"

    echo ""
    ok "Schema verification complete."
}

# ── Count ───────────────────────────────────────────────────────────────────
count_objects() {
    echo ""
    echo -e "${BOLD}Point Zero One — Sovereign Schema Census${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    run_psql -c "
        SELECT
            schemaname AS schema,
            COUNT(*) AS tables
        FROM pg_tables
        WHERE schemaname IN ('public','game','economy','social','analytics','b2b')
        GROUP BY schemaname
        ORDER BY schemaname;
    "

    run_psql -c "
        SELECT
            schemaname AS schema,
            COUNT(*) AS indexes
        FROM pg_indexes
        WHERE schemaname IN ('public','game','economy','social','analytics','b2b')
        GROUP BY schemaname
        ORDER BY schemaname;
    "

    run_psql -c "
        SELECT t.typname AS enum_type, COUNT(e.enumlabel) AS values
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE n.nspname = 'public'
        GROUP BY t.typname
        ORDER BY t.typname;
    "
}

# ── Dry Run ─────────────────────────────────────────────────────────────────
dry_run() {
    log "Dry run: parsing migration SQL..."
    if run_psql -c "BEGIN; $(cat "$MIGRATION_FILE"); ROLLBACK;" >> "$LOG_FILE" 2>&1; then
        ok "Migration parses successfully (no changes applied)"
    else
        fail "Migration has syntax errors. Check log: ${LOG_FILE}"
    fi
}

# ── Main ────────────────────────────────────────────────────────────────────
main() {
    echo ""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  POINT ZERO ONE — SOVEREIGN DATABASE MIGRATION${NC}"
    echo -e "${BOLD}  Density6 LLC · $(date '+%Y-%m-%d %H:%M:%S %Z')${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    preflight

    case "${1:-apply}" in
        --nuke)
            nuke_database
            apply_migration
            verify_schema
            ;;
        --verify)
            verify_schema
            ;;
        --count)
            count_objects
            ;;
        --dry-run)
            dry_run
            ;;
        apply|"")
            apply_migration
            verify_schema
            ;;
        *)
            echo "Usage: $0 [--nuke | --verify | --count | --dry-run]"
            exit 1
            ;;
    esac

    echo ""
    ok "Log written to: ${LOG_FILE}"
}

main "$@"
