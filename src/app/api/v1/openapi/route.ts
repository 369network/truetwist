import { NextResponse } from 'next/server';

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'TrueTwist Public API',
    description:
      'AI-powered social media automation platform API. Create content, schedule posts, track analytics, and manage webhooks programmatically.',
    version: '1.0.0',
    contact: { email: 'developers@truetwist.com' },
    license: { name: 'Proprietary' },
  },
  servers: [
    { url: '/api/v1/public', description: 'Public API (API Key auth)' },
    { url: '/api/v1/developer', description: 'Developer Management (JWT auth)' },
  ],
  security: [{ ApiKeyHeader: [] }, { ApiKeyBearer: [] }],
  components: {
    securitySchemes: {
      ApiKeyHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key prefixed with tt_',
      },
      ApiKeyBearer: {
        type: 'http',
        scheme: 'bearer',
        description: 'Bearer token using your tt_ API key',
      },
      BearerJWT: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token for developer dashboard endpoints',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              details: { type: 'object', nullable: true },
            },
          },
        },
      },
      Paginated: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      Post: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          businessId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          content: { type: 'string' },
          contentType: { type: 'string', enum: ['text', 'image', 'video', 'carousel'] },
          platforms: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['draft', 'scheduled', 'posting', 'posted', 'failed'] },
          hashtags: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Schedule: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          postId: { type: 'string', format: 'uuid' },
          platform: { type: 'string' },
          scheduledAt: { type: 'string', format: 'date-time' },
          postedAt: { type: 'string', format: 'date-time', nullable: true },
          status: { type: 'string', enum: ['draft', 'scheduled', 'queued', 'posting', 'posted', 'failed', 'cancelled'] },
          platformPostUrl: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      SocialAccount: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          platform: { type: 'string', enum: ['instagram', 'facebook', 'twitter', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'threads'] },
          platformUsername: { type: 'string' },
          platformDisplayName: { type: 'string' },
          isActive: { type: 'boolean' },
          followerCount: { type: 'integer' },
          lastSyncedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      ApiKey: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          keyPrefix: { type: 'string', description: 'First 11 chars (tt_xxxxxxxx) for identification' },
          scope: { type: 'string', enum: ['read', 'write', 'admin'] },
          status: { type: 'string', enum: ['active', 'revoked', 'expired'] },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
          requestCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      WebhookEndpoint: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          url: { type: 'string', format: 'uri' },
          events: { type: 'array', items: { type: 'string', enum: ['post.published', 'post.failed', 'analytics.threshold', 'trend.viral'] } },
          status: { type: 'string', enum: ['active', 'paused', 'disabled'] },
          description: { type: 'string', nullable: true },
          failureCount: { type: 'integer' },
          lastTriggeredAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      WebhookDelivery: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          event: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'delivered', 'failed', 'retrying'] },
          httpStatus: { type: 'integer', nullable: true },
          attempts: { type: 'integer' },
          deliveredAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    parameters: {
      page: { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      pageSize: { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
    },
  },
  paths: {
    '/posts': {
      get: {
        tags: ['Content'],
        summary: 'List posts',
        operationId: 'listPosts',
        parameters: [
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/pageSize' },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'businessId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Paginated list of posts', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/Paginated' }, { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Post' } } } }] } } } },
          401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          429: { description: 'Rate limited' },
        },
      },
      post: {
        tags: ['Content'],
        summary: 'Create a post',
        operationId: 'createPost',
        description: 'Requires `write` scope.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['businessId', 'content'],
                properties: {
                  businessId: { type: 'string', format: 'uuid' },
                  title: { type: 'string' },
                  content: { type: 'string' },
                  contentType: { type: 'string', enum: ['text', 'image', 'video', 'carousel'], default: 'text' },
                  platforms: { type: 'array', items: { type: 'string' } },
                  hashtags: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Post created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Post' } } } } } },
          401: { description: 'Unauthorized' },
          403: { description: 'Insufficient scope' },
          422: { description: 'Validation error' },
        },
      },
    },
    '/posts/{id}': {
      get: {
        tags: ['Content'],
        summary: 'Get a post',
        operationId: 'getPost',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Post details with schedules and media' }, 404: { description: 'Not found' } },
      },
      patch: {
        tags: ['Content'],
        summary: 'Update a draft post',
        operationId: 'updatePost',
        description: 'Requires `write` scope. Only draft posts can be edited.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' }, contentType: { type: 'string' }, platforms: { type: 'array', items: { type: 'string' } }, hashtags: { type: 'array', items: { type: 'string' } } } } } } },
        responses: { 200: { description: 'Updated post' }, 400: { description: 'Cannot edit non-draft post' } },
      },
      delete: {
        tags: ['Content'],
        summary: 'Delete a post',
        operationId: 'deletePost',
        description: 'Requires `write` scope.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Post deleted' } },
      },
    },
    '/schedules': {
      get: {
        tags: ['Scheduling'],
        summary: 'List scheduled posts',
        operationId: 'listSchedules',
        parameters: [{ $ref: '#/components/parameters/page' }, { $ref: '#/components/parameters/pageSize' }, { name: 'status', in: 'query', schema: { type: 'string' } }],
        responses: { 200: { description: 'Paginated schedules' } },
      },
      post: {
        tags: ['Scheduling'],
        summary: 'Schedule a post',
        operationId: 'createSchedule',
        description: 'Requires `write` scope.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['postId', 'socialAccountId', 'platform', 'scheduledAt'], properties: { postId: { type: 'string', format: 'uuid' }, socialAccountId: { type: 'string', format: 'uuid' }, platform: { type: 'string' }, scheduledAt: { type: 'string', format: 'date-time', description: 'Must be in the future (ISO 8601)' } } } } },
        },
        responses: { 201: { description: 'Schedule created' }, 422: { description: 'Validation error' } },
      },
    },
    '/schedules/{id}': {
      get: { tags: ['Scheduling'], summary: 'Get schedule details', operationId: 'getSchedule', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Schedule with analytics' } } },
      patch: { tags: ['Scheduling'], summary: 'Update schedule time', operationId: 'updateSchedule', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { scheduledAt: { type: 'string', format: 'date-time' } } } } } }, responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Scheduling'], summary: 'Cancel a schedule', operationId: 'cancelSchedule', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Cancelled' } } },
    },
    '/analytics': {
      get: {
        tags: ['Analytics'],
        summary: 'Get engagement metrics and growth data',
        operationId: 'getAnalytics',
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['daily', 'weekly', 'monthly'], default: 'daily' } },
          { name: 'platform', in: 'query', schema: { type: 'string' } },
          { name: 'businessId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Analytics rollups and recent post metrics' } },
      },
    },
    '/accounts': {
      get: {
        tags: ['Accounts'],
        summary: 'List connected social accounts',
        operationId: 'listAccounts',
        responses: { 200: { description: 'List of connected social accounts', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/SocialAccount' } } } } } } } },
      },
    },
    '/generate': {
      post: {
        tags: ['AI Generation'],
        summary: 'Trigger AI content generation',
        operationId: 'generateContent',
        description: 'Requires `write` scope. Returns 202 with a generation ID to poll for results.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['prompt', 'businessId'], properties: { type: { type: 'string', enum: ['text', 'image', 'video'], default: 'text' }, prompt: { type: 'string' }, businessId: { type: 'string', format: 'uuid' }, platform: { type: 'string', description: 'Target platform (for video)' } } } } },
        },
        responses: { 202: { description: 'Generation queued' } },
      },
      get: {
        tags: ['AI Generation'],
        summary: 'Check generation status or list recent generations',
        operationId: 'getGeneration',
        parameters: [
          { name: 'generationId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'videoJobId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Generation details or list' } },
      },
    },
    '/webhooks': {
      get: { tags: ['Webhooks'], summary: 'List webhook endpoints', operationId: 'listWebhooks', responses: { 200: { description: 'Webhook endpoints' } } },
      post: {
        tags: ['Webhooks'],
        summary: 'Create webhook endpoint',
        operationId: 'createWebhook',
        description: 'Requires `admin` scope.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['url', 'events'], properties: { url: { type: 'string', format: 'uri', description: 'HTTPS URL' }, events: { type: 'array', items: { type: 'string', enum: ['post.published', 'post.failed', 'analytics.threshold', 'trend.viral'] } }, description: { type: 'string' } } } } },
        },
        responses: { 201: { description: 'Webhook created with signing secret (shown once)' } },
      },
    },
  },
  tags: [
    { name: 'Content', description: 'Create, list, update, and delete posts' },
    { name: 'Scheduling', description: 'Schedule, update, and cancel post scheduling' },
    { name: 'Analytics', description: 'Read engagement metrics and growth data' },
    { name: 'Accounts', description: 'List connected social accounts' },
    { name: 'AI Generation', description: 'Trigger AI content generation (text, image, video)' },
    { name: 'Webhooks', description: 'Configure outbound webhooks for post events' },
  ],
};

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
