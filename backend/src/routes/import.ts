/**
 * Smart Import API Routes
 * 
 * POST /setup/import/detect       — Upload file, detect competitor + suggest mappings
 * POST /setup/import/preview      — Preview first 10 rows with mappings applied
 * POST /setup/import/execute      — Run full import with confirmed mappings
 * POST /setup/import/google-sheet — Import from Google Sheet URL
 */

import { Router } from 'express';
import multer from 'multer';
import { execSync } from 'child_process';
import { z } from 'zod';
import {
  parseImportFile,
  detectCompetitor,
  buildFieldMappings,
  validateImportData,
  transformRow,
  getDfFields,
  FieldMapping,
} from '../services/smart-import.js';
import { getSession } from '../services/setup-orchestrator.js';
import { ApiError } from '../middleware/error-handler.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// In-memory file cache keyed by sessionId for multi-step workflow
const fileCache = new Map<string, { headers: string[]; rows: Record<string, string>[]; filename: string }>();

// ─── POST /setup/import/detect ──────────────────────────────────────────────

router.post('/setup/import/detect', upload.single('file'), (req, res, next) => {
  try {
    const sessionId = req.body.sessionId;
    if (!sessionId) throw new ApiError(400, 'sessionId required');

    const file = req.file;
    if (!file) throw new ApiError(400, 'No file uploaded');

    const parsed = parseImportFile(file.buffer, file.originalname);
    if (parsed.headers.length === 0) throw new ApiError(400, 'No headers found in file');

    // Cache for later steps
    fileCache.set(sessionId, { ...parsed, filename: file.originalname });

    const detection = detectCompetitor(parsed.headers);
    const isNzTenant = req.body.isNzTenant === 'true';
    const mappings = buildFieldMappings(parsed.headers, detection, isNzTenant);

    res.json({
      success: true,
      system: detection.system,
      confidence: detection.confidence,
      entityType: detection.entityType,
      headers: parsed.headers,
      rowCount: parsed.rows.length,
      suggestedMappings: mappings,
      dfFields: getDfFields(detection.entityType, isNzTenant),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /setup/import/preview ─────────────────────────────────────────────

const PreviewSchema = z.object({
  sessionId: z.string(),
  mappings: z.array(z.object({
    csvColumn: z.string(),
    dfField: z.string(),
    confidence: z.number().optional(),
    transform: z.string().optional(),
  })),
  entityType: z.string(),
  isNzTenant: z.boolean().optional(),
});

router.post('/setup/import/preview', (req, res, next) => {
  try {
    const input = PreviewSchema.parse(req.body);
    const cached = fileCache.get(input.sessionId);
    if (!cached) throw new ApiError(400, 'No file uploaded. Call /detect first.');

    const previewRows = cached.rows.slice(0, 10);
    const mappings = input.mappings as FieldMapping[];
    const isNz = input.isNzTenant ?? false;

    const transformed = previewRows.map(row => transformRow(row, mappings, input.entityType, isNz));
    const validation = validateImportData(cached.rows, mappings, input.entityType);

    res.json({
      success: true,
      preview: transformed,
      validation,
      totalRows: cached.rows.length,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /setup/import/execute ─────────────────────────────────────────────

const ExecuteSchema = z.object({
  sessionId: z.string(),
  mappings: z.array(z.object({
    csvColumn: z.string(),
    dfField: z.string(),
    confidence: z.number().optional(),
    transform: z.string().optional(),
  })),
  entityType: z.string(),
  isNzTenant: z.boolean().optional(),
});

router.post('/setup/import/execute', async (req, res, next) => {
  try {
    const input = ExecuteSchema.parse(req.body);
    const session = getSession(input.sessionId);
    if (!session) throw new ApiError(404, 'Session not found');

    const cached = fileCache.get(input.sessionId);
    if (!cached) throw new ApiError(400, 'No file uploaded. Call /detect first.');

    const mappings = input.mappings as FieldMapping[];
    const isNz = input.isNzTenant ?? false;

    // Validate before executing
    const validation = validateImportData(cached.rows, mappings, input.entityType);
    if (!validation.valid) {
      res.json({ success: false, errors: validation.errors, warnings: validation.warnings });
      return;
    }

    // Transform all rows
    const transformed = cached.rows.map(row => transformRow(row, mappings, input.entityType, isNz));

    // Bulk create via API client
    const apiClient = (session as any).apiClient;
    const entityEndpoints: Record<string, string> = {
      clients: '/api/client',
      drivers: '/api/courier',
      rates: '/api/rate',
      zones: '/api/zone',
    };

    const endpoint = entityEndpoints[input.entityType] || '/api/client';
    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    if (apiClient?.bulkCreate) {
      const result = await apiClient.bulkCreate(endpoint, transformed);
      created = result.created || transformed.length;
      failed = result.failed || 0;
    } else {
      // Fallback: store in session data
      const key = input.entityType;
      if (!(session as any).data) (session as any).data = {};
      (session as any).data[key] = transformed;
      created = transformed.length;
    }

    // Clean up cache
    fileCache.delete(input.sessionId);

    res.json({
      success: true,
      imported: created,
      failed,
      total: cached.rows.length,
      errors,
      warnings: validation.warnings,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /setup/import/google-sheet ────────────────────────────────────────

const GoogleSheetSchema = z.object({
  sessionId: z.string(),
  sheetUrl: z.string(),
  sheetName: z.string().optional(),
  isNzTenant: z.boolean().optional(),
});

router.post('/setup/import/google-sheet', (req, res, next) => {
  try {
    const input = GoogleSheetSchema.parse(req.body);

    // Extract sheet ID from URL
    const match = input.sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    const sheetId = match ? match[1] : input.sheetUrl; // allow raw ID too
    const sheetName = input.sheetName || 'Sheet1';

    // Fetch via gog CLI
    let jsonOutput: string;
    try {
      jsonOutput = execSync(
        `gog sheets get "${sheetId}" "${sheetName}" --json`,
        {
          env: {
            ...process.env,
            GOG_ACCOUNT: 'steve@deliverdifferent.com',
            GOG_KEYRING_PASSWORD: 'B0nn1c11??!!',
          },
          timeout: 30000,
          encoding: 'utf-8',
        }
      );
    } catch (e: any) {
      throw new ApiError(500, `Failed to fetch Google Sheet: ${e.message}`);
    }

    // Parse JSON output
    let sheetData: any[];
    try {
      sheetData = JSON.parse(jsonOutput);
    } catch {
      throw new ApiError(500, 'Failed to parse Google Sheet data');
    }

    if (!Array.isArray(sheetData) || sheetData.length === 0) {
      throw new ApiError(400, 'Google Sheet is empty');
    }

    const headers = Object.keys(sheetData[0]);
    const rows = sheetData.map((row: any) => {
      const r: Record<string, string> = {};
      for (const key of headers) r[key] = String(row[key] ?? '');
      return r;
    });

    // Cache and detect
    fileCache.set(input.sessionId, { headers, rows, filename: `google-sheet-${sheetId}.json` });
    const detection = detectCompetitor(headers);
    const isNz = input.isNzTenant ?? false;
    const mappings = buildFieldMappings(headers, detection, isNz);

    res.json({
      success: true,
      system: detection.system,
      confidence: detection.confidence,
      entityType: detection.entityType,
      headers,
      rowCount: rows.length,
      suggestedMappings: mappings,
      dfFields: getDfFields(detection.entityType, isNz),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
