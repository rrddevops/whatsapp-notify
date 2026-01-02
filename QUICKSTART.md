# Guia Rápido de Início

## 🚀 Início Rápido (5 minutos)

### 1. Configuração Inicial

```bash
# Instalar dependências
npm install

# Copiar arquivo de ambiente
cp env.example .env

# Editar .env e adicionar sua OPENAI_API_KEY
# OPENAI_API_KEY=sk-...
```

### 2. Banco de Dados

#### Opção A: Docker (Recomendado)
```bash
docker-compose up -d postgres
```

#### Opção B: PostgreSQL Local
```bash
# Criar banco de dados
createdb whatsapp_bot

# Ou via psql
psql -U postgres
CREATE DATABASE whatsapp_bot;
```

### 3. Executar Migrations

```bash
npm run migration:run
```

### 4. Iniciar o Bot

```bash
npm run dev
```

### 5. Conectar WhatsApp

1. O QR Code aparecerá no terminal
2. Abra WhatsApp no celular
3. Vá em **Configurações** > **Aparelhos conectados** > **Conectar um aparelho**
4. Escaneie o QR Code

### 6. Testar Funcionalidades

#### Ativar IA via WhatsApp
Envie no WhatsApp: `!ia on`

#### Agendar Mensagem via API
```bash
curl -X POST http://localhost:3000/api/scheduled-messages \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "SEU_GROUP_ID@g.us",
    "message": "Mensagem de teste",
    "scheduledAt": "2024-12-25T10:00:00Z"
  }'
```

## 📝 Como Obter o ID do Grupo

1. Adicione o bot ao grupo
2. Envie qualquer mensagem no grupo
3. Verifique os logs do servidor - o ID será exibido
4. O formato é: `120363123456789012@g.us`

## 🔧 Comandos WhatsApp Disponíveis

- `!ia on` - Ativa a IA
- `!ia off` - Desativa a IA
- `!ia status` - Verifica status
- `!help` - Lista comandos

## 🐳 Docker Compose Completo

```bash
# Iniciar tudo (PostgreSQL + Bot)
docker-compose up -d

# Ver logs
docker-compose logs -f bot

# Parar tudo
docker-compose down
```

## ⚠️ Problemas Comuns

### QR Code não aparece
- Verifique se a porta 3000 está livre
- Verifique os logs: `npm run dev`

### Erro de conexão com banco
- Verifique se PostgreSQL está rodando
- Verifique credenciais no `.env`

### IA não responde
- Verifique se está ativada: `GET /api/ai/status`
- Verifique se `OPENAI_API_KEY` está configurada
