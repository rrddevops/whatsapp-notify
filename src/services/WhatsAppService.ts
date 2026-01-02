import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import { logger } from '../config/logger';
import { MessageLog } from '../entities/MessageLog';
import { AppDataSource } from '../config/database';
import { WhatsAppConfigService } from './WhatsAppConfigService';
import * as fs from 'fs';
import * as path from 'path';

export class WhatsAppService {
  private client: Client | null = null;
  private qrCode: string | null = null;
  private isReady = false;
  private messageHandlers: ((message: Message) => Promise<void>)[] = [];
  private configService: WhatsAppConfigService;

  constructor() {
    this.configService = new WhatsAppConfigService();
    const sessionPath = process.env.WHATSAPP_SESSION_PATH || './sessions';
    
    const puppeteerArgs = process.env.WHATSAPP_PUPPETEER_ARGS
      ? process.env.WHATSAPP_PUPPETEER_ARGS.split(',')
      : [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--disable-gpu',
          // Removido --single-process e --no-zygote que podem causar problemas
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-client-side-phishing-detection',
          '--disable-default-apps',
          '--disable-hang-monitor',
          '--disable-popup-blocking',
          '--disable-prompt-on-repost',
          '--disable-renderer-backgrounding',
          '--disable-sync',
          '--disable-translate',
          '--metrics-recording-only',
          '--no-crash-upload',
          '--no-default-browser-check',
          '--no-pings',
          '--password-store=basic',
          '--use-mock-keychain',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
        ];

    // Usar userDataDir temporário para evitar locks persistentes
    const userDataDir = path.join(sessionPath, 'chrome-data');
    
    // Garantir que o diretório existe
    try {
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }
    } catch (err) {
      logger.warn('Erro ao criar diretório chrome-data:', err);
    }
    
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: sessionPath,
        clientId: 'whatsapp-bot', // ID único para evitar conflitos
      }),
      puppeteer: {
        headless: true,
        args: [
          ...puppeteerArgs,
          `--user-data-dir=${userDataDir}`,
          '--disable-setuid-sandbox',
          '--no-sandbox',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
        // Configurações adicionais para estabilidade
        ignoreHTTPSErrors: true,
        defaultViewport: {
          width: 1280,
          height: 720,
        },
        // Timeout maior para inicialização (aumentado para 90s)
        timeout: 90000,
      },
    });

    this.setupEventHandlers();
    
    // Limpar locks após criar o cliente
    this.cleanupLocks(sessionPath);
  }

  private cleanupLocks(sessionPath: string): void {
    try {
      const lockPaths = [
        path.join(sessionPath, '.puppeteer', 'chrome', 'SingletonLock'),
        path.join(sessionPath, '.puppeteer', 'chrome', 'lockfile'),
        path.join(sessionPath, '.puppeteer', 'chrome', 'SingletonSocket'),
      ];

      lockPaths.forEach((lockPath) => {
        try {
          if (fs.existsSync(lockPath)) {
            logger.warn(`Removendo lock: ${lockPath}`);
            fs.unlinkSync(lockPath);
          }
        } catch (err) {
          // Ignorar erros ao remover locks individuais
        }
      });

      // Tentar remover diretório de lock se existir
      const lockDir = path.join(sessionPath, '.puppeteer', 'chrome');
      try {
        if (fs.existsSync(lockDir)) {
          const files = fs.readdirSync(lockDir);
          files.forEach((file) => {
            if (file.includes('Lock') || file.includes('lock')) {
              try {
                fs.unlinkSync(path.join(lockDir, file));
                logger.warn(`Removido: ${file}`);
              } catch (err) {
                // Ignorar
              }
            }
          });
        }
      } catch (err) {
        // Ignorar erros ao limpar diretório
      }
    } catch (error) {
      logger.warn('Erro ao limpar locks (continuando):', error);
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('qr', (qr: string) => {
      this.qrCode = qr;
      logger.info('QR Code gerado. Escaneie com seu WhatsApp.');
      console.log('\n=== QR CODE ===');
      qrcode.generate(qr, { small: true });
      console.log('===============\n');
    });

    this.client.on('ready', async () => {
      this.isReady = true;
      logger.info('WhatsApp conectado e pronto!');
      await this.configService.updateConnectionStatus(true);
    });

    this.client.on('authenticated', () => {
      logger.info('WhatsApp autenticado com sucesso!');
    });

    this.client.on('auth_failure', (msg) => {
      logger.error('Falha na autenticação do WhatsApp:', msg);
      this.isReady = false;
    });

    this.client.on('disconnected', async (reason) => {
      logger.warn('WhatsApp desconectado:', reason);
      this.isReady = false;
      this.qrCode = null;
      await this.configService.updateConnectionStatus(false);
    });

    this.client.on('message', async (message: Message) => {
      await this.handleIncomingMessage(message);
    });
  }

  private async handleIncomingMessage(message: Message): Promise<void> {
    try {
      // Obter informações do chat primeiro (mais confiável)
      const chat = await message.getChat();
      const isGroup = chat.isGroup;
      
      // Tentar obter contato, mas não falhar se não conseguir
      let contactId = message.from;
      let contactName = 'Desconhecido';
      
      try {
        const contact = await message.getContact();
        contactId = contact.id._serialized;
        contactName = contact.pushname || contact.name || 'Desconhecido';
      } catch (contactError: any) {
        // Se falhar ao obter contato, usar informações da mensagem
        logger.warn('Não foi possível obter informações do contato:', contactError.message);
        contactId = message.from || chat.id._serialized;
      }

      // Log da mensagem recebida
      const messageLog = new MessageLog();
      messageLog.from = contactId;
      messageLog.to = chat.id._serialized;
      messageLog.message = message.body;
      messageLog.isGroup = isGroup;

      await AppDataSource.manager.save(messageLog);

      // Executar handlers registrados
      for (const handler of this.messageHandlers) {
        try {
          await handler(message);
        } catch (error) {
          logger.error('Erro ao executar handler de mensagem:', error);
        }
      }
    } catch (error) {
      logger.error('Erro ao processar mensagem recebida:', error);
    }
  }

  public async initialize(): Promise<void> {
    if (!this.client) {
      throw new Error('Cliente WhatsApp não inicializado');
    }

    try {
      logger.info('Inicializando WhatsApp Service...');
      
      // Limpar locks antes de inicializar
      const sessionPath = process.env.WHATSAPP_SESSION_PATH || './sessions';
      this.cleanupLocks(sessionPath);
      
      // Garantir que o diretório chrome-data existe
      const userDataDir = path.join(sessionPath, 'chrome-data');
      try {
        if (!fs.existsSync(userDataDir)) {
          fs.mkdirSync(userDataDir, { recursive: true });
        }
      } catch (err) {
        logger.warn('Erro ao criar diretório chrome-data:', err);
      }
      
      // Aguardar mais tempo após limpar locks para garantir estabilidade
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), 5000);
      });
      
      // Verificar se o executável do Chromium existe
      const chromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser';
      if (!fs.existsSync(chromiumPath)) {
        logger.warn(`Chromium não encontrado em ${chromiumPath}. Tentando continuar...`);
      } else {
        logger.info(`Usando Chromium em: ${chromiumPath}`);
      }
      
      logger.info('Tentando inicializar cliente WhatsApp...');
      
      // Tentar inicializar com tratamento de timeout
      try {
        await Promise.race([
          this.client.initialize(),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout ao inicializar WhatsApp (90s)')), 90000);
          })
        ]);
        logger.info('WhatsApp Service inicializado com sucesso');
      } catch (initError: any) {
        // Se for erro de timeout ou sessão fechada, logar detalhes
        if (initError.message && initError.message.includes('Session closed')) {
          logger.error('Erro: Sessão do Puppeteer foi fechada durante inicialização');
          logger.error('Isso pode indicar que o Chromium está crashando ou fechando muito rapidamente');
        }
        throw initError;
      }
    } catch (error: any) {
      logger.error('Erro ao inicializar WhatsApp Service:', error);
      logger.error('Detalhes do erro:', {
        message: error.message,
        name: error.name,
      });
      
      // Se o erro for relacionado a sessão fechada, tentar recriar o cliente
      if (error.message && (
        error.message.includes('Session closed') ||
        error.message.includes('Protocol error') ||
        error.message.includes('Target closed')
      )) {
        logger.warn('Erro de sessão do Puppeteer detectado. Tentando recriar cliente...');
        
        const sessionPathForRetry = process.env.WHATSAPP_SESSION_PATH || './sessions';
        
        // Limpar completamente
        this.cleanupLocks(sessionPathForRetry);
        
        try {
          const userDataDir = path.join(sessionPathForRetry, 'chrome-data');
          if (fs.existsSync(userDataDir)) {
            logger.warn('Removendo diretório de dados do Chrome para recriar...');
            fs.rmSync(userDataDir, { recursive: true, force: true });
          }
        } catch (cleanError) {
          logger.warn('Erro ao limpar diretório do Chrome:', cleanError);
        }
        
        // Aguardar antes de tentar novamente
        await new Promise<void>(resolve => {
          setTimeout(() => resolve(), 5000);
        });
        
        // Recriar cliente completamente
        try {
          await this.destroy();
          
          // Usar configuração mais simples e estável
          const puppeteerArgsRetry = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-extensions',
            '--disable-background-networking',
          ];
          
          const userDataDirRetry = path.join(sessionPathForRetry, 'chrome-data-retry');
          try {
            if (fs.existsSync(userDataDirRetry)) {
              fs.rmSync(userDataDirRetry, { recursive: true, force: true });
            }
            fs.mkdirSync(userDataDirRetry, { recursive: true });
          } catch (dirError) {
            logger.warn('Erro ao criar diretório de retry:', dirError);
          }
          
          this.client = new Client({
            authStrategy: new LocalAuth({
              dataPath: sessionPathForRetry,
              clientId: 'whatsapp-bot-retry',
            }),
            puppeteer: {
              headless: true,
              args: [
                ...puppeteerArgsRetry,
                `--user-data-dir=${userDataDirRetry}`,
              ],
              executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
              ignoreHTTPSErrors: true,
              defaultViewport: {
                width: 1280,
                height: 720,
              },
              timeout: 90000, // Timeout maior para retry
            },
          });
          
          this.setupEventHandlers();
          
          logger.info('Tentando reinicializar após erro de sessão...');
          await this.client.initialize();
          logger.info('WhatsApp Service reinicializado com sucesso após erro de sessão');
        } catch (retryError: any) {
          logger.error('Erro ao tentar reinicializar após erro de sessão:', retryError);
          logger.warn('WhatsApp não pôde ser inicializado. O servidor continuará sem WhatsApp.');
        }
      }
      // Se o erro for relacionado a locks, tentar limpar e aguardar
      else if (error.message && error.message.includes('profile appears to be in use')) {
        logger.warn('Detectado lock do Chromium. Limpando locks e aguardando...');
        
        const sessionPathForCleanup = process.env.WHATSAPP_SESSION_PATH || './sessions';
        
        // Limpar locks novamente
        this.cleanupLocks(sessionPathForCleanup);
        
        // Limpar diretório de dados do Chrome se existir
        try {
          const userDataDir = path.join(sessionPathForCleanup, 'chrome-data');
          if (fs.existsSync(userDataDir)) {
            logger.warn('Removendo diretório de dados do Chrome...');
            fs.rmSync(userDataDir, { recursive: true, force: true });
          }
        } catch (cleanError) {
          logger.warn('Erro ao limpar diretório do Chrome:', cleanError);
        }
        
        // Aguardar mais tempo antes de tentar novamente
        await new Promise<void>(resolve => {
          setTimeout(() => resolve(), 5000);
        });
        
        // Tentar inicializar novamente apenas se o cliente ainda existir
        if (this.client) {
          logger.info('Tentando reinicializar após limpeza de locks...');
          try {
            await this.client.initialize();
            logger.info('WhatsApp Service reinicializado com sucesso após limpeza');
          } catch (retryError: any) {
            logger.error('Erro ao tentar reinicializar após limpeza:', retryError);
            // Não lançar erro - permitir que o servidor continue sem WhatsApp
            logger.warn('WhatsApp não pôde ser inicializado. O servidor continuará sem WhatsApp.');
          }
        } else {
          logger.warn('Cliente WhatsApp não está mais disponível após erro de lock.');
        }
      } else {
        throw error;
      }
    }
  }

  public async sendMessage(to: string, message: string): Promise<void> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp não está conectado');
    }

    try {
      await this.client.sendMessage(to, message);
      logger.info(`Mensagem enviada para ${to}`);
    } catch (error) {
      logger.error(`Erro ao enviar mensagem para ${to}:`, error);
      throw error;
    }
  }

  public async sendMessageToGroup(groupId: string, message: string): Promise<void> {
    return this.sendMessage(groupId, message);
  }

  public getQRCode(): string | null {
    return this.qrCode;
  }

  public isConnected(): boolean {
    return this.isReady;
  }

  public getClient(): Client | null {
    return this.client;
  }

  public onMessage(handler: (message: Message) => Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  public async getGroups(): Promise<any[]> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp não está conectado');
    }

    try {
      const chats = await this.client.getChats();
      const groups = chats.filter(chat => chat.isGroup);
      
      const groupsInfo = await Promise.all(
        groups.map(async (group) => {
          try {
            const groupAny = group as any;
            const participants = groupAny.participants ? await groupAny.participants : [];
            return {
              id: group.id._serialized,
              name: group.name,
              description: groupAny.description || '',
              participantsCount: Array.isArray(participants) ? participants.length : 0,
              isGroup: true,
            };
          } catch (err) {
            // Se falhar ao obter participantes, retornar informações básicas
            return {
              id: group.id._serialized,
              name: group.name,
              description: '',
              participantsCount: 0,
              isGroup: true,
            };
          }
        })
      );
      
      return groupsInfo;
    } catch (error) {
      logger.error('Erro ao obter grupos:', error);
      throw error;
    }
  }

  public async getGroupInfoFromInviteLink(inviteLink: string): Promise<any> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp não está conectado');
    }

    try {
      // Extrair o código do link de convite
      // Formato: https://chat.whatsapp.com/CODIGO
      const match = inviteLink.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
      if (!match || !match[1]) {
        throw new Error('Link de convite inválido');
      }

      const inviteCode = match[1];
      
      // Obter informações do grupo usando o código do convite
      const groupInfo: any = await this.client.getInviteInfo(inviteCode);
      
      return {
        id: groupInfo.id?._serialized || null,
        name: groupInfo.subject || 'Grupo sem nome',
        description: groupInfo.desc || '',
        participantsCount: groupInfo.participants?.length || 0,
        inviteCode: inviteCode,
        inviteLink: inviteLink,
        isGroup: true,
      };
    } catch (error: any) {
      logger.error('Erro ao obter informações do grupo:', error);
      throw new Error(`Erro ao obter informações do grupo: ${error.message}`);
    }
  }

  public async getGroupById(groupId: string): Promise<any> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp não está conectado');
    }

    try {
      const chat = await this.client.getChatById(groupId);
      
      if (!chat.isGroup) {
        throw new Error('O ID fornecido não é de um grupo');
      }

      const chatAny = chat as any;
      let participants: any[] = [];
      try {
        participants = chatAny.participants ? await chatAny.participants : [];
      } catch (err) {
        logger.warn('Não foi possível obter participantes do grupo:', err);
      }
      
      return {
        id: chat.id._serialized,
        name: chat.name,
        description: chatAny.description || '',
        participantsCount: Array.isArray(participants) ? participants.length : 0,
        participants: Array.isArray(participants) ? participants.map((p: any) => ({
          id: p.id?._serialized || p.id,
          name: p.name || p.pushname || 'Sem nome',
        })) : [],
        isGroup: true,
      };
    } catch (error: any) {
      logger.error('Erro ao obter grupo por ID:', error);
      throw new Error(`Erro ao obter grupo: ${error.message}`);
    }
  }

  public async destroy(): Promise<void> {
    if (this.client) {
      try {
        const client = this.client;
        this.client = null; // Limpar referência primeiro para evitar erros
        this.isReady = false;
        this.qrCode = null;
        await client.destroy();
      } catch (error: any) {
        logger.warn('Erro ao destruir cliente WhatsApp (pode já estar destruído):', error);
        // Garantir que as variáveis estão limpas mesmo em caso de erro
        this.client = null;
        this.isReady = false;
        this.qrCode = null;
      }
    } else {
      // Se já for null, apenas limpar flags
      this.isReady = false;
      this.qrCode = null;
    }
  }
}
