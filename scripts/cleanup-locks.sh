#!/bin/sh
# Script para limpar locks do Chromium antes de iniciar o bot

SESSION_PATH=${WHATSAPP_SESSION_PATH:-./sessions}

echo "Limpando locks do Chromium em $SESSION_PATH..."

# Remover todos os arquivos de lock
find "$SESSION_PATH" -name "*Lock*" -type f -delete 2>/dev/null || true
find "$SESSION_PATH" -name "*lock*" -type f -delete 2>/dev/null || true
find "$SESSION_PATH" -name "SingletonSocket" -type f -delete 2>/dev/null || true

# Remover diretórios de lock vazios
find "$SESSION_PATH" -type d -empty -delete 2>/dev/null || true

echo "Limpeza concluída."
