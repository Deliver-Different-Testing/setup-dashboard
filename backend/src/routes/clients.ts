import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { getApiClient } from '../index.js';
import { getSession, completeStep } from '../services/setup-orchestrator.js';
import { trackEntities, addClientContacts, getClientContacts, deleteClientContacts } from '../services/database.js';
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
    trackEntities(session.id, createdIds.map(id => ({ entityType: 'client', entityId: id, entityName: undefined, stepNumber: 2 })));
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
    trackEntities(session.id, createdIds.map(id => ({ entityType: 'client', entityId: id, entityName: undefined, stepNumber: 2 })));
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

// ── Client Contacts ──

const ContactSchema = z.object({
  clientName: z.string().min(1),
  firstName: z.string().default(''),
  lastName: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().default(''),
  role: z.string().default(''),
  isPrimary: z.boolean().default(false),
});

const ContactsPayload = z.object({
  sessionId: z.string(),
  contacts: z.array(ContactSchema),
});

// Save contacts
router.post('/setup/clients/contacts', async (req, res, next) => {
  try {
    const input = ContactsPayload.parse(req.body);
    const session = getSession(input.sessionId);
    if (!session) throw new ApiError(404, 'Session not found');

    const count = addClientContacts(session.id, input.contacts);
    res.json({ success: true, saved: count });
  } catch (err) {
    next(err);
  }
});

// Get contacts for session
router.get('/setup/clients/contacts/:sessionId', async (req, res, next) => {
  try {
    const session = getSession(req.params.sessionId);
    if (!session) throw new ApiError(404, 'Session not found');

    const contacts = getClientContacts(session.id);
    res.json({ success: true, contacts });
  } catch (err) {
    next(err);
  }
});

// Replace all contacts (delete + re-insert)
router.put('/setup/clients/contacts', async (req, res, next) => {
  try {
    const input = ContactsPayload.parse(req.body);
    const session = getSession(input.sessionId);
    if (!session) throw new ApiError(404, 'Session not found');

    deleteClientContacts(session.id);
    const count = addClientContacts(session.id, input.contacts);
    res.json({ success: true, saved: count });
  } catch (err) {
    next(err);
  }
});

export default router;
