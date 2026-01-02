import { logger } from '../config/logger';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export class WikiService {
  private cache: Map<string, { content: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hora em milissegundos

  /**
   * Busca conteúdo de uma URL (site/wiki) e extrai texto relevante
   */
  public async fetchWikiContent(url: string): Promise<string> {
    try {
      // Verificar cache primeiro
      const cached = this.cache.get(url);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        logger.info(`Usando conteúdo em cache para ${url}`);
        return cached.content;
      }

      logger.info(`Buscando conteúdo de ${url}...`);
      const html = await this.fetchUrl(url);
      const text = this.extractTextFromHTML(html);
      
      // Armazenar no cache
      this.cache.set(url, {
        content: text,
        timestamp: Date.now(),
      });

      logger.info(`Conteúdo extraído: ${text.length} caracteres`);
      return text;
    } catch (error: any) {
      logger.error(`Erro ao buscar conteúdo do wiki de ${url}:`, error);
      throw new Error(`Erro ao buscar conteúdo do wiki: ${error.message}`);
    }
  }

  /**
   * Busca conteúdo de múltiplas páginas de um wiki
   */
  public async fetchWikiPages(baseUrl: string, maxPages: number = 10): Promise<string> {
    try {
      const contents: string[] = [];
      
      // Buscar página inicial
      const mainContent = await this.fetchWikiContent(baseUrl);
      contents.push(mainContent);

      // Tentar buscar páginas relacionadas (links internos)
      // Esta é uma implementação básica - pode ser melhorada
      const links = this.extractLinks(mainContent, baseUrl);
      const pagesToFetch = links.slice(0, maxPages - 1);

      for (const link of pagesToFetch) {
        try {
          const content = await this.fetchWikiContent(link);
          contents.push(content);
        } catch (err) {
          logger.warn(`Erro ao buscar página ${link}:`, err);
        }
      }

      return contents.join('\n\n---\n\n');
    } catch (error: any) {
      logger.error(`Erro ao buscar páginas do wiki:`, error);
      throw error;
    }
  }

  /**
   * Busca URL usando HTTP/HTTPS
   */
  private fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      };

      const req = client.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Timeout ao buscar URL'));
      });

      req.end();
    });
  }

  /**
   * Extrai texto de HTML removendo tags e scripts
   */
  private extractTextFromHTML(html: string): string {
    // Remove scripts e styles
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Remove comentários
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    
    // Remove tags HTML mas mantém conteúdo
    text = text.replace(/<[^>]+>/g, ' ');
    
    // Decodifica entidades HTML
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // Remove espaços múltiplos e quebras de linha excessivas
    text = text.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n');
    
    // Limita tamanho (primeiros 10000 caracteres)
    return text.trim().substring(0, 10000);
  }

  /**
   * Extrai links de uma página HTML
   */
  private extractLinks(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
    const baseUrlObj = new URL(baseUrl);
    
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      try {
        const href = match[1];
        // Resolver URL relativa
        const absoluteUrl = new URL(href, baseUrl).href;
        
        // Apenas links do mesmo domínio
        if (new URL(absoluteUrl).hostname === baseUrlObj.hostname) {
          links.push(absoluteUrl);
        }
      } catch (err) {
        // Ignorar URLs inválidas
      }
    }
    
    return [...new Set(links)]; // Remove duplicatas
  }

  /**
   * Limpa o cache
   */
  public clearCache(): void {
    this.cache.clear();
    logger.info('Cache do wiki limpo');
  }
}
