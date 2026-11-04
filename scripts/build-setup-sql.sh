#!/usr/bin/env bash
# Junta as migrações em um único arquivo para colar no SQL Editor do Supabase.
set -euo pipefail
cd "$(dirname "$0")/.."
out=supabase/setup_all.sql
{
  echo "-- PROJETO POPA — instalação completa (gerado por scripts/build-setup-sql.sh; não edite à mão)"
  for f in supabase/migrations/*.sql; do
    printf '\n-- >>>>>>>> %s\n' "$(basename "$f")"
    cat "$f"
  done
} > "$out"
echo "Gerado: $out ($(wc -l < "$out") linhas)"
