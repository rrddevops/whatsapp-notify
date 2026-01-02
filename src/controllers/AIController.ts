import { Request, Response } from 'express';
import { ChatGPTService } from '../services/ChatGPTService';
import { logger } from '../config/logger';

export class AIController {
  constructor(private chatGPTService: ChatGPTService) {}

  public async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const config = await this.chatGPTService.getAIConfig();

      res.json({
        success: true,
        data: config,
      });
    } catch (error: any) {
      logger.error('Erro ao obter status da IA:', error);
      res.status(500).json({
        error: 'Erro ao obter status da IA',
        message: error.message,
      });
    }
  }

  public async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { 
        enabled, 
        respondToGroups, 
        respondToDMs, 
        systemPrompt,
        allowedGroupIds,
        wikiUrl,
        useWikiContext
      } = req.body;

      const config = await this.chatGPTService.updateAIConfig(
        enabled,
        respondToGroups,
        respondToDMs,
        systemPrompt,
        req.ip || 'unknown',
        allowedGroupIds,
        wikiUrl,
        useWikiContext
      );

      res.json({
        success: true,
        data: config,
        message: 'Configuração da IA atualizada com sucesso',
      });
    } catch (error: any) {
      logger.error('Erro ao atualizar status da IA:', error);
      res.status(500).json({
        error: 'Erro ao atualizar status da IA',
        message: error.message,
      });
    }
  }

  public async toggle(req: Request, res: Response): Promise<void> {
    try {
      const config = await this.chatGPTService.getAIConfig();
      if (!config) {
        res.status(500).json({ error: 'Configuração da IA não encontrada' });
        return;
      }

      const newStatus = !config.enabled;
      const updatedConfig = await this.chatGPTService.updateAIConfig(
        newStatus,
        undefined,
        undefined,
        undefined,
        req.ip || 'unknown'
      );

      res.json({
        success: true,
        data: updatedConfig,
        message: `IA ${newStatus ? 'ativada' : 'desativada'} com sucesso`,
      });
    } catch (error: any) {
      logger.error('Erro ao alternar status da IA:', error);
      res.status(500).json({
        error: 'Erro ao alternar status da IA',
        message: error.message,
      });
    }
  }
}
