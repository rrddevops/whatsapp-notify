# Script de Importação CSV

Este script permite importar múltiplas mensagens agendadas a partir de um arquivo CSV.

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

## Campos

- **id-grupo**: ID do grupo do WhatsApp (formato: `120363123456789012@g.us`)
- **data**: Data no formato `DD/MM/YYYY` (ex: `02/01/2025`)
- **hora**: Hora no formato `HH:MM` (ex: `08:00`)
- **Complemento**: Número do dia do plano de leitura
- **Livro1**: Primeira leitura do dia
- **Livro2**: Segunda leitura do dia
- **Livro3**: Terceira leitura do dia
- **Youtube**: Link do vídeo do YouTube
- **Spotfy**: Link do podcast/episódio do Spotify

## Como usar

### 1. Preparar o arquivo CSV

Crie um arquivo CSV com as mensagens que deseja agendar. Veja o exemplo em `scripts/example-mensagens.csv`.

### 2. Executar o script

```bash
# Desenvolvimento (com ts-node)
npm run import-csv ./scripts/example-mensagens.csv

# Ou usando diretamente o Node.js (após build)
node dist/scripts/import-csv.js ./scripts/example-mensagens.csv
```

### 3. Usar URL da API customizada

Se a API estiver em outro servidor:

```bash
API_BASE=http://seu-servidor:3000/api npm run import-csv ./scripts/example-mensagens.csv
```

## Formato da Mensagem

A mensagem será formatada automaticamente usando o seguinte template:

```
📖✨ Lembrete de Leitura – Plano Anual da Bíblia | Dia {{Complemento}}

Olá! 👋
Passei para lembrar do nosso compromisso de hoje no Plano de Leitura Anual da Bíblia.

📅 Leitura do dia:
📘 {{Livro1}}
📗 {{Livro2}}
📙 {{Livro3}}

🎥 Vídeo explicativo (YouTube):
👉 {{Youtube}}

🎧 Áudio / Podcast (Spotify):
👉 {{Spotfy}}

🙏 Separe um tempo, leia com atenção e permita que a Palavra transforme o seu dia.

💬 PneumaBR — Palavra, Espírito e Vida no seu cotidiano.
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
- Um resumo é exibido ao final mostrando sucessos e erros

## Exemplo de Saída

```
📄 Lendo arquivo CSV: ./scripts/example-mensagens.csv
✅ 2 linhas encontradas no CSV

[2/2] Processando linha 2...
   Grupo: 120363421584683066@g.us
   Data/Hora: 02/01/2025 08:00
   Complemento: 1
   📤 Criando mensagem agendada...
   ✅ Mensagem agendada criada com sucesso!
   ID: abc123-def456-ghi789
   Agendada para: 02/01/2025 08:00:00

============================================================
📊 RESUMO DA IMPORTAÇÃO
============================================================
✅ Sucesso: 2
❌ Erros: 0
📝 Total processado: 2

✨ Importação concluída!
```

## Notas

- O script faz uma requisição por linha com um delay de 500ms entre elas para não sobrecarregar a API
- Certifique-se de que o bot WhatsApp está conectado antes de executar o script
- Verifique se os IDs dos grupos estão corretos usando `/api/whatsapp/groups`
