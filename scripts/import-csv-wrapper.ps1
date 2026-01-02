# Wrapper PowerShell que chama o script TypeScript (que funciona corretamente com UTF-8)
# 
# Uso:
#   .\scripts\import-csv-wrapper.ps1 -CsvPath ".\scripts\example-mensagens.csv"

param(
    [Parameter(Mandatory=$true)]
    [string]$CsvPath,
    
    [Parameter(Mandatory=$false)]
    [string]$ApiBase = "http://localhost:3000/api"
)

# Verificar se Node.js está instalado
try {
    $nodeVersion = node --version
    Write-Host "[INFO] Node.js encontrado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERRO] Node.js nao encontrado. Por favor, instale o Node.js primeiro." -ForegroundColor Red
    Write-Host "       Baixe em: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Verificar se o arquivo CSV existe
if (-not (Test-Path $CsvPath)) {
    Write-Host "[ERRO] Arquivo nao encontrado: $CsvPath" -ForegroundColor Red
    exit 1
}

# Definir variável de ambiente para API_BASE se fornecida
if ($ApiBase -ne "http://localhost:3000/api") {
    $env:API_BASE = $ApiBase
}

# Obter o diretório do script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$tsScriptPath = Join-Path $scriptDir "import-csv.ts"

# Verificar se o script TypeScript existe
if (-not (Test-Path $tsScriptPath)) {
    Write-Host "[ERRO] Script TypeScript nao encontrado: $tsScriptPath" -ForegroundColor Red
    exit 1
}

# Converter caminho relativo para absoluto se necessário
if (-not [System.IO.Path]::IsPathRooted($CsvPath)) {
    $CsvPath = Resolve-Path $CsvPath
}

Write-Host "[INFO] Executando script TypeScript..." -ForegroundColor Cyan
Write-Host "[INFO] CSV: $CsvPath" -ForegroundColor Gray
Write-Host "[INFO] API: $($env:API_BASE ?? 'http://localhost:3000/api')" -ForegroundColor Gray
Write-Host ""

# Executar o script TypeScript usando ts-node
try {
    Push-Location $projectRoot
    npx ts-node $tsScriptPath $CsvPath
    $exitCode = $LASTEXITCODE
    Pop-Location
    
    if ($exitCode -ne 0) {
        Write-Host "[ERRO] Script TypeScript falhou com codigo: $exitCode" -ForegroundColor Red
        exit $exitCode
    }
} catch {
    Write-Host "[ERRO] Erro ao executar script TypeScript: $($_.Exception.Message)" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host ""
Write-Host "[OK] Importacao concluida!" -ForegroundColor Green
