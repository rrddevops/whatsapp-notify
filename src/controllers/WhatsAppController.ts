import { Request, Response } from 'express';
import { WhatsAppService } from '../services/WhatsAppService';
import { WhatsAppConfigService } from '../services/WhatsAppConfigService';
import { logger } from '../config/logger';

export class WhatsAppController {
  private configService: WhatsAppConfigService;

  constructor(private whatsappService: WhatsAppService) {
    this.configService = new WhatsAppConfigService();
  }

  public async getQRCode(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se há número cadastrado
      const config = await this.configService.getConfig();
      if (!config?.phoneNumber) {
        res.status(400).json({
          success: false,
          error: 'Número do celular não cadastrado',
          message: 'Por favor, cadastre o número do celular antes de gerar o QR Code',
          requiresPhoneNumber: true,
        });
        return;
      }

      // Verificar se já está conectado
      const isConnected = this.whatsappService.isConnected();
      if (isConnected) {
        res.json({
          success: true,
          connected: true,
          message: 'WhatsApp já está conectado. Não é necessário QR Code.',
          phoneNumber: config.phoneNumber,
        });
        return;
      }

      const qrCode = this.whatsappService.getQRCode();

      if (!qrCode) {
        // Se não há QR Code e não está conectado, pode ser que ainda esteja inicializando
        res.json({
          success: false,
          error: 'QR Code ainda não disponível',
          message: 'O WhatsApp está sendo inicializado. Aguarde alguns segundos e tente novamente.',
          connected: false,
          phoneNumber: config.phoneNumber,
        });
        return;
      }

      res.json({
        success: true,
        qrCode: qrCode,
        message: 'Escaneie o QR Code com seu WhatsApp',
        phoneNumber: config.phoneNumber,
        connected: false,
      });
    } catch (error: any) {
      logger.error('Erro ao obter QR Code:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao obter QR Code',
        message: error.message,
      });
    }
  }

  public async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const isConnected = this.whatsappService.isConnected();
      const qrCode = this.whatsappService.getQRCode();
      let config = null;
      
      try {
        config = await this.configService.getConfig();
      } catch (error: any) {
        // Se a tabela não existir, continuar sem erro
        logger.warn('Não foi possível obter configuração do WhatsApp (tabela pode não existir ainda)');
      }

      res.json({
        success: true,
        connected: isConnected,
        qrCodeAvailable: !!qrCode,
        phoneNumber: config?.phoneNumber || null,
        hasPhoneNumber: !!config?.phoneNumber,
      });
    } catch (error: any) {
      logger.error('Erro ao obter status do WhatsApp:', error);
      res.status(500).json({
        error: 'Erro ao obter status do WhatsApp',
        message: error.message,
      });
    }
  }

  public async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = await this.configService.getConfig();

      res.json({
        success: true,
        data: config,
      });
    } catch (error: any) {
      logger.error('Erro ao obter configuração do WhatsApp:', error);
      res.status(500).json({
        error: 'Erro ao obter configuração',
        message: error.message,
      });
    }
  }

  public async updatePhoneNumber(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        res.status(400).json({
          error: 'Número do celular é obrigatório',
        });
        return;
      }

      // Validar formato básico do número
      const cleanedNumber = phoneNumber.replace(/\D/g, '');
      if (cleanedNumber.length < 10 || cleanedNumber.length > 15) {
        res.status(400).json({
          error: 'Número inválido. Use o formato: 5511999999999',
        });
        return;
      }

      const config = await this.configService.updatePhoneNumber(phoneNumber);

      res.json({
        success: true,
        data: config,
        message: 'Número cadastrado com sucesso!',
      });
    } catch (error: any) {
      logger.error('Erro ao atualizar número do WhatsApp:', error);
      res.status(500).json({
        error: 'Erro ao atualizar número',
        message: error.message,
      });
    }
  }

  public async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { to, message } = req.body;

      if (!to || !message) {
        res.status(400).json({
          error: 'Campos obrigatórios: to, message',
        });
        return;
      }

      if (!this.whatsappService.isConnected()) {
        res.status(503).json({
          error: 'WhatsApp não está conectado',
        });
        return;
      }

      await this.whatsappService.sendMessage(to, message);

      res.json({
        success: true,
        message: 'Mensagem enviada com sucesso',
      });
    } catch (error: any) {
      logger.error('Erro ao enviar mensagem:', error);
      res.status(500).json({
        error: 'Erro ao enviar mensagem',
        message: error.message,
      });
    }
  }

  public async getGroups(req: Request, res: Response): Promise<void> {
    try {
      if (!this.whatsappService.isConnected()) {
        res.status(503).json({
          success: false,
          error: 'WhatsApp não está conectado',
        });
        return;
      }

      const groups = await this.whatsappService.getGroups();

      res.json({
        success: true,
        data: groups,
        count: groups.length,
      });
    } catch (error: any) {
      logger.error('Erro ao obter grupos:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao obter grupos',
        message: error.message,
      });
    }
  }

  public async getGroupFromInviteLink(req: Request, res: Response): Promise<void> {
    try {
      const { inviteLink } = req.query;

      if (!inviteLink || typeof inviteLink !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Link de convite é obrigatório',
          message: 'Envie o link no formato: ?inviteLink=https://chat.whatsapp.com/CODIGO',
        });
        return;
      }

      if (!this.whatsappService.isConnected()) {
        res.status(503).json({
          success: false,
          error: 'WhatsApp não está conectado',
        });
        return;
      }

      const groupInfo = await this.whatsappService.getGroupInfoFromInviteLink(inviteLink);

      res.json({
        success: true,
        data: groupInfo,
        message: 'Informações do grupo obtidas com sucesso',
      });
    } catch (error: any) {
      logger.error('Erro ao obter grupo do link de convite:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao obter informações do grupo',
        message: error.message,
      });
    }
  }

  public async getGroupById(req: Request, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;

      if (!groupId) {
        res.status(400).json({
          success: false,
          error: 'ID do grupo é obrigatório',
        });
        return;
      }

      if (!this.whatsappService.isConnected()) {
        res.status(503).json({
          success: false,
          error: 'WhatsApp não está conectado',
        });
        return;
      }

      const groupInfo = await this.whatsappService.getGroupById(groupId);

      res.json({
        success: true,
        data: groupInfo,
      });
    } catch (error: any) {
      logger.error('Erro ao obter grupo por ID:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao obter grupo',
        message: error.message,
      });
    }
  }
}
