#!/bin/sh
# setup-db.sh — Detect the database provider from DATABASE_URL and configure
# Prisma schema + migrations accordingly.
#
# Usage:
#   DATABASE_URL="postgresql://..." ./prisma/setup-db.sh
#   DATABASE_URL="file:./dev.db"    ./prisma/setup-db.sh
#
# This script is idempotent and safe to re-run.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCHEMA_FILE="${SCHEMA_FILE:-${SCRIPT_DIR}/schema.prisma}"

# ---------------------------------------------------------------------------
# Detect provider from DATABASE_URL
# ---------------------------------------------------------------------------
detect_provider() {
  local url="${DATABASE_URL:-}"
  case "$url" in
    postgresql://*|postgres://*)
      echo "postgresql"
      ;;
    *)
      echo "sqlite"
      ;;
  esac
}

PROVIDER="$(detect_provider)"
echo "[setup-db] Detected database provider: ${PROVIDER}"

# ---------------------------------------------------------------------------
# Rewrite the datasource provider in schema.prisma
# ---------------------------------------------------------------------------
if [ -f "${SCHEMA_FILE}" ]; then
  # Replace provider = "sqlite" or provider = "postgresql" with the detected one
  sed -i "s/provider *= *\"sqlite\"/provider = \"${PROVIDER}\"/" "${SCHEMA_FILE}"
  sed -i "s/provider *= *\"postgresql\"/provider = \"${PROVIDER}\"/" "${SCHEMA_FILE}"
  echo "[setup-db] Updated ${SCHEMA_FILE} provider to \"${PROVIDER}\""
else
  echo "[setup-db] WARNING: ${SCHEMA_FILE} not found — skipping provider rewrite"
fi

# ---------------------------------------------------------------------------
# Copy the correct migrations directory
# ---------------------------------------------------------------------------
MIGRATIONS_SRC="${SCRIPT_DIR}/migrations-${PROVIDER}"
# Fallback: if provider is sqlite the existing migrations/ dir is already correct
if [ "${PROVIDER}" = "sqlite" ]; then
  # For SQLite, the default migrations/ directory is already correct.
  # If running inside Docker, the entrypoint copies from prisma_template.
  echo "[setup-db] Using default SQLite migrations"
else
  if [ -d "${MIGRATIONS_SRC}" ]; then
    echo "[setup-db] Copying ${PROVIDER} migrations from ${MIGRATIONS_SRC}..."
    # Ensure migrations dir exists
    mkdir -p "${SCRIPT_DIR}/migrations"
    # Remove existing SQLite migrations (they are incompatible)
    rm -rf "${SCRIPT_DIR}/migrations/"*
    # Copy PostgreSQL migrations into place
    cp -R "${MIGRATIONS_SRC}/." "${SCRIPT_DIR}/migrations/"
    echo "[setup-db] PostgreSQL migrations installed"
  else
    echo "[setup-db] WARNING: No migrations directory found at ${MIGRATIONS_SRC}"
    echo "[setup-db] You may need to run 'npx prisma migrate dev --name init' to create initial migrations"
  fi
fi

echo "[setup-db] Database setup complete (provider=${PROVIDER})"
