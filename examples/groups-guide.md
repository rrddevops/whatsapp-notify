# Guia de Grupos do WhatsApp Bot

Este guia explica como descobrir o ID de um grupo do WhatsApp e como enviar mensagens para grupos.

## Como descobrir o ID de um grupo

### Método 1: Listar todos os grupos

Use a API para listar todos os grupos que o bot participa:

```bash
GET http://localhost:3000/api/whatsapp/groups
```

Resposta:
```json
{
  "success": true,
  "data": [
    {
      "id": "120363123456789012@g.us",
      "name": "Meu Grupo",
      "description": "Descrição do grupo",
      "participantsCount": 10,
      "isGroup": true
    }
  ],
  "count": 1
}
```

### Método 2: Obter ID a partir de um link de convite

Se você tem um link de convite do grupo (ex: `https://chat.whatsapp.com/IWQYIZuWsEWGB7HGhbr5lC`):

```bash
GET http://localhost:3000/api/whatsapp/group/invite?inviteLink=https://chat.whatsapp.com/IWQYIZuWsEWGB7HGhbr5lC
```

Resposta:
```json
{
  "success": true,
  "data": {
    "id": "120363123456789012@g.us",
    "name": "Nome do Grupo",
    "description": "Descrição",
    "participantsCount": 10,
    "inviteCode": "IWQYIZuWsEWGB7HGhbr5lC",
    "inviteLink": "https://chat.whatsapp.com/IWQYIZuWsEWGB7HGhbr5lC",
    "isGroup": true
  },
  "message": "Informações do grupo obtidas com sucesso"
}
```

### Método 3: Obter informações detalhadas de um grupo por ID

Se você já conhece o ID do grupo:

```bash
GET http://localhost:3000/api/whatsapp/group/120363123456789012@g.us
```

Resposta:
```json
{
  "success": true,
  "data": {
    "id": "120363123456789012@g.us",
    "name": "Nome do Grupo",
    "description": "Descrição do grupo",
    "participantsCount": 5,
    "participants": [
      {
        "id": "5511999999999@c.us",
        "name": "João Silva"
      }
    ],
    "isGroup": true
  }
}
```

## Como enviar mensagem para um grupo

Use o ID do grupo (formato: `120363123456789012@g.us`) para enviar mensagens:

```bash
POST http://localhost:3000/api/whatsapp/send
Content-Type: application/json

{
  "to": "120363123456789012@g.us",
  "message": "Olá grupo! Esta é uma mensagem de teste."
}
```

## Formato do ID de grupo

Os IDs de grupo do WhatsApp seguem o formato:
- `120363123456789012@g.us`
- Onde `120363` é um prefixo fixo
- `123456789012` é o ID único do grupo
- `@g.us` indica que é um grupo

## Exemplos com cURL

### Listar grupos
```bash
curl -X GET http://localhost:3000/api/whatsapp/groups
```

### Obter ID de um link de convite
```bash
curl -X GET "http://localhost:3000/api/whatsapp/group/invite?inviteLink=https://chat.whatsapp.com/IWQYIZuWsEWGB7HGhbr5lC"
```

### Enviar mensagem para grupo
```bash
curl -X POST http://localhost:3000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "120363123456789012@g.us",
    "message": "Mensagem para o grupo"
  }'
```

## Notas importantes

1. **O bot precisa estar no grupo**: Para enviar mensagens ou obter informações, o bot precisa ser membro do grupo.

2. **Link de convite**: O link de convite precisa ser válido e o bot precisa ter permissão para visualizar informações do grupo.

3. **Rate Limiting**: As rotas têm rate limiting para evitar abuso. Se receber erro 429, aguarde um pouco antes de tentar novamente.

4. **Conexão**: Certifique-se de que o WhatsApp está conectado antes de usar essas rotas. Verifique o status em `/api/whatsapp/status`.
