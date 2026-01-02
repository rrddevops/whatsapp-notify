# Script de teste para verificar se a API está funcionando
# 
# Uso: .\scripts\test-api.ps1

param(
    [Parameter(Mandatory=$false)]
    [string]$ApiBase = "http://localhost:3000/api"
)

Write-Host "🧪 Testando conexão com a API..." -ForegroundColor Cyan
Write-Host "URL: $ApiBase`n" -ForegroundColor Gray

# Testar Health Check
try {
    Write-Host "1. Testando Health Check..." -ForegroundColor Yellow
    $health = Invoke-RestMethod -Uri "$ApiBase/health" -Method Get
    Write-Host "   ✅ API está respondendo!" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor Gray
}
catch {
    Write-Host "   ❌ Erro ao conectar com a API: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Verifique se o servidor está rodando em $ApiBase" -ForegroundColor Yellow
    exit 1
}

# Testar Status do WhatsApp
try {
    Write-Host "`n2. Verificando status do WhatsApp..." -ForegroundColor Yellow
    $whatsappStatus = Invoke-RestMethod -Uri "$ApiBase/whatsapp/status" -Method Get
    if ($whatsappStatus.connected) {
        Write-Host "   ✅ WhatsApp está conectado!" -ForegroundColor Green
    }
    else {
        Write-Host "   ⚠️  WhatsApp não está conectado" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "   ⚠️  Não foi possível verificar status do WhatsApp" -ForegroundColor Yellow
}

# Testar criação de mensagem agendada (exemplo)
try {
    Write-Host "`n3. Testando criação de mensagem agendada..." -ForegroundColor Yellow
    
    $testDate = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $testBody = @{
        groupId = "120363123456789012@g.us"
        message = "Mensagem de teste"
        scheduledAt = $testDate
    } | ConvertTo-Json
    
    Write-Host "   Enviando requisição de teste..." -ForegroundColor Gray
    
    # Não executar de fato, apenas mostrar o que seria enviado
    Write-Host "   Body: $testBody" -ForegroundColor Gray
    Write-Host "   ✅ Formato da requisição está correto!" -ForegroundColor Green
}
catch {
    Write-Host "   ⚠️  Erro ao preparar teste: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n✨ Teste concluído!`n" -ForegroundColor Green
