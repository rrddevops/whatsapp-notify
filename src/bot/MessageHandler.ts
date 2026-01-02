import { Message } from 'whatsapp-web.js';
import { logger } from '../config/logger';
import { ChatGPTService } from '../services/ChatGPTService';
import { WhatsAppService } from '../services/WhatsAppService';
import { AppDataSource } from '../config/database';
import { MessageLog } from '../entities/MessageLog';

export class MessageHandler {
  private chatGPTService: ChatGPTService;
  private whatsappService: WhatsAppService;
  private conversationHistory: Map<string, Array<{ role: 'user' | 'assistant'; content: string }>> = new Map();
  private readonly MAX_HISTORY = 10;

  constructor(chatGPTService: ChatGPTService, whatsappService: WhatsAppService) {
    this.chatGPTService = chatGPTService;
    this.whatsappService = whatsappService;
  }

  public async handleMessage(message: Message): Promise<void> {
    try {
      // Obter informações do chat primeiro (mais confiável)
      const chat = await message.getChat();
      const isGroup = chat.isGroup;
      const messageBody = message.body.trim();
      
      // Tentar obter contato, mas não falhar se não conseguir
      let contactId = message.from || chat.id._serialized;
      
      try {
        const contact = await message.getContact();
        contactId = contact.id._serialized;
      } catch (contactError: any) {
        // Se falhar ao obter contato, usar informações da mensagem
        logger.warn('Não foi possível obter informações do contato no MessageHandler:', contactError.message);
        contactId = message.from || chat.id._serialized;
      }

      // Processar comandos
      if (messageBody.startsWith('!')) {
        await this.handleCommand(message, messageBody, contactId);
        return;
      }

      // Verificar se a IA está habilitada
      const aiConfig = await this.chatGPTService.getAIConfig();
      if (!aiConfig?.enabled) {
        return;
      }

      // Se há grupos permitidos configurados, verificar se o grupo atual está na lista
      if (isGroup && aiConfig.allowedGroupIds && aiConfig.allowedGroupIds.length > 0) {
        const groupId = chat.id._serialized;
        if (!aiConfig.allowedGroupIds.includes(groupId)) {
          logger.debug(`Grupo ${groupId} não está na lista de grupos permitidos. Ignorando mensagem.`);
          return;
        }
      }

      // Verificar se deve responder em grupos ou DMs (apenas se não houver grupos específicos configurados)
      if (isGroup && !aiConfig.allowedGroupIds?.length && !aiConfig.respondToGroups) {
        return;
      }

      if (!isGroup && !aiConfig.respondToDMs) {
        return;
      }

      // Ignorar mensagens do próprio bot
      if (message.fromMe) {
        return;
      }

      // Gerar resposta com IA
      await this.generateAIResponse(message, chat.id._serialized, messageBody, isGroup);
    } catch (error) {
      logger.error('Erro ao processar mensagem:', error);
    }
  }

  private async handleCommand(
    message: Message,
    command: string,
    userId: string
  ): Promise<void> {
    const chat = await message.getChat();
    const isGroup = chat.isGroup;

    try {
      if (command.toLowerCase() === '!ia on' || command.toLowerCase() === '!ai on') {
        await this.chatGPTService.updateAIConfig(true, undefined, undefined, undefined, userId);
        await message.reply('✅ IA ativada com sucesso!');
        logger.info(`IA ativada por ${userId}`);
      } else if (command.toLowerCase() === '!ia off' || command.toLowerCase() === '!ai off') {
        await this.chatGPTService.updateAIConfig(false, undefined, undefined, undefined, userId);
        await message.reply('❌ IA desativada com sucesso!');
        logger.info(`IA desativada por ${userId}`);
      } else if (command.toLowerCase() === '!ia status' || command.toLowerCase() === '!ai status') {
        const config = await this.chatGPTService.getAIConfig();
        const status = config?.enabled ? '✅ ATIVADA' : '❌ DESATIVADA';
        await message.reply(`Status da IA: ${status}`);
      } else if (command.toLowerCase() === '!help' || command.toLowerCase() === '!ajuda') {
        const helpText = `
🤖 *Comandos Disponíveis:*

!ia on / !ai on - Ativa a IA
!ia off / !ai off - Desativa a IA
!ia status / !ai status - Verifica status da IA
!help / !ajuda - Mostra esta mensagem
        `.trim();
        await message.reply(helpText);
      }
    } catch (error) {
      logger.error('Erro ao processar comando:', error);
      await message.reply('❌ Erro ao processar comando. Tente novamente.');
    }
  }

  private async generateAIResponse(
    message: Message,
    chatId: string,
    userMessage: string,
    isGroup: boolean
  ): Promise<void> {
    try {
      // Obter histórico da conversa
      const history = this.conversationHistory.get(chatId) || [];
      
      // Manter apenas as últimas N mensagens
      if (history.length > this.MAX_HISTORY) {
        history.splice(0, history.length - this.MAX_HISTORY);
      }

      // Gerar resposta com ChatGPT
      const aiResponse = await this.chatGPTService.generateResponse(userMessage, history);

      // Enviar resposta
      await message.reply(aiResponse);

      // Atualizar histórico
      history.push({ role: 'user', content: userMessage });
      history.push({ role: 'assistant', content: aiResponse });
      this.conversationHistory.set(chatId, history);

      // Log da resposta da IA
      const repository = AppDataSource.getRepository(MessageLog);
      const messageLogs = await repository.find({
        where: { to: chatId },
        order: { createdAt: 'DESC' },
        take: 1,
      });

      if (messageLogs.length > 0) {
        const lastLog = messageLogs[0];
        lastLog.aiResponded = true;
        lastLog.aiResponse = aiResponse;
        await repository.save(lastLog);
      }

      logger.info(`Resposta da IA enviada para ${chatId}`);
    } catch (error: any) {
      logger.error('Erro ao gerar resposta da IA:', error);
      await message.reply('Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente mais tarde.');
    }
  }

  public clearHistory(chatId: string): void {
    this.conversationHistory.delete(chatId);
  }

  public clearAllHistory(): void {
    this.conversationHistory.clear();
  }
}
