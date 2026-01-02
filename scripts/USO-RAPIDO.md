# Guia Rápido - Importação CSV

powershell.exe -executionpolicy bypass .\scripts\import-csv.ps1 -CsvPath ".\scripts\example-mensagens.csv"
Horário UTC (adicionar mais 3h)

## PowerShell (Windows)

### 1. Habilitar execução de scripts (se necessário)

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 2. Executar o script

```powershell
# Usando o arquivo de exemplo
.\scripts\import-csv.ps1 -CsvPath ".\scripts\example-mensagens.csv"

# Com API customizada
.\scripts\import-csv.ps1 -CsvPath ".\scripts\example-mensagens.csv" -ApiBase "http://localhost:3000/api"
```

### 3. Testar conexão com API

```powershell
.\scripts\test-api.ps1
```

## Node.js/TypeScript

### 1. Instalar dependências

```bash
npm install
```

### 2. Executar o script

```bash
npm run import-csv ./scripts/example-mensagens.csv
```

## Formato do CSV

```csv
id-grupo,data,hora,Complemento,Livro1,Livro2,Livro3,Youtube,Spotfy
120363421584683066@g.us,02/01/2025,08:00,1,Lucas 5:27-39,Gênesis 1-2,Salmos 1,https://youtu.be/...,https://open.spotify.com/...
```

## Verificar Mensagens Agendadas

```powershell
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3000/api/scheduled-messages" | ConvertTo-Json

# Ou via navegador
# http://localhost:3000/api/scheduled-messages
```
