# WhatsApp Bot com ChatGPT

Bot profissional de WhatsApp com funcionalidades de agendamento de mensagens e respostas automáticas usando ChatGPT.

## 🚀 Funcionalidades

- ✅ Conexão com WhatsApp via QR Code
- ✅ Envio de mensagens agendadas para grupos
- ✅ Respostas automáticas com ChatGPT
- ✅ Controle de ativação/desativação da IA
- ✅ **Painel Web de Gerenciamento** (Frontend)
- ✅ API REST para gerenciamento
- ✅ Comandos via WhatsApp (!ia on/off)
- ✅ Logs estruturados
- ✅ Rate limiting
- ✅ Docker support

## 📋 Pré-requisitos

- Node.js 18+ ou Docker
- PostgreSQL 15+ (ou usar Docker Compose)
- Conta OpenAI com API Key
- WhatsApp instalado no celular

## 🛠️ Instalação

### Opção 1: Instalação Local

1. Clone o repositório:
```bash
git clone <repository-url>
cd whatsapp_bot
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp env.example .env
```

Edite o arquivo `.env` com suas configurações:
```env
OPENAI_API_KEY=sua_chave_aqui
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=whatsapp_bot
```

4. Inicialize o banco de dados:
```bash
npm run migration:run
```

5. Inicie o servidor:
```bash
npm run dev
```

### Opção 2: Docker Compose

1. Configure o arquivo `.env` (copie de `env.example`)

2. Inicie os serviços:
```bash
docker-compose up -d
```

3. Verifique os logs:
```bash
docker-compose logs -f bot
```

## 🌐 Painel Web de Gerenciamento

Acesse `http://localhost:3000` no seu navegador para usar o painel web completo com:

- 📊 Dashboard de status do sistema
- 📱 Visualização e escaneamento de QR Code
- 📅 Gerenciamento de mensagens agendadas
- 🤖 Configuração da IA (ativar/desativar, prompts personalizados)
- 💬 Envio de mensagens manuais

## 📱 Conectando o WhatsApp

1. Inicie o servidor (local ou Docker)

2. Acesse o QR Code de uma das formas:
   - **Painel Web**: Acesse `http://localhost:3000` e vá na aba "QR Code"
   - **Terminal**: O QR Code será exibido automaticamente no terminal
   - **API**: Acesse `http://localhost:3000/api/whatsapp/qrcode`

3. Abra o WhatsApp no seu celular:
   - Vá em **Configurações** > **Aparelhos conectados**
   - Toque em **Conectar um aparelho**
   - Escaneie o QR Code exibido

4. Aguarde a mensagem "WhatsApp conectado e pronto!" no terminal

## 📅 Agendando Mensagens

### Via API REST

```bash
POST http://localhost:3000/api/scheduled-messages
Content-Type: application/json

{
  "groupId": "120363123456789012@g.us",
  "message": "Olá grupo! Esta é uma mensagem agendada.",
  "scheduledAt": "2024-12-25T10:00:00Z"
}
```

### Listar Mensagens Agendadas

```bash
GET http://localhost:3000/api/scheduled-messages
GET http://localhost:3000/api/scheduled-messages?status=pending
```

### Cancelar Mensagem Agendada

```bash
DELETE http://localhost:3000/api/scheduled-messages/{id}
```

## 🤖 Configurando a IA (ChatGPT)

### Ativar/Desativar via WhatsApp

Envie uma das mensagens no WhatsApp:
- `!ia on` ou `!ai on` - Ativa a IA
- `!ia off` ou `!ai off` - Desativa a IA
- `!ia status` ou `!ai status` - Verifica status
- `!help` ou `!ajuda` - Lista comandos disponíveis

### Ativar/Desativar via API

```bash
# Ver status
GET http://localhost:3000/api/ai/status

# Atualizar configuração
PUT http://localhost:3000/api/ai/status
Content-Type: application/json

{
  "enabled": true,
  "respondToGroups": true,
  "respondToDMs": true,
  "systemPrompt": "Você é um assistente virtual profissional."
}

# Alternar (toggle)
POST http://localhost:3000/api/ai/toggle
```

