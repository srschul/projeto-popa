#!/usr/bin/env bash
# Roda migrações + testes em um Postgres LOCAL e descartável (nunca no Supabase real).
# Uso:  PGHOST=/caminho/socket PGUSER=postgres ./supabase/tests/run.sh
# Requer psql e um servidor Postgres 15+ onde o usuário possa criar bancos e roles.
set -euo pipefail

case "${PGHOST:-}" in
  *supabase.co*|*supabase.com*|*pooler*) echo "Recusado: PGHOST aponta para um Supabase real." >&2; exit 2;;
esac

DB="${POPA_TEST_DB:-popa_test}"
cd "$(dirname "$0")/.."

psql -d postgres -qAt -c "drop database if exists \"$DB\"" -c "create database \"$DB\"" >/dev/null
export PGDATABASE="$DB"

echo ">> stubs do Supabase"
psql -q -v ON_ERROR_STOP=1 -f tests/00_supabase_stubs.sql -o /dev/null

apply_migrations() {
  local f out
  for f in migrations/*.sql; do
    out=$(psql -q -v ON_ERROR_STOP=1 -f "$f" -o /dev/null 2>&1) || { echo "$out"; echo "FALHA em $f" >&2; exit 1; }
    printf '%s\n' "$out" | grep -Ev '(does not exist|already exists), skipping' || true
  done
}

echo ">> migrações (1ª execução)"
apply_migrations

echo ">> migrações (2ª execução: precisam ser reexecutáveis)"
apply_migrations

for f in tests/10_rls_tests.sql tests/20_gamification_tests.sql; do
  echo ">> $f"
  psql -q -v ON_ERROR_STOP=1 -f "$f" -o /dev/null 2>&1 | sed -E 's/^psql:[^ ]+ NOTICE:  //'
done

echo ">> TODOS OS TESTES PASSARAM"
