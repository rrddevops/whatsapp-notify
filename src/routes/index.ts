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
  // Rotas de WhatsApp
  router.get('/whatsapp/status', configLimiter, (req, res) => whatsappController.getStatus(req, res));
  router.get('/whatsapp/config', configLimiter, (req, res) => whatsappController.getConfig(req, res));
  router.put('/whatsapp/config/phone', configLimiter, (req, res) => whatsappController.updatePhoneNumber(req, res));
  router.get('/whatsapp/qrcode', configLimiter, (req, res) => whatsappController.getQRCode(req, res));
  router.post('/whatsapp/send', defaultLimiter, (req, res) => whatsappController.sendMessage(req, res));
  router.get('/whatsapp/groups', defaultLimiter, (req, res) => whatsappController.getGroups(req, res));
  router.get('/whatsapp/group/invite', defaultLimiter, (req, res) => whatsappController.getGroupFromInviteLink(req, res));
  router.get('/whatsapp/group/:groupId', defaultLimiter, (req, res) => whatsappController.getGroupById(req, res));

  // Rotas de Mensagens Agendadas (com rate limiting padrão)
  router.post('/scheduled-messages', defaultLimiter, (req, res) =>
    scheduledMessageController.create(req, res)
  );
  router.get('/scheduled-messages', defaultLimiter, (req, res) =>
    scheduledMessageController.list(req, res)
  );
  router.delete('/scheduled-messages/:id', defaultLimiter, (req, res) =>
    scheduledMessageController.cancel(req, res)
  );

  // Rotas de IA (com rate limiting mais permissivo)
  router.get('/ai/status', configLimiter, (req, res) => aiController.getStatus(req, res));
  router.put('/ai/status', configLimiter, (req, res) => aiController.updateStatus(req, res));
  router.post('/ai/toggle', configLimiter, (req, res) => aiController.toggle(req, res));

  // Health check (sem rate limiting)
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
