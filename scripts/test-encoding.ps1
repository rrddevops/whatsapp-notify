# Script de teste para verificar encoding UTF-8

$testMessage = @"
📖✨ Lembrete de Leitura – Plano Anual da Bíblia | Dia 1

Olá! 👋
Passei para lembrar do nosso compromisso de hoje no Plano de Leitura Anual da Bíblia.

📅 Leitura do dia:
📘 Lucas 5:27-39
📗 Gênesis 1-2
📙 Salmos 1

🎥 Vídeo explicativo (YouTube):
👉 https://youtu.be/MV3RQIPIK2E

🎧 Áudio / Podcast (Spotify):
👉 https://open.spotify.com/episode/6WwSpZbDQgKSXCNgQfWKZS?si=90DjnJurQw2ekSUqqGL0zg

🙏 Separe um tempo, leia com atenção e permita que a Palavra transforme o seu dia.

💬 PneumaBR — Palavra, Espírito e Vida no seu cotidiano.
"@

Write-Host "Mensagem original:" -ForegroundColor Cyan
Write-Host $testMessage

Write-Host "`nConvertendo para JSON..." -ForegroundColor Yellow
$jsonBody = @{
    groupId = "120363421584683066@g.us"
    message = $testMessage
    scheduledAt = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
}

$jsonString = $jsonBody | ConvertTo-Json -Depth 10 -Compress
Write-Host "JSON String:" -ForegroundColor Yellow
Write-Host $jsonString

Write-Host "`nConvertendo para bytes UTF-8..." -ForegroundColor Yellow
$utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $false
$bodyBytes = $utf8NoBomEncoding.GetBytes($jsonString)

Write-Host "Bytes length: $($bodyBytes.Length)" -ForegroundColor Green
Write-Host "Primeiros 100 bytes:" -ForegroundColor Yellow
$bodyBytes[0..99] | ForEach-Object { Write-Host ("{0:X2}" -f $_) -NoNewline; if (($_ + 1) % 16 -eq 0) { Write-Host "" } }
Write-Host "`n"

Write-Host "Testando decodificação..." -ForegroundColor Yellow
$decoded = $utf8NoBomEncoding.GetString($bodyBytes)
Write-Host "Decodificado (primeiros 200 caracteres):" -ForegroundColor Green
Write-Host $decoded.Substring(0, [Math]::Min(200, $decoded.Length))
