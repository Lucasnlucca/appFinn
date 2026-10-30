#!/bin/bash
# ==============================================================================
# FINN AI — Script de Restauração Segura do PostgreSQL
# Permite restauração a partir de dumps compactados (.sql.gz)
# ==============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Uso: $0 <caminho_do_arquivo_backup.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-finn-ai-postgres-1}"
POSTGRES_USER="${POSTGRES_USER:-finn_admin}"
POSTGRES_DB="${POSTGRES_DB:-finn_ai}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERRO: Arquivo de backup não encontrado: ${BACKUP_FILE}" >&2
  exit 1
fi

echo "======================================================================"
echo "ATENÇÃO: A restauração irá sobrescrever os dados atuais de '${POSTGRES_DB}'!"
echo "Arquivo de origem: ${BACKUP_FILE}"
echo "======================================================================"
read -p "Deseja realmente continuar? (digite 'SIM' para confirmar): " CONFIRMATION

if [ "${CONFIRMATION}" != "SIM" ]; then
  echo "Operação abortada pelo operador."
  exit 0
fi

echo "[$(date -Iseconds)] [RESTORE] Descompactando e restaurando banco de dados..."

# Restaura o dump usando pg_restore via container
gunzip -c "${BACKUP_FILE}" | docker exec -i "${POSTGRES_CONTAINER}" pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists --no-owner --no-privileges

echo "[$(date -Iseconds)] [RESTORE] Restauração concluída com sucesso no banco ${POSTGRES_DB}!"

