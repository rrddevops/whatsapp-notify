# Script PowerShell para importar mensagens agendadas de um arquivo CSV
# 
# Uso:
#   .\scripts\import-csv.ps1 -CsvPath ".\scripts\example-mensagens.csv"
#   .\scripts\import-csv.ps1 -CsvPath ".\scripts\example-mensagens.csv" -ApiBase "http://localhost:3000/api"

param(
    [Parameter(Mandatory=$true)]
    [string]$CsvPath,
    
    [Parameter(Mandatory=$false)]
    [string]$ApiBase = "http://localhost:3000/api"
)

# Configurar encoding UTF-8 para o console e output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$OutputEncoding = [System.Text.Encoding]::UTF8

# Funcao para formatar a mensagem usando o template
function Format-Message {
    param(
        [hashtable]$Row
    )
    
    $livro1 = $Row.Livro1
    $livro2 = $Row.Livro2
    $livro3 = $Row.Livro3
    $complemento = $Row.Complemento
    $youtube = $Row.Youtube
    $spotfy = $Row.Spotfy
    
    # Construir mensagem sem emojis para evitar problemas de encoding
    $message = @"
* Lembrete de Leitura - Plano Anual da Biblia | Dia $complemento *

Ola!
Passei para lembrar do nosso compromisso de hoje no Plano de Leitura Anual da Biblia.

* Leitura do dia: *
- $livro1
- $livro2
- $livro3

* Video explicativo (YouTube): *
$youtube

* Audio / Podcast (Spotify): *
$spotfy

Separe um tempo, leia com atencao e permita que a Palavra transforme o seu dia.

PneumaBR - Palavra, Espirito e Vida no seu cotidiano.
"@
    
    return $message
}

# Funcao para converter data e hora do formato brasileiro para ISO
function Convert-DateTime {
    param(
        [string]$DateStr,
        [string]$TimeStr
    )
    
    try {
        $dateParts = $DateStr -split '/'
        if ($dateParts.Length -ne 3) {
            throw "Formato de data invalido: $DateStr. Use DD/MM/YYYY"
        }
        
        $day = [int]$dateParts[0]
        $month = [int]$dateParts[1]
        $year = [int]$dateParts[2]
        
        $timeParts = $TimeStr -split ':'
        if ($timeParts.Length -ne 2) {
            throw "Formato de hora invalido: $TimeStr. Use HH:MM"
        }
        
        $hours = [int]$timeParts[0]
        $minutes = [int]$timeParts[1]
        
        $dateTime = Get-Date -Year $year -Month $month -Day $day -Hour $hours -Minute $minutes -Second 0
        
        return $dateTime
    }
    catch {
        throw "Erro ao converter data/hora: $($_.Exception.Message)"
    }
}

# Funcao para criar JSON manualmente com UTF-8 correto
function Create-JsonBody {
    param(
        [string]$GroupId,
        [string]$Message,
        [string]$ScheduledAt
    )
    
    # Usar System.Text.Json se disponível (PowerShell 7+) ou criar manualmente
    if ($PSVersionTable.PSVersion.Major -ge 7) {
        # PowerShell 7+ tem System.Text.Json nativo
        $jsonObj = @{
            groupId = $GroupId
            message = $Message
            scheduledAt = $ScheduledAt
        }
        return $jsonObj | ConvertTo-Json -Depth 10 -Compress -AsArray:$false
    }
    
    # Para PowerShell 5.1, criar JSON manualmente garantindo UTF-8
    # Converter a mensagem para bytes UTF-8 e depois para string para garantir encoding correto
    $utf8 = New-Object System.Text.UTF8Encoding $false
    $messageBytes = $utf8.GetBytes($Message)
    $messageUtf8 = $utf8.GetString($messageBytes)
    
    # Escapar caracteres especiais para JSON
    $messageEscaped = $messageUtf8 -replace '\\', '\\' -replace '"', '\"' -replace "`n", '\n' -replace "`r", '\r' -replace "`t", '\t'
    $groupIdEscaped = $GroupId -replace '\\', '\\' -replace '"', '\"'
    
    return "{`"groupId`":`"$groupIdEscaped`",`"message`":`"$messageEscaped`",`"scheduledAt`":`"$ScheduledAt`"}"
}

