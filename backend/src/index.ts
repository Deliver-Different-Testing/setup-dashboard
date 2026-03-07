/**
 * Setup Dashboard Backend — Express API Server
 *
 * Bridges the React setup wizard to the DFRNT TMS API.
 * Uses the same cookie-based auth and session self-healing as the MCP server.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { DfrntApiClient, DfrntBearerClient, DfrntDualClient, IApiClient } from './api-client.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const ENV_KEY = process.env.DFRNT_ENVIRONMENT || 'medical-staging';
const USERNAME = process.env.DFRNT_USERNAME || '';
const PASSWORD = process.env.DFRNT_PASSWORD || '';
const BEARER_TOKEN = process.env.DFRNT_BEARER_TOKEN || '';
const API_BASE = process.env.DFRNT_API_BASE || '';

// Singleton API client — supports DfrntApiClient or DfrntDualClient
let apiClient: IApiClient;

export function getApiClient(): IApiClient {
  if (!apiClient) {
    const cookieClient = new DfrntApiClient(ENV_KEY, USERNAME, PASSWORD);

    if (BEARER_TOKEN && API_BASE) {
      const bearerClient = new DfrntBearerClient(API_BASE, BEARER_TOKEN);
      apiClient = new DfrntDualClient(cookieClient, bearerClient);
      console.log(`[server] Dual auth: Bearer (${API_BASE}) + Cookie (${ENV_KEY})`);
    } else {
      apiClient = cookieClient;
    }
  }
  return apiClient;
}

const app = express();

// CORS
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://deliver-different-testing.github.io'
  ],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// All routes under /api
app.use('/api', routes);

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[server] Setup Dashboard backend running on port ${PORT}`);
  console.log(`[server] Environment: ${ENV_KEY}`);
  console.log(`[server] Credentials: ${USERNAME ? 'configured' : '⚠️  NOT SET — add DFRNT_USERNAME and DFRNT_PASSWORD to .env'}`);
  console.log(`[server] Bearer token: ${BEARER_TOKEN ? 'configured' : 'not set'}`);
});

export default app;
