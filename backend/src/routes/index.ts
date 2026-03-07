import { Router } from 'express';
import { z } from 'zod';
import { createSession, getSession } from '../services/setup-orchestrator.js';
import { listSessions, getSessionEntities, getImportHistory } from '../services/database.js';
import { rollbackSession } from '../services/rollback.js';
import { listEnvironments, ENVIRONMENTS } from '../types/api.js';
import { ApiError } from '../middleware/error-handler.js';
import { getApiClient } from '../index.js';
import { DfrntDualClient, DfrntBearerClient } from '../api-client.js';

import healthRouter from './health.js';
import businessRouter from './business.js';
import teamRouter from './team.js';
import clientsRouter from './clients.js';
import ratesRouter from './rates.js';
import couriersRouter from './couriers.js';
import automationsRouter from './automations.js';
import integrationsRouter from './integrations.js';
import appConfigRouter from './app-config.js';
import partnersRouter from './partners.js';
import importRouter from './import.js';

const router = Router();

// Session management
const CreateSessionSchema = z.object({
  environment: z.string().optional(),
  bearerToken: z.string().optional(),
  apiBaseUrl: z.string().optional()
});

router.post('/setup/session', (req, res, next) => {
  try {
    const input = CreateSessionSchema.parse(req.body);
    const env = input.environment || process.env.DFRNT_ENVIRONMENT || 'medical-staging';
    if (!listEnvironments().includes(env)) {
      throw new ApiError(400, `Invalid environment: ${env}. Available: ${listEnvironments().join(', ')}`);
    }
    const session = createSession(env);
    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
});

router.get('/setup/session/:id', (req, res, next) => {
  try {
    const session = getSession(req.params.id);
    if (!session) throw new ApiError(404, 'Session not found');
    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
});

// Test both auth methods
router.get('/setup/test-auth', async (req, res, next) => {
  try {
    const client = getApiClient();
    const result: Record<string, { ok: boolean; status?: number; error?: string }> = {};

    // Test cookie auth (admin manager)
    if (client instanceof DfrntDualClient) {
      try {
        const cookieResp = await client.adminClient.get('/api/zoneName');
        result.cookie = { ok: cookieResp.success, status: cookieResp.statusCode };
      } catch (err) {
        result.cookie = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }

      try {
        const bearerResp = await client.apiClient.get('/api/Jobs/ValidateUTAddress/test');
        result.bearer = { ok: bearerResp.success, status: bearerResp.statusCode };
      } catch (err) {
        result.bearer = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    } else {
      // Cookie-only client
      try {
        const cookieResp = await client.get('/api/zoneName');
        result.cookie = { ok: cookieResp.success, status: cookieResp.statusCode };
      } catch (err) {
        result.cookie = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
      result.bearer = { ok: false, error: 'Bearer token not configured' };
    }

    res.json({ success: true, auth: result });
  } catch (err) {
    next(err);
  }
});

// List all sessions
router.get('/setup/sessions', (req, res) => {
  const status = req.query.status as string | undefined;
  const sessions = listSessions(status);
  res.json({ success: true, sessions });
});

// List entities for a session
router.get('/setup/sessions/:id/entities', (req, res) => {
  const entityType = req.query.entityType as string | undefined;
  const entities = getSessionEntities(req.params.id, entityType);
  res.json({ success: true, entities });
});

// Full session data (for resume)
router.get('/setup/session/:id/full', (req, res, next) => {
  try {
    const session = getSession(req.params.id);
    if (!session) throw new ApiError(404, 'Session not found');

    const entities = getSessionEntities(req.params.id);
    const imports = getImportHistory(req.params.id);

    // Group entities by type
    const entitiesByType: Record<string, typeof entities> = {};
    for (const e of entities) {
      (entitiesByType[e.entityType] ??= []).push(e);
    }

    res.json({
      success: true,
      session,
      entities: entitiesByType,
      imports,
    });
  } catch (err) {
    next(err);
  }
});

// Rollback session
router.delete('/setup/session/:id/rollback', async (req, res, next) => {
  try {
    const session = getSession(req.params.id);
    if (!session) throw new ApiError(404, 'Session not found');

    const client = getApiClient();
    const result = await rollbackSession(req.params.id, client as any);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Mount all step routes
router.use(healthRouter);
router.use(businessRouter);
router.use(teamRouter);
router.use(clientsRouter);
router.use(ratesRouter);
router.use(couriersRouter);
router.use(automationsRouter);
router.use(integrationsRouter);
router.use(appConfigRouter);
router.use(partnersRouter);
router.use(importRouter);

export default router;
