import { logger } from '../config/logger';
import { WhatsAppConfig } from '../entities/WhatsAppConfig';
import { AppDataSource } from '../config/database';

export class WhatsAppConfigService {
  public async getConfig(): Promise<WhatsAppConfig | null> {
    try {
      const repository = AppDataSource.getRepository(WhatsAppConfig);
      let config = await repository.findOne({ where: {} });

      if (!config) {
        config = new WhatsAppConfig();
        config.isConnected = false;
        await repository.save(config);
      }

      return config;
    } catch (error: any) {
      // Se a tabela não existir, retornar null sem logar erro (tabela será criada pela migration)
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        logger.warn('Tabela whatsapp_config ainda não existe. Será criada pela migration.');
        return null;
      }
      logger.error('Erro ao obter configuração do WhatsApp:', error);
      return null;
    }
  }

  public async updatePhoneNumber(phoneNumber: string): Promise<WhatsAppConfig> {
    try {
      const repository = AppDataSource.getRepository(WhatsAppConfig);
      let config = await repository.findOne({ where: {} });

      if (!config) {
        config = new WhatsAppConfig();
      }

      // Formatar número (remover caracteres especiais, manter apenas dígitos)
      const formattedNumber = phoneNumber.replace(/\D/g, '');
      
      config.phoneNumber = formattedNumber;
      config.sessionName = `session_${formattedNumber}`;
      
      config = await repository.save(config);
      logger.info(`Número do WhatsApp atualizado: ${formattedNumber}`);
      return config;
    } catch (error: any) {
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        logger.error('Tabela whatsapp_config não existe. Execute as migrations primeiro.');
        throw new Error('Tabela whatsapp_config não existe. Execute as migrations primeiro.');
      }
      logger.error('Erro ao atualizar número do WhatsApp:', error);
      throw error;
    }
  }

  public async updateConnectionStatus(isConnected: boolean): Promise<void> {
    try {
      const repository = AppDataSource.getRepository(WhatsAppConfig);
      let config = await repository.findOne({ where: {} });

      if (!config) {
        config = new WhatsAppConfig();
      }

      config.isConnected = isConnected;
      if (isConnected) {
        config.lastConnection = new Date();
      }

      await repository.save(config);
    } catch (error: any) {
      // Ignorar erro se a tabela não existir (será criada pela migration)
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        logger.warn('Tabela whatsapp_config ainda não existe. Status não será salvo.');
        return;
      }
      logger.error('Erro ao atualizar status de conexão:', error);
    }
  }
}
