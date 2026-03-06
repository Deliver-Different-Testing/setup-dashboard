import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { getApiClient } from '../index.js';
import { getSession, completeStep } from '../services/setup-orchestrator.js';
import { parseClientCsv, createClients, ClientInput } from '../services/client-import.js';
import { ApiError } from '../middleware/error-handler.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ClientsSchema = z.object({
  sessionId: z.string(),
  clients: z.array(z.object({
    name: z.string().min(1),
    contact: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    billing: z.string().optional(),
    code: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional()
  }))
});

// Manual client creation
router.post('/setup/clients', async (req, res, next) => {
  try {
    const input = ClientsSchema.parse(req.body);
    const session = getSession(input.sessionId);
    if (!session) throw new ApiError(404, 'Session not found');

    const client = getApiClient();
    const result = await createClients(client, input.clients);

    const createdIds = result.results.filter(r => r.success && r.id).map(r => r.id!);
    session.entityIds.clients.push(...createdIds);
    completeStep(session.id, 2);

    res.json({
      success: true,
      step: 2,
      total: result.total,
      created: result.success,
      failed: result.failed,
      errors: result.results.filter(r => !r.success).map(r => ({
        item: (r.item as any)?.name,
        error: r.error
      }))
    });
  } catch (err) {
    next(err);
  }
});

// CSV import
router.post('/setup/clients/import', upload.single('file'), async (req, res, next) => {
  try {
    const sessionId = req.body.sessionId;
    if (!sessionId) throw new ApiError(400, 'sessionId is required');

    const session = getSession(sessionId);
    if (!session) throw new ApiError(404, 'Session not found');

    if (!req.file) throw new ApiError(400, 'No CSV file uploaded');

    const csvContent = req.file.buffer.toString('utf-8');
    const clients = parseClientCsv(csvContent);

    if (clients.length === 0) {
      throw new ApiError(400, 'No valid clients found in CSV. Ensure "name" or "company" column exists.');
    }

    const apiClient = getApiClient();
    const result = await createClients(apiClient, clients);

    const createdIds = result.results.filter(r => r.success && r.id).map(r => r.id!);
    session.entityIds.clients.push(...createdIds);
    completeStep(session.id, 2);

    res.json({
      success: true,
      step: 2,
      parsed: clients.length,
      total: result.total,
      created: result.success,
      failed: result.failed,
      errors: result.results.filter(r => !r.success).map(r => ({
        item: (r.item as any)?.name,
        error: r.error
      }))
    });
  } catch (err) {
    next(err);
  }
});

export default router;
