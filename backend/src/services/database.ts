import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'setup-sessions.db');

let db: Database.Database;

// ── Types ──

export interface CreateSessionInput {
  id: string;
  environment: string;
  status?: string;
  bearerToken?: string;
  apiBaseUrl?: string;
  businessData?: Record<string, unknown>;
  currentStep?: number;
  completedSteps?: number[];
  createdBy?: string;
}

export interface SetupSession {
  id: string;
  environment: string;
  status: string;
  bearerToken: string | null;
  apiBaseUrl: string | null;
  businessData: Record<string, unknown> | null;
  currentStep: number;
  completedSteps: number[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  createdBy: string | null;
}

export interface EntityInput {
  entityType: string;
  entityId: number;
  entityName?: string;
  stepNumber: number;
}

export interface SessionEntity {
  id: number;
  sessionId: string;
  entityType: string;
  entityId: number;
  entityName: string | null;
  stepNumber: number;
  createdAt: string;
}

export interface ImportRecord {
  importType: string;
  sourceSystem?: string;
  sourceFilename?: string;
  totalRows: number;
  successCount: number;
  failedCount: number;
  fieldMappings?: Record<string, string>;
  errors?: string[];
}

export interface ImportHistoryRow {
  id: number;
  sessionId: string;
  importType: string;
  sourceSystem: string | null;
  sourceFilename: string | null;
  totalRows: number;
  successCount: number;
  failedCount: number;
  fieldMappings: Record<string, string> | null;
  errors: string[] | null;
  createdAt: string;
}

export interface TrainingInput {
  userEmail: string;
  userName: string;
  role: string;
  xp?: number;
  completedChallenges?: string[];
  currentStreak?: number;
  lastActive?: string;
}

export interface TrainingRecord {
  id: number;
  sessionId: string;
  userEmail: string;
  userName: string;
  role: string;
  xp: number;
  completedChallenges: string[];
  currentStreak: number;
  lastActive: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateInput {
  name: string;
  entityType: string;
  sourceSystem?: string;
  mappings: Array<{ csvColumn: string; dfField: string }>;
  createdBy?: string;
}

export interface ImportTemplate {
  id: number;
  name: string;
  entityType: string;
  sourceSystem: string | null;
  mappings: Array<{ csvColumn: string; dfField: string }>;
  createdBy: string | null;
  createdAt: string;
}

// ── Init ──

export function initDatabase(): void {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS setup_sessions (
      id TEXT PRIMARY KEY,
      environment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      bearer_token TEXT,
      api_base_url TEXT,
      business_data TEXT,
      current_step INTEGER DEFAULT 0,
      completed_steps TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      created_by TEXT
    );

    CREATE TABLE IF NOT EXISTS session_entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES setup_sessions(id),
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      entity_name TEXT,
      step_number INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(session_id, entity_type, entity_id)
    );

    CREATE TABLE IF NOT EXISTS import_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES setup_sessions(id),
      import_type TEXT NOT NULL,
      source_system TEXT,
      source_filename TEXT,
      total_rows INTEGER NOT NULL,
      success_count INTEGER NOT NULL,
      failed_count INTEGER NOT NULL,
      field_mappings TEXT,
      errors TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS training_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES setup_sessions(id),
      user_email TEXT NOT NULL,
      user_name TEXT NOT NULL,
      role TEXT NOT NULL,
      xp INTEGER DEFAULT 0,
      completed_challenges TEXT DEFAULT '[]',
      current_streak INTEGER DEFAULT 0,
      last_active TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(session_id, user_email)
    );

    CREATE TABLE IF NOT EXISTS import_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      source_system TEXT,
      mappings TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(name, entity_type)
    );

    CREATE TABLE IF NOT EXISTS client_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES setup_sessions(id),
      client_name TEXT NOT NULL,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT '',
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
}

// ── Helpers ──

function now(): string { return new Date().toISOString(); }

