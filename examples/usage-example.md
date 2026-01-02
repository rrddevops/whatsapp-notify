# Exemplos de Uso do Bot WhatsApp

## 📱 Exemplo 1: Agendar Mensagem para um Grupo

```bash
curl -X POST http://localhost:3000/api/scheduled-messages \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "120363123456789012@g.us",
    "message": "Bom dia grupo! Lembrete: reunião às 14h hoje.",
    "scheduledAt": "2024-12-20T08:00:00Z"
  }'
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-da-mensagem",
    "groupId": "120363123456789012@g.us",
    "message": "Bom dia grupo! Lembrete: reunião às 14h hoje.",
    "scheduledAt": "2024-12-20T08:00:00Z",
    "status": "pending",
    "createdAt": "2024-12-19T10:00:00Z"
  }
}
```

## 🤖 Exemplo 2: Configurar IA com Prompt Personalizado

```bash
curl -X PUT http://localhost:3000/api/ai/status \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "respondToGroups": true,
    "respondToDMs": true,
    "systemPrompt": "Você é um assistente de vendas. Seja profissional, amigável e sempre ofereça ajuda para encontrar o produto ideal para o cliente."
  }'
```

## 📊 Exemplo 3: Verificar Status de Mensagens Agendadas

```bash
# Todas as mensagens
curl http://localhost:3000/api/scheduled-messages

# Apenas pendentes
curl http://localhost:3000/api/scheduled-messages?status=pending

# Apenas enviadas
curl http://localhost:3000/api/scheduled-messages?status=sent
```

## 🎯 Exemplo 4: Enviar Mensagem Manual Imediata

```bash
curl -X POST http://localhost:3000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5511999999999@c.us",
    "message": "Olá! Esta é uma mensagem de teste."
  }'
```

## 🔄 Exemplo 5: Alternar IA (Toggle)

```bash
# Ativar/Desativar alternadamente
curl -X POST http://localhost:3000/api/ai/toggle
```

## 📝 Exemplo 6: JavaScript/Node.js

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

// Agendar mensagem
async function scheduleMessage() {
  const response = await axios.post(`${API_BASE}/scheduled-messages`, {
    groupId: '120363123456789012@g.us',
    message: 'Mensagem agendada',
    scheduledAt: '2024-12-25T10:00:00Z'
  });
  console.log('Mensagem agendada:', response.data);
}

// Ativar IA
async function enableAI() {
  const response = await axios.put(`${API_BASE}/ai/status`, {
    enabled: true,
    respondToGroups: true,
    respondToDMs: true
  });
  console.log('IA ativada:', response.data);
}

// Obter QR Code
async function getQRCode() {
  const response = await axios.get(`${API_BASE}/whatsapp/qrcode`);
  console.log('QR Code:', response.data.qrCode);
}
```

## 🐍 Exemplo 7: Python

```python
import requests
import json

API_BASE = "http://localhost:3000/api"

# Agendar mensagem
def schedule_message():
    data = {
        "groupId": "120363123456789012@g.us",
        "message": "Mensagem agendada",
        "scheduledAt": "2024-12-25T10:00:00Z"
    }
    response = requests.post(f"{API_BASE}/scheduled-messages", json=data)
    print("Mensagem agendada:", response.json())

# Ativar IA
def enable_ai():
    data = {
        "enabled": True,
        "respondToGroups": True,
        "respondToDMs": True
    }
    response = requests.put(f"{API_BASE}/ai/status", json=data)
    print("IA ativada:", response.json())
```

## 💬 Comandos via WhatsApp

Envie estas mensagens diretamente no WhatsApp:

- `!ia on` - Ativa a IA
- `!ia off` - Desativa a IA  
- `!ia status` - Verifica se a IA está ativa
- `!help` - Lista todos os comandos disponíveis

## 🔍 Obter ID de Grupo

1. Adicione o bot ao grupo desejado
2. Envie qualquer mensagem no grupo
3. Verifique os logs do servidor - o ID será exibido
4. Formato: `120363123456789012@g.us`

## ⚙️ Configuração Avançada

### Personalizar Prompt da IA

```bash
curl -X PUT http://localhost:3000/api/ai/status \
  -H "Content-Type: application/json" \
  -d '{
    "systemPrompt": "Você é um assistente especializado em suporte técnico. Sempre seja claro, objetivo e ofereça soluções práticas."
  }'
```

### Configurar Respostas Apenas em DMs

```bash
curl -X PUT http://localhost:3000/api/ai/status \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "respondToGroups": false,
    "respondToDMs": true
  }'
```
