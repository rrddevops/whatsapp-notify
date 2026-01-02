# Guia de Teste - Importação CSV

## Problema Identificado

O script está funcionando corretamente, mas as mensagens do arquivo `example-mensagens.csv` foram puladas porque as datas já passaram (02/01/2025 e 03/01/2025).

## Solução

Use o arquivo `example-mensagens-futuras.csv` que contém datas futuras (janeiro de 2026).

## Passos para Testar

### 1. Verificar mensagens existentes no sistema

```powershell
# Ver todas as mensagens agendadas
Invoke-RestMethod -Uri "http://localhost:3000/api/scheduled-messages" | ConvertTo-Json -Depth 10

# Ver apenas mensagens pendentes
Invoke-RestMethod -Uri "http://localhost:3000/api/scheduled-messages?status=pending" | ConvertTo-Json -Depth 10

# Ver apenas mensagens enviadas
Invoke-RestMethod -Uri "http://localhost:3000/api/scheduled-messages?status=sent" | ConvertTo-Json -Depth 10
```

### 2. Importar mensagens com datas futuras

```powershell
powershell.exe -executionpolicy bypass .\scripts\import-csv.ps1 -CsvPath ".\scripts\example-mensagens-futuras.csv"
```

### 3. Verificar se as mensagens foram criadas

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/scheduled-messages?status=pending" | ConvertTo-Json -Depth 10
```

## Status das Mensagens

- **pending**: Mensagem agendada, aguardando envio
- **sent**: Mensagem já foi enviada
- **failed**: Mensagem falhou ao enviar

## Exemplo de Resposta da API

```json
{
    "success": true,
    "data": [
        {
            "id": "uuid-da-mensagem",
            "groupId": "120363421584683066@g.us",
            "message": "Mensagem formatada...",
            "scheduledAt": "2026-01-15T08:00:00.000Z",
            "status": "pending",
            "errorMessage": null,
            "sentAt": null,
            "createdAt": "2026-01-02T16:00:00.000Z",
            "updatedAt": "2026-01-02T16:00:00.000Z"
        }
    ],
    "count": 1
}
```

## Notas Importantes

1. **Datas Passadas**: O script automaticamente pula mensagens com datas/horas no passado
2. **Validação**: O script valida campos obrigatórios antes de criar a mensagem
3. **Rate Limiting**: Há um delay de 500ms entre cada requisição para não sobrecarregar a API
4. **Formato de Data**: Use DD/MM/YYYY (ex: 15/01/2026)
5. **Formato de Hora**: Use HH:MM (ex: 08:00)