function rowToSession(row: any): SetupSession {
  return {
    id: row.id,
    environment: row.environment,
    status: row.status,
    bearerToken: row.bearer_token,
    apiBaseUrl: row.api_base_url,
    businessData: row.business_data ? JSON.parse(row.business_data) : null,
    currentStep: row.current_step,
    completedSteps: JSON.parse(row.completed_steps || '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    createdBy: row.created_by,
  };
}

// ── Sessions ──

export function createSession(input: CreateSessionInput): SetupSession {
  const ts = now();
  db.prepare(`
    INSERT INTO setup_sessions (id, environment, status, bearer_token, api_base_url, business_data, current_step, completed_steps, created_at, updated_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id, input.environment, input.status || 'active',
    input.bearerToken || null, input.apiBaseUrl || null,
    input.businessData ? JSON.stringify(input.businessData) : null,
    input.currentStep ?? 0, JSON.stringify(input.completedSteps || []),
    ts, ts, input.createdBy || null
  );
  return getSession(input.id)!;
}

export function getSession(id: string): SetupSession | null {
  const row = db.prepare('SELECT * FROM setup_sessions WHERE id = ?').get(id);
  return row ? rowToSession(row) : null;
}

export function updateSession(id: string, updates: Partial<{
  status: string; bearerToken: string; apiBaseUrl: string;
  businessData: Record<string, unknown>; currentStep: number;
  completedSteps: number[]; completedAt: string; createdBy: string;
}>): void {
  const sets: string[] = ['updated_at = ?'];
  const vals: any[] = [now()];
  if (updates.status !== undefined) { sets.push('status = ?'); vals.push(updates.status); }
  if (updates.bearerToken !== undefined) { sets.push('bearer_token = ?'); vals.push(updates.bearerToken); }
  if (updates.apiBaseUrl !== undefined) { sets.push('api_base_url = ?'); vals.push(updates.apiBaseUrl); }
  if (updates.businessData !== undefined) { sets.push('business_data = ?'); vals.push(JSON.stringify(updates.businessData)); }
  if (updates.currentStep !== undefined) { sets.push('current_step = ?'); vals.push(updates.currentStep); }
  if (updates.completedSteps !== undefined) { sets.push('completed_steps = ?'); vals.push(JSON.stringify(updates.completedSteps)); }
  if (updates.completedAt !== undefined) { sets.push('completed_at = ?'); vals.push(updates.completedAt); }
  if (updates.createdBy !== undefined) { sets.push('created_by = ?'); vals.push(updates.createdBy); }
  vals.push(id);
  db.prepare(`UPDATE setup_sessions SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

export function listSessions(status?: string): SetupSession[] {
  const rows = status
    ? db.prepare('SELECT * FROM setup_sessions WHERE status = ? ORDER BY created_at DESC').all(status)
    : db.prepare('SELECT * FROM setup_sessions ORDER BY created_at DESC').all();
  return (rows as any[]).map(rowToSession);
}

export function deleteSession(id: string): void {
  db.prepare('DELETE FROM client_contacts WHERE session_id = ?').run(id);
  db.prepare('DELETE FROM session_entities WHERE session_id = ?').run(id);
  db.prepare('DELETE FROM import_history WHERE session_id = ?').run(id);
  db.prepare('DELETE FROM training_progress WHERE session_id = ?').run(id);
  db.prepare('DELETE FROM setup_sessions WHERE id = ?').run(id);
}

// ── Entity Tracking ──

export function trackEntity(sessionId: string, entity: EntityInput): void {
  db.prepare(`
    INSERT OR REPLACE INTO session_entities (session_id, entity_type, entity_id, entity_name, step_number, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, entity.entityType, entity.entityId, entity.entityName || null, entity.stepNumber, now());
}

export function trackEntities(sessionId: string, entities: EntityInput[]): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO session_entities (session_id, entity_type, entity_id, entity_name, step_number, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction((items: EntityInput[]) => {
    const ts = now();
    for (const e of items) stmt.run(sessionId, e.entityType, e.entityId, e.entityName || null, e.stepNumber, ts);
  });
  tx(entities);
}

export function getSessionEntities(sessionId: string, entityType?: string): SessionEntity[] {
  const rows = entityType
    ? db.prepare('SELECT * FROM session_entities WHERE session_id = ? AND entity_type = ? ORDER BY created_at').all(sessionId, entityType)
    : db.prepare('SELECT * FROM session_entities WHERE session_id = ? ORDER BY created_at').all(sessionId);
  return (rows as any[]).map(r => ({
    id: r.id, sessionId: r.session_id, entityType: r.entity_type,
    entityId: r.entity_id, entityName: r.entity_name, stepNumber: r.step_number, createdAt: r.created_at,
  }));
}

export function removeEntity(sessionId: string, entityType: string, entityId: number): void {
  db.prepare('DELETE FROM session_entities WHERE session_id = ? AND entity_type = ? AND entity_id = ?').run(sessionId, entityType, entityId);
}

// ── Import History ──

export function recordImport(sessionId: string, data: ImportRecord): void {
  db.prepare(`
    INSERT INTO import_history (session_id, import_type, source_system, source_filename, total_rows, success_count, failed_count, field_mappings, errors, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sessionId, data.importType, data.sourceSystem || null, data.sourceFilename || null,
    data.totalRows, data.successCount, data.failedCount,
    data.fieldMappings ? JSON.stringify(data.fieldMappings) : null,
    data.errors ? JSON.stringify(data.errors) : null, now());
}

export function getImportHistory(sessionId: string): ImportHistoryRow[] {
  const rows = db.prepare('SELECT * FROM import_history WHERE session_id = ? ORDER BY created_at DESC').all(sessionId);
  return (rows as any[]).map(r => ({
    id: r.id, sessionId: r.session_id, importType: r.import_type,
    sourceSystem: r.source_system, sourceFilename: r.source_filename,
    totalRows: r.total_rows, successCount: r.success_count, failedCount: r.failed_count,
    fieldMappings: r.field_mappings ? JSON.parse(r.field_mappings) : null,
    errors: r.errors ? JSON.parse(r.errors) : null, createdAt: r.created_at,
  }));
}

// ── Training ──

export function upsertTrainingProgress(sessionId: string, p: TrainingInput): void {
  const ts = now();
  db.prepare(`
    INSERT INTO training_progress (session_id, user_email, user_name, role, xp, completed_challenges, current_streak, last_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id, user_email) DO UPDATE SET
      user_name = excluded.user_name, role = excluded.role, xp = excluded.xp,
      completed_challenges = excluded.completed_challenges, current_streak = excluded.current_streak,
      last_active = excluded.last_active, updated_at = excluded.updated_at
  `).run(sessionId, p.userEmail, p.userName, p.role, p.xp ?? 0,
    JSON.stringify(p.completedChallenges || []), p.currentStreak ?? 0, p.lastActive || null, ts, ts);
}

export function getTrainingProgress(sessionId: string): TrainingRecord[] {
  const rows = db.prepare('SELECT * FROM training_progress WHERE session_id = ?').all(sessionId);
  return (rows as any[]).map(r => ({
    id: r.id, sessionId: r.session_id, userEmail: r.user_email, userName: r.user_name,
    role: r.role, xp: r.xp, completedChallenges: JSON.parse(r.completed_challenges || '[]'),
    currentStreak: r.current_streak, lastActive: r.last_active, createdAt: r.created_at, updatedAt: r.updated_at,
  }));
}

export function getLeaderboard(sessionId: string): TrainingRecord[] {
  const rows = db.prepare('SELECT * FROM training_progress WHERE session_id = ? ORDER BY xp DESC').all(sessionId);
  return (rows as any[]).map(r => ({
    id: r.id, sessionId: r.session_id, userEmail: r.user_email, userName: r.user_name,
    role: r.role, xp: r.xp, completedChallenges: JSON.parse(r.completed_challenges || '[]'),
    currentStreak: r.current_streak, lastActive: r.last_active, createdAt: r.created_at, updatedAt: r.updated_at,
  }));
}

// ── Templates ──

export function saveImportTemplate(t: TemplateInput): void {
  db.prepare(`
    INSERT OR REPLACE INTO import_templates (name, entity_type, source_system, mappings, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(t.name, t.entityType, t.sourceSystem || null, JSON.stringify(t.mappings), t.createdBy || null, now());
}

export function getImportTemplates(entityType?: string): ImportTemplate[] {
  const rows = entityType
    ? db.prepare('SELECT * FROM import_templates WHERE entity_type = ? ORDER BY name').all(entityType)
    : db.prepare('SELECT * FROM import_templates ORDER BY name').all();
  return (rows as any[]).map(r => ({
    id: r.id, name: r.name, entityType: r.entity_type, sourceSystem: r.source_system,
    mappings: JSON.parse(r.mappings), createdBy: r.created_by, createdAt: r.created_at,
  }));
}

export function deleteImportTemplate(id: number): void {
  db.prepare('DELETE FROM import_templates WHERE id = ?').run(id);
}

// ── Client Contacts ──

export interface ClientContactInput {
  clientName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  isPrimary: boolean;
}

export interface ClientContactRecord extends ClientContactInput {
  id: number;
  sessionId: string;
  createdAt: string;
}

export function addClientContacts(sessionId: string, contacts: ClientContactInput[]): number {
  const stmt = db.prepare(`
    INSERT INTO client_contacts (session_id, client_name, first_name, last_name, email, phone, role, is_primary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const ts = now();
  const tx = db.transaction(() => {
    let count = 0;
    for (const c of contacts) {
      stmt.run(sessionId, c.clientName, c.firstName, c.lastName, c.email, c.phone, c.role, c.isPrimary ? 1 : 0, ts);
      count++;
    }
    return count;
  });
  return tx();
}

export function getClientContacts(sessionId: string): ClientContactRecord[] {
  const rows = db.prepare('SELECT * FROM client_contacts WHERE session_id = ? ORDER BY client_name, last_name, first_name').all(sessionId) as any[];
  return rows.map(r => ({
    id: r.id, sessionId: r.session_id, clientName: r.client_name,
    firstName: r.first_name, lastName: r.last_name, email: r.email,
    phone: r.phone, role: r.role, isPrimary: !!r.is_primary, createdAt: r.created_at,
  }));
}

export function deleteClientContacts(sessionId: string): void {
  db.prepare('DELETE FROM client_contacts WHERE session_id = ?').run(sessionId);
}
