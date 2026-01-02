import * as cron from 'node-cron';
import { logger } from '../config/logger';
import { ScheduledMessage, ScheduledMessageStatus } from '../entities/ScheduledMessage';
import { AppDataSource } from '../config/database';
import { WhatsAppService } from './WhatsAppService';

export class SchedulerService {
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private whatsappService: WhatsAppService;

  constructor(whatsappService: WhatsAppService) {
    this.whatsappService = whatsappService;
    this.startScheduler();
  }

  private startScheduler(): void {
    // Executa a cada minuto para verificar mensagens agendadas
    cron.schedule('* * * * *', async () => {
      await this.processScheduledMessages();
    });

    logger.info('Scheduler iniciado - verificando mensagens agendadas a cada minuto');
  }

  private async processScheduledMessages(): Promise<void> {
    try {
      const repository = AppDataSource.getRepository(ScheduledMessage);
      const now = new Date();

      const pendingMessages = await repository.find({
        where: {
          status: ScheduledMessageStatus.PENDING,
        },
      });

      for (const scheduledMessage of pendingMessages) {
        if (scheduledMessage.scheduledAt <= now) {
          await this.sendScheduledMessage(scheduledMessage);
        }
      }
    } catch (error) {
      logger.error('Erro ao processar mensagens agendadas:', error);
    }
  }

  private async sendScheduledMessage(scheduledMessage: ScheduledMessage): Promise<void> {
    const repository = AppDataSource.getRepository(ScheduledMessage);

    try {
      if (!this.whatsappService.isConnected()) {
        throw new Error('WhatsApp não está conectado');
      }

      await this.whatsappService.sendMessageToGroup(
        scheduledMessage.groupId,
        scheduledMessage.message
      );

      scheduledMessage.status = ScheduledMessageStatus.SENT;
      scheduledMessage.sentAt = new Date();
      await repository.save(scheduledMessage);

      logger.info(`Mensagem agendada ${scheduledMessage.id} enviada com sucesso`);
    } catch (error: any) {
      logger.error(`Erro ao enviar mensagem agendada ${scheduledMessage.id}:`, error);

      scheduledMessage.status = ScheduledMessageStatus.FAILED;
      scheduledMessage.errorMessage = error.message;
      await repository.save(scheduledMessage);
    }
  }

  public async scheduleMessage(
    groupId: string,
    message: string,
    scheduledAt: Date
  ): Promise<ScheduledMessage> {
    try {
      const repository = AppDataSource.getRepository(ScheduledMessage);

      const scheduledMessage = new ScheduledMessage();
      scheduledMessage.groupId = groupId;
      scheduledMessage.message = message;
      scheduledMessage.scheduledAt = scheduledAt;
      scheduledMessage.status = ScheduledMessageStatus.PENDING;

      const saved = await repository.save(scheduledMessage);
      logger.info(`Mensagem agendada criada: ${saved.id} para ${scheduledAt}`);

      return saved;
    } catch (error) {
      logger.error('Erro ao agendar mensagem:', error);
      throw error;
    }
  }

  public async cancelScheduledMessage(messageId: string): Promise<void> {
    try {
      const repository = AppDataSource.getRepository(ScheduledMessage);
      const scheduledMessage = await repository.findOne({
        where: { id: messageId },
      });

      if (!scheduledMessage) {
        throw new Error('Mensagem agendada não encontrada');
      }

      if (scheduledMessage.status !== ScheduledMessageStatus.PENDING) {
        throw new Error('Apenas mensagens pendentes podem ser canceladas');
      }

      scheduledMessage.status = ScheduledMessageStatus.CANCELLED;
      await repository.save(scheduledMessage);

      logger.info(`Mensagem agendada ${messageId} cancelada`);
    } catch (error) {
      logger.error('Erro ao cancelar mensagem agendada:', error);
      throw error;
    }
  }

  public async getScheduledMessages(
    status?: ScheduledMessageStatus
  ): Promise<ScheduledMessage[]> {
    try {
      const repository = AppDataSource.getRepository(ScheduledMessage);
      const where = status ? { status } : {};

      return await repository.find({
        where,
        order: { scheduledAt: 'ASC' },
      });
    } catch (error) {
      logger.error('Erro ao obter mensagens agendadas:', error);
      throw error;
    }
  }
}
