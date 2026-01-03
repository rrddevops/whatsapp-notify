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

  public async getChannels(): Promise<any[]> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp não está conectado');
    }

    try {
      // Primeiro, tentar método direto (mais confiável para canais)
      logger.info('Tentando obter canais via acesso direto ao Store...');
      const directChannels = await this.getChannelsDirect();
      
      if (directChannels && directChannels.length > 0) {
        logger.info(`Encontrados ${directChannels.length} canais via acesso direto`);
        return directChannels;
      }
      
      logger.warn('Nenhum canal encontrado via acesso direto. Tentando método tradicional...');
      
      // Fallback: método tradicional via whatsapp-web.js
      const chats = await this.client.getChats();
      
      // Filtrar canais: verificar múltiplas propriedades para identificar canais
      // Canais no WhatsApp podem ser identificados através de diferentes propriedades
      const channels = chats.filter(chat => {
        const chatAny = chat as any;
        const chatId = chat.id._serialized;
        
        // Excluir grupos explícitos
        if (chat.isGroup) {
          return false;
        }
        
        // Excluir status@broadcast que é uma lista de transmissão especial do sistema
        if (chatId === 'status@broadcast') {
          return false;
        }
        
        // Verificar se é um canal através de diferentes propriedades:
        // 1. Propriedade isBroadcast (listas de transmissão) - mas não incluir status@broadcast
        // 2. Propriedade isChannel (canais do WhatsApp Channels)
        // 3. ID contendo @broadcast (mas não status@broadcast)
        // 4. Tipo/kind específico
        // 5. Propriedades específicas do WhatsApp Web para canais
        
        // Verificar propriedade isChannel diretamente
        const isChannel = chatAny.isChannel === true;
        
        // Verificar propriedade isBroadcast
        const isBroadcast = chatAny.isBroadcast === true;
        
        // Verificar ID contendo broadcast (mas não status@broadcast)
        const hasBroadcastInId = (chatId.includes('@broadcast') || chatId.includes('broadcast')) && chatId !== 'status@broadcast';
        
        // Verificar tipo/kind
        const isKindChannel = chatAny.kind === 'broadcast' || chatAny.kind === 'channel';
        
        // Verificar se é read-only (canais são read-only)
        const isReadOnlyChannel = chatAny.isReadOnly === true;
        
        // Verificar propriedades internas do WhatsApp Web para canais reais
        const hasChannelProperties = 
          chatAny.isNewsletter === true ||
          chatAny.isNewsletterChannel === true ||
          (chatAny.contact && chatAny.contact.isBusiness === true);
        
        // Verificar se tem propriedades específicas de canal do WhatsApp Channels
        const isWhatsAppChannel = 
          chatAny.channelInfo !== undefined ||
          (chatAny.contact && (chatAny.contact as any).isChannel === true) ||
          chatAny.isChannel === true;
        
        // Verificar através de propriedades do objeto interno do WhatsApp
        // Canais geralmente têm algumas características específicas
        const hasInternalChannelProps = 
          (chatAny.isReadOnly === true && !chat.isGroup) ||
          (chatAny.contact && (chatAny.contact as any).isChannel === true);
        
        const result = isBroadcast || isChannel || hasBroadcastInId || isKindChannel || isReadOnlyChannel || hasChannelProperties || isWhatsAppChannel || hasInternalChannelProps;
        
        // Log para debug de todos os chats não-grupo que podem ser canais
        if (!chat.isGroup && chatId !== 'status@broadcast') {
          logger.debug('Chat não-grupo analisado:', {
            id: chatId,
            name: chat.name || 'Sem nome',
            isGroup: chat.isGroup,
            isBroadcast,
            isChannel,
            hasBroadcastInId,
            isKindChannel,
            isReadOnlyChannel,
            hasChannelProperties,
            isWhatsAppChannel,
            hasInternalChannelProps,
            kind: chatAny.kind,
            isReadOnly: chatAny.isReadOnly,
            chatIsChannel: chatAny.isChannel,
            result: result,
            // Log de todas as propriedades disponíveis para debug
            availableProps: Object.keys(chatAny).filter(key => 
              key.includes('channel') || 
              key.includes('Channel') || 
              key.includes('broadcast') || 
              key.includes('Broadcast') ||
              key === 'kind' ||
              key === 'isReadOnly'
            ),
          });
        }
        
        return result;
      });
      
      const channelsInfo = await Promise.all(
        channels.map(async (channel) => {
          try {
            const channelAny = channel as any;
            let subscribersCount = 0;
            let channelName = 'Canal sem nome';
            let channelDescription = '';
            
            // Tentar obter nome do canal através de diferentes propriedades
            try {
              // Tentar diferentes propriedades para obter o nome
              channelName = 
                channel.name || 
                channelAny.name || 
                channelAny.subject || 
                channelAny.title ||
                channelAny.pushname ||
                channelAny.formattedTitle ||
                (channelAny.channelInfo && channelAny.channelInfo.name) ||
                (channelAny.contact && (channelAny.contact as any).pushname) ||
                (channelAny.contact && (channelAny.contact as any).name) ||
                (channelAny.contact && (channelAny.contact as any).formattedName) ||
                'Canal sem nome';
              
              // Se ainda não tiver nome, tentar obter do contato
              if (channelName === 'Canal sem nome' || !channelName) {
                try {
                  const contact = await channel.getContact();
                  // Usar apenas propriedades válidas do tipo Contact (pushname e name)
                  channelName = contact.pushname || contact.name || channelName;
                  
                  // Se ainda não tiver nome, tentar obter através de propriedades internas
                  if (channelName === 'Canal sem nome' || !channelName) {
                    const contactAny = contact as any;
                    channelName = contactAny.formattedTitle || contactAny.formattedName || contactAny.shortName || contactAny.displayName || channelName;
                  }
                } catch (contactError) {
                  // Ignorar erro ao obter contato
                  logger.debug('Erro ao obter contato do canal:', contactError);
                }
              }
              
              // Log detalhado para debug
              logger.debug('Informações do canal:', {
                id: channel.id._serialized,
                name: channelName,
                channelName: channel.name,
                channelAnyName: channelAny.name,
                channelAnySubject: channelAny.subject,
                channelAnyTitle: channelAny.title,
                hasChannelInfo: !!channelAny.channelInfo,
                channelInfoName: channelAny.channelInfo?.name,
                hasContact: !!channelAny.contact,
              });
            } catch (nameError) {
              logger.debug('Erro ao obter nome do canal:', nameError);
            }
            
            // Tentar obter descrição através de diferentes propriedades
            try {
              channelDescription = 
                channelAny.description || 
                channelAny.desc || 
                channelAny.about ||
                (channelAny.channelInfo && channelAny.channelInfo.description) ||
                '';
              
              // Tentar obter descrição através de métodos específicos
              if (!channelDescription && channelAny.getDescription) {
                try {
                  channelDescription = await channelAny.getDescription();
                } catch (descError) {
                  // Ignorar erro
                }
              }
              
              // Tentar obter descrição do contato se disponível
              if (!channelDescription) {
                try {
                  const contact = await channel.getContact();
                  const contactAny = contact as any;
                  channelDescription = contactAny.about || contactAny.description || '';
                } catch (contactDescError) {
                  // Ignorar erro
                }
              }
            } catch (descError) {
              logger.debug('Erro ao obter descrição do canal:', descError);
            }
            
            // Tentar obter número de assinantes/subscribers através de diferentes métodos
            try {
              if (channelAny.participants) {
                const participants = await channelAny.participants;
                subscribersCount = Array.isArray(participants) ? participants.length : 0;
              } else if (channelAny.subscribers) {
                const subscribers = await channelAny.subscribers;
                subscribersCount = Array.isArray(subscribers) ? subscribers.length : 0;
              } else if (channelAny.subscribersCount !== undefined) {
                subscribersCount = channelAny.subscribersCount;
              } else if (channelAny.participantsCount !== undefined) {
                subscribersCount = channelAny.participantsCount;
              }
            } catch (err) {
              // Ignorar erro ao obter subscribers - não é crítico
              logger.debug('Não foi possível obter número de subscribers do canal:', channel.id._serialized);
            }
            
            return {
              id: channel.id._serialized,
              name: channelName,
              description: channelDescription,
              subscribersCount: subscribersCount,
              isChannel: true,
              isBroadcast: channelAny.isBroadcast || false,
            };
          } catch (err) {
            // Se falhar ao obter informações detalhadas, retornar informações básicas
            logger.warn('Erro ao obter informações detalhadas do canal:', err);
            const channelAny = channel as any;
            return {
              id: channel.id._serialized,
              name: channel.name || channelAny.name || channelAny.subject || 'Canal sem nome',
              description: channelAny.description || channelAny.desc || '',
              subscribersCount: 0,
              isChannel: true,
              isBroadcast: channelAny.isBroadcast || false,
            };
          }
        })
      );
      
      logger.info(`Encontrados ${channelsInfo.length} canais`);
      
      // Se não encontrou canais, tentar listar todos os chats para debug
      if (channelsInfo.length === 0) {
        logger.warn('Nenhum canal encontrado. Listando todos os chats para debug...');
        const allChats = await this.client.getChats();
        logger.debug('Total de chats:', allChats.length);
        allChats.forEach((chat, index) => {
          const chatAny = chat as any;
          logger.debug(`Chat ${index + 1}:`, {
            id: chat.id._serialized,
            name: chat.name,
            isGroup: chat.isGroup,
            isBroadcast: chatAny.isBroadcast,
            isChannel: chatAny.isChannel,
            kind: chatAny.kind,
            isReadOnly: chatAny.isReadOnly,
          });
        });
      }
      
      return channelsInfo;
    } catch (error) {
      logger.error('Erro ao obter canais:', error);
      throw error;
    }
  }

  public async getChannelInfoFromLink(channelLink: string): Promise<any> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp não está conectado');
    }

    try {
      // Extrair o código do link do canal
      // Formato: https://whatsapp.com/channel/CODIGO
      const match = channelLink.match(/whatsapp\.com\/channel\/([A-Za-z0-9]+)/);
      if (!match || !match[1]) {
        throw new Error('Link do canal inválido');
      }

      const channelCode = match[1];
      
      logger.info(`Buscando canal com código: ${channelCode}`);
      
      // Tentar obter informações do canal usando o código
      // Nota: whatsapp-web.js pode não ter suporte direto para canais ainda
      // Vamos tentar encontrar o canal na lista de chats
      const chats = await this.client.getChats();
      
      // Log de todos os chats para debug
      logger.debug(`Total de chats para buscar canal: ${chats.length}`);
      chats.forEach((chat, index) => {
        const chatAny = chat as any;
        logger.debug(`Chat ${index + 1} na busca:`, {
          id: chat.id._serialized,
          name: chat.name,
          isGroup: chat.isGroup,
          includesCode: chat.id._serialized.includes(channelCode),
        });
      });
      
      const channel = chats.find(chat => {
        const chatAny = chat as any;
        const chatId = chat.id._serialized;
        
        // Verificar se o ID do chat corresponde ao código do canal
        // Canais podem ter IDs em formatos diferentes
        const matchesId = chatId.includes(channelCode);
        const matchesChannelCode = chatAny.channelCode === channelCode;
        const matchesChannelInfo = chatAny.channelInfo && chatAny.channelInfo.code === channelCode;
        
        if (matchesId || matchesChannelCode || matchesChannelInfo) {
          logger.info(`Canal encontrado! ID: ${chatId}, Nome: ${chat.name}`);
        }
        
        return matchesId || matchesChannelCode || matchesChannelInfo;
      });

      if (!channel) {
        // Se não encontrou, listar todos os chats não-grupo para ajudar no debug
        const nonGroupChats = chats.filter(chat => !chat.isGroup);
        logger.warn(`Canal não encontrado. Total de chats não-grupo: ${nonGroupChats.length}`);
        nonGroupChats.forEach((chat, index) => {
          logger.debug(`Chat não-grupo ${index + 1}:`, {
            id: chat.id._serialized,
            name: chat.name,
          });
        });
        
        throw new Error(`Canal com código ${channelCode} não encontrado. Certifique-se de que você está inscrito no canal e que ele aparece na sua lista de conversas.`);
      }

      const channelAny = channel as any;
      let channelName = channel.name || 'Canal sem nome';
      let channelDescription = '';
      let subscribersCount = 0;

      // Tentar obter informações detalhadas
      try {
        const contact = await channel.getContact();
        channelName = contact.pushname || contact.name || channelName;
        const contactAny = contact as any;
        channelDescription = contactAny.about || contactAny.description || '';
      } catch (contactError) {
        logger.debug('Erro ao obter informações do contato do canal:', contactError);
      }

      // Tentar obter descrição do canal
      try {
        channelDescription = 
          channelAny.description || 
          channelAny.desc || 
          channelAny.about ||
          (channelAny.channelInfo && channelAny.channelInfo.description) ||
          channelDescription;
      } catch (descError) {
        logger.debug('Erro ao obter descrição:', descError);
      }

      // Tentar obter número de subscribers
      try {
        if (channelAny.subscribers) {
          const subscribers = await channelAny.subscribers;
          subscribersCount = Array.isArray(subscribers) ? subscribers.length : 0;
        } else if (channelAny.subscribersCount !== undefined) {
          subscribersCount = channelAny.subscribersCount;
        }
      } catch (subError) {
        logger.debug('Erro ao obter subscribers:', subError);
      }

      return {
        id: channel.id._serialized,
        name: channelName,
        description: channelDescription,
        subscribersCount: subscribersCount,
        channelCode: channelCode,
        channelLink: channelLink,
        isChannel: true,
        isBroadcast: channelAny.isBroadcast || false,
      };
    } catch (error: any) {
      logger.error('Erro ao obter informações do canal:', error);
      throw new Error(`Erro ao obter informações do canal: ${error.message}`);
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

  /**
   * Método alternativo para obter canais acessando diretamente o Store do WhatsApp Web
   * Usa Puppeteer para injetar código JavaScript e acessar a API interna
   */
  public async getChannelsDirect(): Promise<any[]> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp não está conectado');
    }

    try {
      // Acessar a página do Puppeteer através do cliente whatsapp-web.js
      const clientAny = this.client as any;
      const page = clientAny.pupPage;

      if (!page) {
        logger.error('Não foi possível acessar a página do Puppeteer');
        return [];
      }

      // Injetar código para acessar diretamente o Store do WhatsApp Web
      const channels = await page.evaluate(() => {
        try {
          // Acessar o objeto Store do WhatsApp Web
          // @ts-ignore - window está disponível no contexto do browser
          const win = window as any;
          const Store = win.Store || win.WWebJS?.Store;
          
          if (!Store) {
            return { error: 'Store não disponível', channels: [] };
          }

          // Listar todos os Stores disponíveis para debug
          const availableStores = Object.keys(Store).filter((key: string) => 
            key.includes('Chat') || 
            key.includes('Newsletter') || 
            key.includes('Channel') ||
            key.includes('Community') ||
            key.toLowerCase().includes('chat') ||
            key.toLowerCase().includes('newsletter') ||
            key.toLowerCase().includes('channel') ||
            key.toLowerCase().includes('community')
          );

          if (!Store.Chat) {
            return { error: 'Store.Chat não disponível', availableStores, channels: [] };
          }

          const allChats = Store.Chat.getModelsArray();
          
          // Coletar todos os tipos de server e propriedades para debug
          const serverTypes = new Set();
          const chatSamples: any[] = [];
          
          allChats.forEach((chat: any, index: number) => {
            if (chat.id && chat.id.server) {
              serverTypes.add(chat.id.server);
            }
            
            // Coletar amostras de chats que possam ser canais ou comunidades
            if (index < 5 || chat.id?.server === 'newsletter' || chat.isNewsletter || chat.isCommunity) {
              chatSamples.push({
                id: chat.id?._serialized,
                server: chat.id?.server,
                name: chat.name,
                isNewsletter: chat.isNewsletter,
                isCommunity: chat.isCommunity,
                isParent: chat.isParent,
                hasNewsletterProps: Object.keys(chat).filter((k: string) => 
                  k.toLowerCase().includes('newsletter') || 
                  k.toLowerCase().includes('channel') ||
                  k.toLowerCase().includes('community')
                )
              });
            }
          });
          
          // Filtrar canais - tentar múltiplos critérios
          const newsletterChats = allChats.filter((chat: any) => {
            return (
              (chat.id && chat.id.server === 'newsletter') ||
              chat.isNewsletter === true ||
              chat.type === 'newsletter' ||
              (chat.id && chat.id._serialized && chat.id._serialized.includes('newsletter'))
            );
          });

          return {
            total: allChats.length,
            serverTypes: Array.from(serverTypes),
            availableStores,
            chatSamples: chatSamples,
            newsletters: newsletterChats.map((chat: any) => ({
              id: chat.id._serialized,
              serverId: chat.id.server,
              userId: chat.id.user,
              name: chat.name || chat.contact?.name || chat.formattedTitle || 'Sem nome',
              description: chat.description || '',
              unreadCount: chat.unreadCount || 0,
              timestamp: chat.timestamp || 0,
              isNewsletter: true,
            })),
            error: null
          };
        } catch (error: any) {
          return { error: error.message, channels: [], total: 0 };
        }
      });

      if (channels.error) {
        logger.warn(`Erro ao acessar Store do WhatsApp: ${channels.error}`);
        if (channels.availableStores) {
          logger.debug(`Stores disponíveis: ${JSON.stringify(channels.availableStores)}`);
        }
        return [];
      }

      logger.info(`Encontrados ${channels.newsletters?.length || 0} canais via acesso direto ao Store`);
      logger.debug(`Total de chats no Store: ${channels.total}`);
      logger.debug(`Tipos de server encontrados: ${JSON.stringify(channels.serverTypes)}`);
      logger.debug(`Stores disponíveis relacionados: ${JSON.stringify(channels.availableStores)}`);
      logger.debug(`Amostras de chats (primeiros 5 + especiais): ${JSON.stringify(channels.chatSamples, null, 2)}`);
      
      return channels.newsletters || [];
    } catch (error) {
      logger.error('Erro ao obter canais via acesso direto:', error);
      return [];
    }
  }

  /**
   * Método para obter comunidades do WhatsApp
   * Comunidades são agrupamentos de grupos (WhatsApp Communities)
   */
  public async getCommunities(): Promise<any[]> {
    if (!this.client || !this.isReady) {
      throw new Error('WhatsApp não está conectado');
    }

    try {
      const clientAny = this.client as any;
      const page = clientAny.pupPage;

      if (!page) {
        logger.error('Não foi possível acessar a página do Puppeteer');
        return [];
      }

      const communities = await page.evaluate(() => {
        try {
          // @ts-ignore
          const win = window as any;
          const Store = win.Store || win.WWebJS?.Store;
          
          if (!Store || !Store.Chat) {
            return { error: 'Store não disponível', communities: [] };
          }

          const allChats = Store.Chat.getModelsArray();
          
          // Filtrar comunidades - elas têm propriedades específicas
          const communitiesChats = allChats.filter((chat: any) => {
            return (
              chat.isCommunity === true ||
              chat.isParent === true ||
              (chat.id && chat.id.server === 'g.us' && chat.groupMetadata?.isCommunity) ||
              (chat.groupMetadata && chat.groupMetadata.isParent === true)
            );
          });

          return {
            total: allChats.length,
            communities: communitiesChats.map((chat: any) => ({
              id: chat.id._serialized,
              serverId: chat.id.server,
              name: chat.name || chat.formattedTitle || 'Comunidade sem nome',
              description: chat.description || '',
              unreadCount: chat.unreadCount || 0,
              timestamp: chat.timestamp || 0,
              isCommunity: true,
              isParent: chat.isParent || false,
              subgroupsCount: chat.groupMetadata?.subgroups?.length || 0,
            })),
            error: null
          };
        } catch (error: any) {
          return { error: error.message, communities: [], total: 0 };
        }
      });

      if (communities.error) {
        logger.warn(`Erro ao acessar comunidades: ${communities.error}`);
        return [];
      }

      logger.info(`Encontradas ${communities.communities?.length || 0} comunidades`);
      
      return communities.communities || [];
    } catch (error) {
      logger.error('Erro ao obter comunidades:', error);
      return [];
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
