import 'reflect-metadata';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { AppDataSource } from './config/database';
import { logger } from './config/logger';
import { WhatsAppService } from './services/WhatsAppService';
import { ChatGPTService } from './services/ChatGPTService';
import { SchedulerService } from './services/SchedulerService';
import { MessageHandler } from './bot/MessageHandler';
import { ScheduledMessageController } from './controllers/ScheduledMessageController';
import { AIController } from './controllers/AIController';
import { WhatsAppController } from './controllers/WhatsAppController';
import { setupRoutes } from './routes';

// Carregar variáveis de ambiente
dotenv.config();

async function bootstrap() {
  try {
    // Verificar variáveis de ambiente críticas
    logger.info('Verificando configurações...');
    if (!process.env.DB_HOST) {
      logger.warn('DB_HOST não configurado, usando padrão: localhost');
    }
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      logger.warn('OPENAI_API_KEY não configurada. Funcionalidade de IA será limitada.');
    }

    // Inicializar banco de dados
    logger.info('Conectando ao banco de dados...');
    logger.info(`Host: ${process.env.DB_HOST || 'localhost'}, Database: ${process.env.DB_DATABASE || 'whatsapp_bot'}`);
    
    try {
      await AppDataSource.initialize();
      logger.info('Banco de dados conectado com sucesso!');
      
      // Executar migrations automaticamente se necessário
      if (process.env.NODE_ENV === 'production' || process.env.AUTO_MIGRATE === 'true') {
        logger.info('Executando migrations...');
        try {
          const pendingMigrations = await AppDataSource.runMigrations();
          if (pendingMigrations.length > 0) {
            logger.info(`Migrations executadas: ${pendingMigrations.map(m => m.name).join(', ')}`);
          } else {
            logger.info('Nenhuma migration pendente');
          }
        } catch (migrationError: any) {
          logger.error('Erro ao executar migrations:', migrationError);
          // Continuar mesmo se houver erro na migration (pode ser que já tenha sido executada)
        }
      }
    } catch (dbError: any) {
      logger.error('Erro ao conectar ao banco de dados:', dbError);
      logger.error('Detalhes:', {
        message: dbError.message,
        code: dbError.code,
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_DATABASE || 'whatsapp_bot',
      });
      throw dbError;
    }

    // Inicializar Express PRIMEIRO para que a API esteja disponível
    const app = express();
    app.use(cors());
    // Configurar express.json para aceitar UTF-8 corretamente
    // O express.json já aceita UTF-8 por padrão, mas vamos garantir
    app.use(express.json({ 
      type: 'application/json',
      limit: '10mb'
    }));
    app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb'
    }));
    
    // Middleware para corrigir encoding incorreto (Windows-1252 -> UTF-8)
    app.use((req, res, next) => {
      if (req.body && typeof req.body === 'object' && req.body.message) {
        // Detectar se a mensagem está em encoding incorreto
        const message = req.body.message;
        if (typeof message === 'string') {
          // Se contém caracteres típicos de encoding incorreto (como Ã­, â€", etc)
          if (message.includes('Ã') || message.includes('â€') || message.includes('ð')) {
            try {
              // Tentar corrigir: assumir que foi enviado como UTF-8 mas interpretado como Windows-1252
              // Converter de volta para bytes e depois para UTF-8
              const buffer = Buffer.from(message, 'latin1'); // Latin1 = Windows-1252 para caracteres comuns
              req.body.message = buffer.toString('utf8');
              logger.info('Encoding corrigido: Windows-1252 -> UTF-8');
            } catch (error) {
              logger.warn('Erro ao corrigir encoding:', error);
            }
          }
        }
      }
      next();
    });
    
    // Servir arquivos estáticos (frontend)
    const publicPath = process.env.NODE_ENV === 'production' 
      ? 'dist/public' 
      : 'src/public';
    
    logger.info(`Servindo arquivos estáticos de: ${publicPath}`);
    app.use(express.static(publicPath));
    
    // Rota raiz redireciona para o frontend
    app.get('/', (req, res) => {
      try {
        res.sendFile('index.html', { root: publicPath });
      } catch (error) {
        logger.error('Erro ao servir index.html:', error);
        res.status(500).send(`
          <h1>Erro ao carregar frontend</h1>
          <p>Verifique se os arquivos estão em: ${publicPath}</p>
          <p>API disponível em: <a href="/api/health">/api/health</a></p>
        `);
      }
    });

    // Criar instâncias dos serviços (sem inicializar ainda)
    logger.info('Criando instâncias dos serviços...');
    const whatsappService = new WhatsAppService();
    const chatGPTService = new ChatGPTService();
    const schedulerService = new SchedulerService(whatsappService);
    const messageHandler = new MessageHandler(chatGPTService, whatsappService);

    // Configurar rotas
    const scheduledMessageController = new ScheduledMessageController(schedulerService);
    const aiController = new AIController(chatGPTService);
    const whatsappController = new WhatsAppController(whatsappService);

    app.use('/api', setupRoutes(scheduledMessageController, aiController, whatsappController));

    // INICIAR SERVIDOR HTTP PRIMEIRO (crítico - antes de qualquer inicialização pesada)
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info(`✅ Servidor HTTP rodando na porta ${PORT}`);
      logger.info(`🌐 Frontend disponível em http://localhost:${PORT}`);
      logger.info(`📡 API disponível em http://localhost:${PORT}/api`);
      logger.info(`📱 QR Code disponível em http://localhost:${PORT}/api/whatsapp/qrcode`);
    });

    // Registrar handler de mensagens
    whatsappService.onMessage(async (message) => {
      await messageHandler.handleMessage(message);
    });

    // Inicializar WhatsApp em background (DEPOIS do servidor iniciar)
    setTimeout(() => {
      logger.info('Inicializando WhatsApp em background...');
      whatsappService.initialize().catch((error) => {
        logger.error('Erro ao inicializar WhatsApp (continuando sem WhatsApp):', error);
        logger.warn('Servidor continuará rodando, mas WhatsApp não estará disponível');
      });
    }, 2000); // Aguarda 2 segundos para garantir que o servidor iniciou

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Encerrando aplicação...');
      await whatsappService.destroy();
      await AppDataSource.destroy();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Encerrando aplicação...');
      await whatsappService.destroy();
      await AppDataSource.destroy();
      process.exit(0);
    });
  } catch (error: any) {
    logger.error('Erro ao inicializar aplicação:', error);
    logger.error('Stack trace:', error.stack);
    logger.error('Detalhes do erro:', {
      message: error.message,
      name: error.name,
      code: error.code,
    });
    
    // Aguardar um pouco antes de sair para permitir que os logs sejam escritos
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
}

bootstrap();
