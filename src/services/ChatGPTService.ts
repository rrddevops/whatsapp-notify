import OpenAI from 'openai';
import { logger } from '../config/logger';
import { AIConfig } from '../entities/AIConfig';
import { AppDataSource } from '../config/database';
import { WikiService } from './WikiService';

export class ChatGPTService {
  private client: OpenAI;
  private defaultSystemPrompt: string;
  private wikiService: WikiService;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      logger.warn('OPENAI_API_KEY não configurada. Funcionalidade de IA será limitada.');
      // Criar cliente vazio para evitar erros, mas não será usado
      this.client = new OpenAI({
        apiKey: 'dummy-key',
      });
    } else {
      this.client = new OpenAI({
        apiKey: apiKey,
      });
    }

    this.defaultSystemPrompt =
      process.env.AI_SYSTEM_PROMPT ||
      'Você é um assistente virtual útil e profissional. Responda de forma clara, concisa e amigável.';
    
    this.wikiService = new WikiService();
  }

  public async generateResponse(
    userMessage: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<string> {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey === 'your_openai_api_key_here') {
        throw new Error('OPENAI_API_KEY não configurada. Configure a chave da API OpenAI no arquivo .env');
      }

      const aiConfig = await this.getAIConfig();
      let systemPrompt = aiConfig?.systemPrompt || this.defaultSystemPrompt;

      // Se wiki está habilitado, buscar contexto do wiki
      if (aiConfig?.useWikiContext && aiConfig?.wikiUrl) {
        try {
          logger.info(`Buscando contexto do wiki: ${aiConfig.wikiUrl}`);
          const wikiContent = await this.wikiService.fetchWikiContent(aiConfig.wikiUrl);
          
          // Adicionar contexto do wiki ao system prompt
          systemPrompt = `${systemPrompt}

CONTEXTO DO WIKI/SITE:
${wikiContent}

INSTRUÇÕES IMPORTANTES:
- Use APENAS as informações do contexto acima para responder perguntas
- Se a pergunta não estiver relacionada ao contexto fornecido, responda: "Desculpe, essa pergunta está fora do contexto do nosso wiki/site. Por favor, faça perguntas relacionadas ao conteúdo disponível."
- Seja preciso e cite informações do contexto quando relevante
- Mantenha respostas concisas e objetivas`;
        } catch (wikiError: any) {
          logger.warn(`Erro ao buscar contexto do wiki: ${wikiError.message}`);
          // Continuar sem contexto do wiki se houver erro
        }
      }

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...conversationHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: 'user',
          content: userMessage,
        },
      ];

      const completion = await this.client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500'),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      });

      const response = completion.choices[0]?.message?.content || 'Desculpe, não consegui gerar uma resposta.';
      logger.info('Resposta do ChatGPT gerada com sucesso');
      return response;
    } catch (error: any) {
      logger.error('Erro ao gerar resposta do ChatGPT:', error);
      throw new Error(`Erro ao gerar resposta: ${error.message}`);
    }
  }

  public async getAIConfig(): Promise<AIConfig | null> {
    try {
      const repository = AppDataSource.getRepository(AIConfig);
      let config = await repository.findOne({ where: {} });

      if (!config) {
        config = new AIConfig();
        config.enabled = process.env.AI_ENABLED_BY_DEFAULT === 'true';
        config.respondToGroups = process.env.AI_RESPOND_TO_GROUPS !== 'false';
        config.respondToDMs = process.env.AI_RESPOND_TO_DMS !== 'false';
        await repository.save(config);
      }

      return config;
    } catch (error) {
      logger.error('Erro ao obter configuração da IA:', error);
      return null;
    }
  }

  public async updateAIConfig(
    enabled?: boolean,
    respondToGroups?: boolean,
    respondToDMs?: boolean,
    systemPrompt?: string,
    updatedBy?: string,
    allowedGroupIds?: string[],
    wikiUrl?: string,
    useWikiContext?: boolean
  ): Promise<AIConfig> {
    try {
      const repository = AppDataSource.getRepository(AIConfig);
      let config = await repository.findOne({ where: {} });

      if (!config) {
        config = new AIConfig();
      }

      if (enabled !== undefined) config.enabled = enabled;
      if (respondToGroups !== undefined) config.respondToGroups = respondToGroups;
      if (respondToDMs !== undefined) config.respondToDMs = respondToDMs;
      if (systemPrompt !== undefined) config.systemPrompt = systemPrompt;
      if (updatedBy !== undefined) config.lastUpdatedBy = updatedBy;
      if (allowedGroupIds !== undefined) config.allowedGroupIds = allowedGroupIds;
      if (wikiUrl !== undefined) {
        config.wikiUrl = wikiUrl;
        // Limpar cache do wiki quando URL mudar
        if (wikiUrl !== config.wikiUrl) {
          this.wikiService.clearCache();
        }
      }
      if (useWikiContext !== undefined) config.useWikiContext = useWikiContext;

      config = await repository.save(config);
      logger.info('Configuração da IA atualizada:', config);
      return config;
    } catch (error) {
      logger.error('Erro ao atualizar configuração da IA:', error);
      throw error;
    }
  }
}