# Funcao para criar mensagem agendada via API
function New-ScheduledMessage {
    param(
        [string]$GroupId,
        [string]$Message,
        [DateTime]$ScheduledAt
    )
    
    $uri = "$ApiBase/scheduled-messages"
    
    # Criar objeto para JSON
    $jsonObj = @{
        groupId = $GroupId
        message = $Message
        scheduledAt = $ScheduledAt.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    }
    
    # Criar JSON manualmente garantindo UTF-8 correto
    # Primeiro, garantir que a mensagem está em UTF-8
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    
    # Converter mensagem para bytes UTF-8 e depois de volta para string
    # Isso garante que estamos trabalhando com UTF-8 puro
    $messageBytes = $utf8NoBom.GetBytes($Message)
    $messageUtf8 = $utf8NoBom.GetString($messageBytes)
    
    # Escapar caracteres especiais para JSON (sem alterar encoding)
    # Usar replace simples para manter UTF-8 intacto
    $messageEscaped = $messageUtf8 -replace '\\', '\\' -replace '"', '\"' -replace "`r`n", '\n' -replace "`n", '\n' -replace "`r", '\n' -replace "`t", '\t'
    
    $groupIdEscaped = $GroupId -replace '\\', '\\' -replace '"', '\"'
    $scheduledAtStr = $ScheduledAt.ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
    
    # Construir JSON manualmente
    $jsonString = "{`"groupId`":`"$groupIdEscaped`",`"message`":`"$messageEscaped`",`"scheduledAt`":`"$scheduledAtStr`"}"
    
    # Converter string para bytes UTF-8 sem BOM explicitamente
    $bodyBytes = $utf8NoBom.GetBytes($jsonString)
    
    try {
        # Usar Invoke-WebRequest com -UseBasicParsing para evitar problemas de segurança
        $headers = @{
            'Content-Type' = 'application/json; charset=utf-8'
        }
        $response = Invoke-WebRequest -Uri $uri -Method Post -Body $bodyBytes -Headers $headers -UseBasicParsing -ErrorAction Stop
        $responseContent = $response.Content | ConvertFrom-Json
        return $responseContent
    }
    catch {
        $errorDetails = $_.ErrorDetails.Message
        if ($errorDetails) {
            try {
                $errorObj = $errorDetails | ConvertFrom-Json
                throw $errorObj.error
            }
            catch {
                throw $errorDetails
            }
        }
        throw $_.Exception.Message
    }
}

# Verificar se o arquivo existe
if (-not (Test-Path $CsvPath)) {
    Write-Host "[ERRO] Arquivo nao encontrado: $CsvPath" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Lendo arquivo CSV: $CsvPath" -ForegroundColor Cyan

try {
    $csvData = Import-Csv -Path $CsvPath -Encoding UTF8
    
    Write-Host "[OK] $($csvData.Count) linhas encontradas no CSV" -ForegroundColor Green
    Write-Host ""
    
    $successCount = 0
    $errorCount = 0
    $skippedCount = 0
    $errors = @()
    
    for ($i = 0; $i -lt $csvData.Count; $i++) {
        $row = $csvData[$i]
        $rowNumber = $i + 2
        
        Write-Host ""
        Write-Host "[$($rowNumber)/$($csvData.Count)] Processando linha $rowNumber..." -ForegroundColor Yellow
        Write-Host "   Grupo: $($row.'id-grupo')" -ForegroundColor Gray
        Write-Host "   Data/Hora: $($row.data) $($row.hora)" -ForegroundColor Gray
        Write-Host "   Complemento: $($row.Complemento)" -ForegroundColor Gray
        
        try {
            if (-not $row.'id-grupo' -or -not $row.data -or -not $row.hora) {
                throw "Campos obrigatorios faltando: id-grupo, data ou hora"
            }
            
            $scheduledAt = Convert-DateTime -DateStr $row.data -TimeStr $row.hora
            
            if ($scheduledAt -le (Get-Date)) {
                Write-Host "   [AVISO] Data/hora ja passou. Pulando..." -ForegroundColor Yellow
                $skippedCount++
                continue
            }
            
            $message = Format-Message -Row @{
                Complemento = $row.Complemento
                Livro1 = $row.Livro1
                Livro2 = $row.Livro2
                Livro3 = $row.Livro3
                Youtube = $row.Youtube
                Spotfy = $row.Spotfy
            }
            
            Write-Host "   [ENVIANDO] Criando mensagem agendada..." -ForegroundColor Cyan
            $result = New-ScheduledMessage -GroupId $row.'id-grupo' -Message $message -ScheduledAt $scheduledAt
            
            if ($result.success) {
                Write-Host "   [OK] Mensagem agendada criada com sucesso!" -ForegroundColor Green
                Write-Host "   ID: $($result.data.id)" -ForegroundColor Gray
                $formattedDate = $scheduledAt.ToString("dd/MM/yyyy HH:mm")
                Write-Host "   Agendada para: $formattedDate" -ForegroundColor Gray
                $successCount++
            }
            else {
                throw $result.error
            }
            
            Start-Sleep -Milliseconds 500
        }
        catch {
            Write-Host "   [ERRO] Erro na linha $rowNumber : $($_.Exception.Message)" -ForegroundColor Red
            $errorCount++
            $errors += @{
                Row = $rowNumber
                Error = $_.Exception.Message
            }
        }
    }
    
    Write-Host ""
    Write-Host ""
    Write-Host $('=' * 60) -ForegroundColor Cyan
    Write-Host "RESUMO DA IMPORTACAO" -ForegroundColor Cyan
    Write-Host $('=' * 60) -ForegroundColor Cyan
    Write-Host "[OK] Sucesso: $successCount" -ForegroundColor Green
    Write-Host "[AVISO] Puladas: $skippedCount" -ForegroundColor Yellow
    Write-Host "[ERRO] Erros: $errorCount" -ForegroundColor Red
    Write-Host "[INFO] Total processado: $($csvData.Count)" -ForegroundColor Cyan
    
    if ($errors.Count -gt 0) {
        Write-Host ""
        Write-Host "[AVISO] ERROS ENCONTRADOS:" -ForegroundColor Yellow
        foreach ($error in $errors) {
            Write-Host "   Linha $($error.Row): $($error.Error)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "[OK] Importacao concluida!" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host ""
    Write-Host "[ERRO] Erro ao processar CSV: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
