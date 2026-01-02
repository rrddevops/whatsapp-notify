FROM node:18-alpine

# Instalar dependências do sistema necessárias para Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    udev \
    ttf-opensans \
    font-noto-emoji \
    xvfb \
    dbus

# Configurar variáveis de ambiente para Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependências
# Tenta usar npm ci (mais rápido e confiável), fallback para npm install
RUN if [ -f package-lock.json ]; then \
      npm ci --production=false; \
    else \
      npm install --production=false; \
    fi

# Copiar código fonte (incluindo frontend)
COPY src ./src

# Copiar scripts
COPY scripts ./scripts
RUN chmod +x scripts/*.sh 2>/dev/null || true

# Criar diretórios necessários
RUN mkdir -p sessions logs

# Compilar TypeScript
RUN npm run build

# Copiar arquivos públicos para dist (necessário para produção)
RUN if [ -d src/public ]; then mkdir -p dist/public && cp -r src/public/* dist/public/; fi

# Expor porta
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["npm", "start"]
