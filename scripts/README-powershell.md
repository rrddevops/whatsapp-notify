# Script PowerShell de Importação CSV

Este script PowerShell permite importar múltiplas mensagens agendadas a partir de um arquivo CSV, enviando os agendamentos diretamente para a API do sistema.

## Pré-requisitos

- PowerShell 5.1 ou superior
- Acesso à API do bot (padrão: http://localhost:3000/api)

## Formato do CSV

O arquivo CSV deve ter as seguintes colunas (na primeira linha):

```
id-grupo,data,hora,Complemento,Livro1,Livro2,Livro3,Youtube,Spotfy
```

### Exemplo:

```csv
id-grupo,data,hora,Complemento,Livro1,Livro2,Livro3,Youtube,Spotfy
120363421584683066@g.us,02/01/2025,08:00,1,Lucas 5:27-39,Gênesis 1-2,Salmos 1,https://youtu.be/MV3RQIPIK2E,https://open.spotify.com/episode/6WwSpZbDQgKSXCNgQfWKZS?si=90DjnJurQw2ekSUqqGL0zg
120363421584683066@g.us,03/01/2025,08:00,2,Lucas 6:1-26,Gênesis 3-5,Salmos 2,https://youtu.be/FMZ2JUKBK-A,https://open.spotify.com/episode/75jgYHFem2xWgSEzqXStRd?si=z78Ckxe2RiObNT8sPIp7aw
```

## Como usar

### Uso básico:

```powershell
.\scripts\import-csv.ps1 -CsvPath ".\scripts\example-mensagens.csv"
```

### Com API customizada:

```powershell
.\scripts\import-csv.ps1 -CsvPath ".\scripts\example-mensagens.csv" -ApiBase "http://seu-servidor:3000/api"
```

### Com caminho absoluto:

```powershell
.\scripts\import-csv.ps1 -CsvPath "D:\dados\mensagens.csv"
```

## Parâmetros

- **-CsvPath** (obrigatório): Caminho para o arquivo CSV
- **-ApiBase** (opcional): URL base da API (padrão: `http://localhost:3000/api`)

## Funcionalidades

✅ Leitura e parsing de CSV  
✅ Formatação automática da mensagem  
✅ Conversão de data/hora brasileira (DD/MM/YYYY HH:MM) para ISO  
✅ Validação de campos obrigatórios  
✅ Validação de datas futuras  
✅ Criação de mensagens agendadas via API REST  
✅ Tratamento de erros por linha  
✅ Resumo detalhado ao final  

## Exemplo de Saída

```
📄 Lendo arquivo CSV: .\scripts\example-mensagens.csv
✅ 2 linhas encontradas no CSV

[2/2] Processando linha 2...
   Grupo: 120363421584683066@g.us
   Data/Hora: 02/01/2025 08:00
   Complemento: 1
   📤 Criando mensagem agendada...
   ✅ Mensagem agendada criada com sucesso!
   ID: abc123-def456-ghi789
   Agendada para: 02/01/2025 08:00

============================================================
📊 RESUMO DA IMPORTAÇÃO
============================================================
✅ Sucesso: 2
⚠️  Puladas: 0
❌ Erros: 0
📝 Total processado: 2

✨ Importação concluída!
```

## Validações

O script valida:

- ✅ Existência do arquivo CSV
- ✅ Campos obrigatórios (id-grupo, data, hora)
- ✅ Formato da data (DD/MM/YYYY)
- ✅ Formato da hora (HH:MM)
- ✅ Se a data/hora é futura (não agenda mensagens no passado)

## Tratamento de Erros

- Mensagens com data/hora no passado são puladas automaticamente
- Erros em linhas específicas não interrompem o processamento
- Um resumo é exibido ao final mostrando sucessos, puladas e erros

## Notas

- O script faz uma requisição por linha com um delay de 500ms entre elas
- Certifique-se de que o bot WhatsApp está conectado antes de executar
- Verifique se os IDs dos grupos estão corretos usando `/api/whatsapp/groups`
- O script usa `Invoke-RestMethod` do PowerShell para fazer requisições HTTP

## Solução de Problemas

### Erro: "Não é possível executar scripts neste sistema"

Execute no PowerShell como Administrador:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Erro de conexão com a API

Verifique se:
- O servidor está rodando
- A URL da API está correta
- Não há firewall bloqueando a conexão

### Erro de encoding do CSV

Certifique-se de que o CSV está salvo em UTF-8. O script usa `-Encoding UTF8` ao importar.
