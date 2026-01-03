import { Router } from 'express';
import { ScheduledMessageController } from '../controllers/ScheduledMessageController';
import { AIController } from '../controllers/AIController';
import { WhatsAppController } from '../controllers/WhatsAppController';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting muito permissivo para rotas de configuração (não deve bloquear uso normal)
const configLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minuto
  max: parseInt(process.env.RATE_LIMIT_CONFIG_MAX_REQUESTS || '500'), // 500 requisições por minuto
  message: 'Muitas requisições. Tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Pular rate limiting em desenvolvimento local
    return process.env.NODE_ENV === 'development' && req.ip === '::1';
  },
});

// Rate limiting padrão para outras rotas
const defaultLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Muitas requisições. Tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

// NÃO aplicar rate limiting globalmente - aplicar apenas nas rotas específicas
// Isso evita rate limiting duplo que causa erro 429

export function setupRoutes(
  scheduledMessageController: ScheduledMessageController,
  aiController: AIController,
  whatsappController: WhatsAppController
): Router {
  /**
   * @swagger
   * /whatsapp/status:
   *   get:
   *     tags: [WhatsApp]
   *     summary: Obter status da conexão do WhatsApp
   *     responses:
   *       200:
   *         description: Status do WhatsApp
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/WhatsAppStatus'
   *       500:
   *         description: Erro ao obter status
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/whatsapp/status', configLimiter, (req, res) => whatsappController.getStatus(req, res));

  /**
   * @swagger
   * /whatsapp/config:
   *   get:
   *     tags: [WhatsApp]
   *     summary: Obter configuração do WhatsApp
   *     responses:
   *       200:
   *         description: Configuração do WhatsApp
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   */
  router.get('/whatsapp/config', configLimiter, (req, res) => whatsappController.getConfig(req, res));

  /**
   * @swagger
   * /whatsapp/config/phone:
   *   put:
   *     tags: [WhatsApp]
   *     summary: Atualizar número de telefone do WhatsApp
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - phoneNumber
   *             properties:
   *               phoneNumber:
   *                 type: string
   *                 example: "5511999999999"
   *     responses:
   *       200:
   *         description: Número atualizado com sucesso
   *       400:
   *         description: Número inválido
   */
  router.put('/whatsapp/config/phone', configLimiter, (req, res) => whatsappController.updatePhoneNumber(req, res));

  /**
   * @swagger
   * /whatsapp/qrcode:
   *   get:
   *     tags: [WhatsApp]
   *     summary: Obter QR Code para conexão do WhatsApp
   *     responses:
   *       200:
   *         description: QR Code gerado ou status da conexão
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/QRCode'
   *       400:
   *         description: Número não cadastrado
   */
  router.get('/whatsapp/qrcode', configLimiter, (req, res) => whatsappController.getQRCode(req, res));

  /**
   * @swagger
   * /whatsapp/send:
   *   post:
   *     tags: [WhatsApp]
   *     summary: Enviar mensagem via WhatsApp
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - to
   *               - message
   *             properties:
   *               to:
   *                 type: string
   *                 example: "5511999999999@c.us"
   *               message:
   *                 type: string
   *                 example: "Olá! Esta é uma mensagem de teste."
   *     responses:
   *       200:
   *         description: Mensagem enviada com sucesso
   *       503:
   *         description: WhatsApp não está conectado
   */
  router.post('/whatsapp/send', defaultLimiter, (req, res) => whatsappController.sendMessage(req, res));

  /**
   * @swagger
   * /whatsapp/groups:
   *   get:
   *     tags: [WhatsApp]
   *     summary: Listar todos os grupos do WhatsApp
   *     responses:
   *       200:
   *         description: Lista de grupos
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Group'
   *                 count:
   *                   type: number
   *       503:
   *         description: WhatsApp não está conectado
   */
  router.get('/whatsapp/groups', defaultLimiter, (req, res) => whatsappController.getGroups(req, res));

  /**
   * @swagger
   * /whatsapp/channels:
   *   get:
   *     tags: [WhatsApp]
   *     summary: Listar todos os canais do WhatsApp
   *     responses:
   *       200:
   *         description: Lista de canais
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Channel'
   *                 count:
   *                   type: number
   *       503:
   *         description: WhatsApp não está conectado
   */
  router.get('/whatsapp/channels', defaultLimiter, (req, res) => whatsappController.getChannels(req, res));
  router.get('/whatsapp/channel/link', defaultLimiter, (req, res) => whatsappController.getChannelFromLink(req, res));
  
  /**
   * @swagger
   * /whatsapp/communities:
   *   get:
   *     tags: [WhatsApp]
   *     summary: Listar todas as comunidades do WhatsApp
   *     responses:
   *       200:
   *         description: Lista de comunidades retornada com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       name:
   *                         type: string
   *                       description:
   *                         type: string
   *                       subgroupsCount:
   *                         type: number
   *                       isCommunity:
   *                         type: boolean
   *                 count:
   *                   type: number
   *       503:
   *         description: WhatsApp não está conectado
   */
  router.get('/whatsapp/communities', defaultLimiter, (req, res) => whatsappController.getCommunities(req, res));
  
  router.get('/whatsapp/chats/debug', defaultLimiter, (req, res) => whatsappController.getAllChatsDebug(req, res));

  /**
   * @swagger
   * /whatsapp/channel/link:
   *   get:
   *     tags: [WhatsApp]
   *     summary: Obter informações de canal a partir de link
   *     parameters:
   *       - in: query
   *         name: channelLink
   *         required: true
   *         schema:
   *           type: string
   *         example: "https://whatsapp.com/channel/0029VbCB8e3LY6d0PCCeBy41"
   *     responses:
   *       200:
   *         description: Informações do canal
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/Channel'
   *       400:
   *         description: Link do canal inválido
   */
  
  /**
   * @swagger
   * /whatsapp/group/invite:
   *   get:
   *     tags: [WhatsApp]
   *     summary: Obter informações de grupo a partir de link de convite
   *     parameters:
   *       - in: query
   *         name: inviteLink
   *         required: true
   *         schema:
   *           type: string
   *         example: "https://chat.whatsapp.com/IWQYIZuWsEWGB7HGhbr5lC"
   *     responses:
   *       200:
   *         description: Informações do grupo
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/Group'
   *       400:
   *         description: Link de convite inválido
   */
  router.get('/whatsapp/group/invite', defaultLimiter, (req, res) => whatsappController.getGroupFromInviteLink(req, res));

  /**
   * @swagger
   * /whatsapp/group/{groupId}:
   *   get:
   *     tags: [WhatsApp]
   *     summary: Obter informações detalhadas de um grupo por ID
   *     parameters:
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema:
   *           type: string
   *         example: "120363123456789012@g.us"
   *     responses:
   *       200:
   *         description: Informações do grupo
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/Group'
   *       400:
   *         description: ID do grupo inválido
   */
  router.get('/whatsapp/group/:groupId', defaultLimiter, (req, res) => whatsappController.getGroupById(req, res));

  /**
   * @swagger
   * /scheduled-messages:
   *   post:
   *     tags: [Scheduled Messages]
   *     summary: Criar uma mensagem agendada
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - groupId
   *               - message
   *               - scheduledAt
   *             properties:
   *               groupId:
   *                 type: string
   *                 example: "120363123456789012@g.us"
   *               message:
   *                 type: string
   *                 example: "Mensagem agendada"
   *               scheduledAt:
   *                 type: string
   *                 format: date-time
   *                 example: "2024-12-25T10:00:00Z"
   *     responses:
   *       201:
   *         description: Mensagem agendada criada com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ScheduledMessage'
   */
  router.post('/scheduled-messages', defaultLimiter, (req, res) =>
    scheduledMessageController.create(req, res)
  );

  /**
   * @swagger
   * /scheduled-messages:
   *   get:
   *     tags: [Scheduled Messages]
   *     summary: Listar mensagens agendadas
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, sent, cancelled]
   *         description: Filtrar por status
   *     responses:
   *       200:
   *         description: Lista de mensagens agendadas
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ScheduledMessage'
   */
  router.get('/scheduled-messages', defaultLimiter, (req, res) =>
    scheduledMessageController.list(req, res)
  );

  /**
   * @swagger
   * /scheduled-messages/{id}:
   *   delete:
   *     tags: [Scheduled Messages]
   *     summary: Cancelar uma mensagem agendada
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         example: "uuid"
   *     responses:
   *       200:
   *         description: Mensagem cancelada com sucesso
   *       404:
   *         description: Mensagem não encontrada
   */
  router.delete('/scheduled-messages/:id', defaultLimiter, (req, res) =>
    scheduledMessageController.cancel(req, res)
  );

  /**
   * @swagger
   * /ai/status:
   *   get:
   *     tags: [AI]
   *     summary: Obter status da configuração da IA
   *     responses:
   *       200:
   *         description: Status da IA
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AIStatus'
   */
  router.get('/ai/status', configLimiter, (req, res) => aiController.getStatus(req, res));

  /**
   * @swagger
   * /ai/status:
   *   put:
   *     tags: [AI]
   *     summary: Atualizar configuração da IA
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AIStatus'
   *     responses:
   *       200:
   *         description: Configuração atualizada com sucesso
   */
  router.put('/ai/status', configLimiter, (req, res) => aiController.updateStatus(req, res));

  /**
   * @swagger
   * /ai/toggle:
   *   post:
   *     tags: [AI]
   *     summary: Alternar status da IA (ligar/desligar)
   *     responses:
   *       200:
   *         description: Status alternado com sucesso
   */
  router.post('/ai/toggle', configLimiter, (req, res) => aiController.toggle(req, res));

  /**
   * @swagger
   * /health:
   *   get:
   *     tags: [Health]
   *     summary: Verificar saúde da API
   *     responses:
   *       200:
   *         description: API está funcionando
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: "ok"
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   */
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
