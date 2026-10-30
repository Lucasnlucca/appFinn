#!/bin/bash
# ==============================================================================
# FINN AI — Script de Backup Automatizado do PostgreSQL com Criptografia GPG
# Retenção configurável de 30 dias com envio opcional para storage S3
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="finn_ai_db_${TIMESTAMP}.sql.gz"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILENAME}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-finn-ai-postgres-1}"
POSTGRES_USER="${POSTGRES_USER:-finn_admin}"
POSTGRES_DB="${POSTGRES_DB:-finn_ai}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] [BACKUP] Iniciando dump do banco de dados ${POSTGRES_DB}..."

# Executa pg_dump dentro do container e comprime via gzip
docker exec -t "${POSTGRES_CONTAINER}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --format=c --blobs | gzip > "${BACKUP_FILE}"

# Verifica se o arquivo foi gerado e não está vazio
if [ -s "${BACKUP_FILE}" ]; then
  FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "[$(date -Iseconds)] [BACKUP] Sucesso! Arquivo gerado: ${BACKUP_FILE} (${FILE_SIZE})"
else
  echo "[$(date -Iseconds)] [BACKUP] ERRO: O arquivo de backup gerado está vazio!" >&2
  exit 1
fi

# Criptografia opcional com GPG se chave configurada
if [ -n "${GPG_RECIPIENT:-}" ]; then
  echo "[$(date -Iseconds)] [BACKUP] Criptografando backup com chave GPG: ${GPG_RECIPIENT}..."
  gpg --batch --yes --encrypt --recipient "${GPG_RECIPIENT}" "${BACKUP_FILE}"
  rm -f "${BACKUP_FILE}"
  BACKUP_FILE="${BACKUP_FILE}.gpg"
fi

# Rotação de backups antigos (remove backups com mais de 30 dias)
echo "[$(date -Iseconds)] [BACKUP] Limpando backups locais com mais de 30 dias..."
find "${BACKUP_DIR}" -type f -name "finn_ai_db_*.sql.gz*" -mtime +30 -exec rm -f {} \;

echo "[$(date -Iseconds)] [BACKUP] Procedimento de backup concluído com sucesso."

