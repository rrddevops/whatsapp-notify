import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WhatsApp Bot API',
      version: '1.0.0',
      description: 'API para gerenciamento de bot do WhatsApp com agendamento de mensagens e integração com ChatGPT',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Servidor de desenvolvimento',
      },
    ],
    tags: [
      {
        name: 'WhatsApp',
        description: 'Endpoints relacionados ao WhatsApp',
      },
      {
        name: 'Scheduled Messages',
        description: 'Endpoints para gerenciamento de mensagens agendadas',
      },
      {
        name: 'AI',
        description: 'Endpoints relacionados à configuração da IA',
      },
      {
        name: 'Health',
        description: 'Endpoints de verificação de saúde da API',
      },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Mensagem de erro',
            },
            message: {
              type: 'string',
              example: 'Detalhes do erro',
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
          },
        },
        WhatsAppStatus: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            connected: {
              type: 'boolean',
              example: true,
            },
            qrCodeAvailable: {
              type: 'boolean',
              example: false,
            },
            phoneNumber: {
              type: 'string',
              nullable: true,
              example: '5511999999999',
            },
            hasPhoneNumber: {
              type: 'boolean',
              example: true,
            },
          },
        },
        QRCode: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            qrCode: {
              type: 'string',
              nullable: true,
              example: 'QR_CODE_STRING',
            },
            message: {
              type: 'string',
              example: 'Escaneie o QR Code com seu WhatsApp',
            },
            phoneNumber: {
              type: 'string',
              nullable: true,
              example: '5511999999999',
            },
            connected: {
              type: 'boolean',
              example: false,
            },
          },
        },
        Group: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '120363123456789012@g.us',
            },
            name: {
              type: 'string',
              example: 'Meu Grupo',
            },
            description: {
              type: 'string',
              example: 'Descrição do grupo',
            },
            participantsCount: {
              type: 'number',
              example: 10,
            },
            isGroup: {
              type: 'boolean',
              example: true,
            },
          },
        },
        Channel: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'status@broadcast',
            },
            name: {
              type: 'string',
              example: 'Nome do Canal',
            },
            description: {
              type: 'string',
              example: 'Descrição do canal',
            },
            subscribersCount: {
              type: 'number',
              example: 100,
            },
            isChannel: {
              type: 'boolean',
              example: true,
            },
            isBroadcast: {
              type: 'boolean',
              example: false,
            },
          },
        },
        ScheduledMessage: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'uuid',
            },
            groupId: {
              type: 'string',
              example: '120363123456789012@g.us',
            },
            message: {
              type: 'string',
              example: 'Mensagem agendada',
            },
            scheduledAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-12-25T10:00:00Z',
            },
            status: {
              type: 'string',
              enum: ['pending', 'sent', 'cancelled'],
              example: 'pending',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        AIStatus: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            enabled: {
              type: 'boolean',
              example: true,
            },
            respondToGroups: {
              type: 'boolean',
              example: true,
            },
            respondToDMs: {
              type: 'boolean',
              example: true,
            },
            systemPrompt: {
              type: 'string',
              example: 'Você é um assistente virtual profissional.',
            },
            allowedGroupIds: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['120363123456789012@g.us'],
            },
            wikiUrl: {
              type: 'string',
              nullable: true,
              example: 'https://example.com/wiki',
            },
            useWikiContext: {
              type: 'boolean',
              example: false,
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
