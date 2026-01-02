#!/usr/bin/env node

/**
 * Script para importar mensagens agendadas de um arquivo CSV
 * 
 * Uso:
 *   npm run import-csv <caminho-do-arquivo.csv>
 * 
 * Formato do CSV esperado:
 *   id-grupo,data,hora,Complemento,Livro1,Livro2,Livro3,Youtube,Spotfy
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as https from 'https';
import * as http from 'http';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

interface CSVRow {
  'id-grupo': string;
  'data': string;
  'hora': string;
  'Complemento': string;
  'Livro1': string;
  'Livro2': string;
  'Livro3': string;
  'Youtube': string;
  'Spotfy': string;
}

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

/**
 * Formata a mensagem usando o template fornecido
 */
function formatMessage(row: CSVRow): string {
  return `* Lembrete de Leitura - Plano Anual da Biblia | Dia ${row.Complemento} *

Ola!
Passei para lembrar do nosso compromisso de hoje no Plano de Leitura Anual da Biblia.

* Leitura do dia: *
- ${row.Livro1}
- ${row.Livro2}
- ${row.Livro3}

* Video explicativo (YouTube): *
${row.Youtube}

* Audio / Podcast (Spotify): *
${row.Spotfy}

Separe um tempo, leia com atencao e permita que a Palavra transforme o seu dia.

PneumaBR - Palavra, Espirito e Vida no seu cotidiano.`;
}

/**
 * Converte data e hora do formato brasileiro para Date ISO
 * Formato entrada: DD/MM/YYYY e HH:MM
 */
function parseDateTime(dateStr: string, timeStr: string): Date {
  // Parse da data DD/MM/YYYY
  const [day, month, year] = dateStr.split('/').map(Number);
  
  // Parse da hora HH:MM
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Criar objeto Date (mês é 0-indexed, então subtraímos 1)
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  
  if (isNaN(date.getTime())) {
    throw new Error(`Data/hora inválida: ${dateStr} ${timeStr}`);
  }
  
  return date;
}

/**
 * Faz requisição HTTP para criar mensagem agendada
 */
function createScheduledMessage(groupId: string, message: string, scheduledAt: Date): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}/scheduled-messages`);
    const postData = JSON.stringify({
      groupId,
      message,
      scheduledAt: scheduledAt.toISOString(),
    });

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${response.error || response.message || data}`));
          }
        } catch (err) {
          reject(new Error(`Erro ao parsear resposta: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout ao criar mensagem agendada'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Processa o arquivo CSV e agenda as mensagens
 */
async function processCSV(filePath: string): Promise<void> {
  try {
    console.log(`📄 Lendo arquivo CSV: ${filePath}`);
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    // Ler e parsear CSV
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records: CSVRow[] = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log(`✅ ${records.length} linhas encontradas no CSV\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ row: number; error: string }> = [];

    // Processar cada linha
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNumber = i + 2; // +2 porque linha 1 é header e arrays são 0-indexed

      try {
        console.log(`\n[${rowNumber}/${records.length}] Processando linha ${rowNumber}...`);
        console.log(`   Grupo: ${row['id-grupo']}`);
        console.log(`   Data/Hora: ${row.data} ${row.hora}`);
        console.log(`   Complemento: ${row.Complemento}`);

        // Validar campos obrigatórios
        if (!row['id-grupo'] || !row.data || !row.hora) {
          throw new Error('Campos obrigatórios faltando: id-grupo, data ou hora');
        }

        // Parsear data e hora
        const scheduledAt = parseDateTime(row.data, row.hora);

        // Verificar se a data é futura
        if (scheduledAt <= new Date()) {
          console.log(`   ⚠️  AVISO: Data/hora já passou. Pulando...`);
          continue;
        }

        // Formatar mensagem
        const message = formatMessage(row);

        // Criar mensagem agendada via API
        console.log(`   📤 Criando mensagem agendada...`);
        const result = await createScheduledMessage(row['id-grupo'], message, scheduledAt);

        if (result.success) {
          console.log(`   ✅ Mensagem agendada criada com sucesso!`);
          console.log(`   ID: ${result.data.id}`);
          console.log(`   Agendada para: ${new Date(result.data.scheduledAt).toLocaleString('pt-BR')}`);
          successCount++;
        } else {
          throw new Error(result.error || 'Erro desconhecido');
        }

        // Pequeno delay para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        console.error(`   ❌ Erro na linha ${rowNumber}:`, error.message);
        errorCount++;
        errors.push({ row: rowNumber, error: error.message });
      }
    }

    // Resumo
    console.log(`\n\n${'='.repeat(60)}`);
    console.log(`📊 RESUMO DA IMPORTAÇÃO`);
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Sucesso: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📝 Total processado: ${records.length}`);

    if (errors.length > 0) {
      console.log(`\n⚠️  ERROS ENCONTRADOS:`);
      errors.forEach(({ row, error }) => {
        console.log(`   Linha ${row}: ${error}`);
      });
    }

    console.log(`\n✨ Importação concluída!`);

  } catch (error: any) {
    console.error(`\n❌ Erro ao processar CSV:`, error.message);
    process.exit(1);
  }
}

// Executar script
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Erro: Caminho do arquivo CSV não fornecido');
  console.error('\nUso:');
  console.error('  npm run import-csv <caminho-do-arquivo.csv>');
  console.error('\nExemplo:');
  console.error('  npm run import-csv ./data/mensagens.csv');
  console.error('\nVariáveis de ambiente:');
  console.error('  API_BASE - URL base da API (padrão: http://localhost:3000/api)');
  process.exit(1);
}

const csvFilePath = path.resolve(args[0]);
processCSV(csvFilePath).catch((error) => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