## 📡 Endpoints da API

### WhatsApp
- `GET /api/whatsapp/status` - Status da conexão
- `GET /api/whatsapp/qrcode` - Obter QR Code
- `POST /api/whatsapp/send` - Enviar mensagem manual

### Mensagens Agendadas
- `POST /api/scheduled-messages` - Criar agendamento
- `GET /api/scheduled-messages` - Listar agendamentos
- `DELETE /api/scheduled-messages/:id` - Cancelar agendamento

### IA
- `GET /api/ai/status` - Status da IA
- `PUT /api/ai/status` - Atualizar configuração
- `POST /api/ai/toggle` - Alternar ativação

### Health Check
- `GET /api/health` - Status da aplicação

## 🔧 Configurações Avançadas

### Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta do servidor | 3000 |
| `OPENAI_API_KEY` | Chave da API OpenAI | - |
| `OPENAI_MODEL` | Modelo do ChatGPT | gpt-3.5-turbo |
| `OPENAI_MAX_TOKENS` | Máximo de tokens | 500 |
| `OPENAI_TEMPERATURE` | Temperatura (0-1) | 0.7 |
| `AI_ENABLED_BY_DEFAULT` | IA ativa por padrão | false |
| `AI_RESPOND_TO_GROUPS` | Responder em grupos | true |
| `AI_RESPOND_TO_DMS` | Responder em DMs | true |

### Obter ID de Grupo

Para obter o ID de um grupo no WhatsApp:

1. Adicione o bot ao grupo
2. Envie uma mensagem no grupo
3. Verifique os logs do servidor - o ID será exibido

Ou use a API para enviar uma mensagem de teste e verificar os logs.

## 📝 Estrutura do Projeto

```
whatsapp_bot/
├── src/
│   ├── bot/
│   │   └── MessageHandler.ts      # Handler de mensagens
│   ├── config/
│   │   ├── database.ts            # Configuração do banco
│   │   └── logger.ts              # Configuração de logs
│   ├── controllers/
│   │   ├── AIController.ts        # Controle da IA
│   │   ├── ScheduledMessageController.ts
│   │   └── WhatsAppController.ts
│   ├── entities/
│   │   ├── AIConfig.ts            # Entidade de configuração
│   │   ├── MessageLog.ts          # Log de mensagens
│   │   └── ScheduledMessage.ts    # Mensagens agendadas
│   ├── routes/
│   │   └── index.ts               # Rotas da API
│   ├── services/
│   │   ├── ChatGPTService.ts     # Integração ChatGPT
│   │   ├── SchedulerService.ts    # Agendamento
│   │   └── WhatsAppService.ts     # Serviço WhatsApp
│   └── index.ts                   # Entry point
├── docker-compose.yml
├── Dockerfile
├── package.json
└── README.md
```

## 🔒 Segurança

- Variáveis sensíveis em `.env` (não commitar)
- Rate limiting nas APIs
- Validação de entrada
- Logs estruturados
- Tratamento de erros

## 🐛 Troubleshooting

### QR Code não aparece
- Verifique se a porta 3000 está disponível
- Verifique os logs para erros
- Tente reiniciar o servidor

### WhatsApp desconecta frequentemente
- Verifique a conexão de internet
- Não desconecte manualmente no celular
- A sessão é persistida em `./sessions`

### IA não responde
- Verifique se está ativada: `GET /api/ai/status`
- Verifique se `OPENAI_API_KEY` está configurada
- Verifique os logs para erros da API

### Mensagens agendadas não são enviadas
- Verifique se o WhatsApp está conectado
- Verifique o status da mensagem: `GET /api/scheduled-messages`
- Verifique os logs para erros

## 📄 Licença

MIT

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.

## 📞 Suporte

Para problemas ou dúvidas, abra uma issue no repositório.
