/**
 * Script auxiliar para obter o ID de um grupo do WhatsApp
 * 
 * Uso:
 * 1. Adicione o bot ao grupo desejado
 * 2. Envie qualquer mensagem no grupo
 * 3. O ID será exibido nos logs do servidor
 * 
 * Ou use a API:
 * GET /api/whatsapp/status
 */

import { WhatsAppService } from '../services/WhatsAppService';

export async function logGroupInfo(whatsappService: WhatsAppService): Promise<void> {
  const client = whatsappService.getClient();
  
  if (!client) {
    console.log('WhatsApp não está conectado');
    return;
  }

  try {
    const chats = await client.getChats();
    
    console.log('\n=== GRUPOS DISPONÍVEIS ===');
    for (const chat of chats) {
      if (chat.isGroup) {
        const groupMetadata = await chat.fetchMessages({ limit: 1 });
        console.log(`Nome: ${chat.name}`);
        console.log(`ID: ${chat.id._serialized}`);
        console.log(`---`);
      }
    }
    console.log('==========================\n');
  } catch (error) {
    console.error('Erro ao obter informações dos grupos:', error);
  }
}
