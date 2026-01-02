import { Request, Response } from 'express';
import { SchedulerService } from '../services/SchedulerService';
import { ScheduledMessageStatus } from '../entities/ScheduledMessage';
import { logger } from '../config/logger';

export class ScheduledMessageController {
  constructor(private schedulerService: SchedulerService) {}

  public async create(req: Request, res: Response): Promise<void> {
    try {
      const { groupId, message, scheduledAt } = req.body;

      if (!groupId || !message || !scheduledAt) {
        res.status(400).json({
          error: 'Campos obrigatórios: groupId, message, scheduledAt',
        });
        return;
      }

      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        res.status(400).json({ error: 'Data inválida' });
        return;
      }

      if (scheduledDate <= new Date()) {
        res.status(400).json({ error: 'A data deve ser futura' });
        return;
      }

      const scheduledMessage = await this.schedulerService.scheduleMessage(
        groupId,
        message,
        scheduledDate
      );

      res.status(201).json({
        success: true,
        data: scheduledMessage,
      });
    } catch (error: any) {
      logger.error('Erro ao criar mensagem agendada:', error);
      res.status(500).json({
        error: 'Erro ao criar mensagem agendada',
        message: error.message,
      });
    }
  }

  public async list(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.query;
      const messageStatus = status
        ? (status as ScheduledMessageStatus)
        : undefined;

      const messages = await this.schedulerService.getScheduledMessages(messageStatus);

      res.json({
        success: true,
        data: messages,
        count: messages.length,
      });
    } catch (error: any) {
      logger.error('Erro ao listar mensagens agendadas:', error);
      res.status(500).json({
        error: 'Erro ao listar mensagens agendadas',
        message: error.message,
      });
    }
  }

  public async cancel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'ID da mensagem é obrigatório' });
        return;
      }

      await this.schedulerService.cancelScheduledMessage(id);

      res.json({
        success: true,
        message: 'Mensagem agendada cancelada com sucesso',
      });
    } catch (error: any) {
      logger.error('Erro ao cancelar mensagem agendada:', error);
      res.status(500).json({
        error: 'Erro ao cancelar mensagem agendada',
        message: error.message,
      });
    }
  }
}
