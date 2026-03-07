/**
 * Rollback Engine — deletes all entities created during a setup session
 * in reverse dependency order.
 */

import { IApiClient } from '../api-client.js';
import * as db from './database.js';

const DELETE_ENDPOINTS: Record<string, string> = {
  automation_rule: '/api/automationRules',
  fuel_surcharge: '/api/fuelSurcharge',
  break_group: '/api/weightBreakGroup',
  rate_card: '/api/rateCard',
  zone: '/api/zoneName',
  zone_group: '/api/zoneGroup',
  courier: '/api/courier',
  agent: '/api/agent',
  client: '/api/client',
  user: '/api/user',
};

const ROLLBACK_ORDER = [
  'automation_rule', 'fuel_surcharge', 'break_group', 'rate_card',
  'zone', 'zone_group', 'courier', 'agent', 'client', 'user'
];

export interface RollbackDetail {
  entityType: string;
  entityId: number;
  entityName: string | null;
  success: boolean;
  error?: string;
}

export interface RollbackResult {
  success: boolean;
  deleted: number;
  failed: number;
  details: RollbackDetail[];
}

export async function rollbackSession(sessionId: string, client: IApiClient): Promise<RollbackResult> {
  const entities = db.getSessionEntities(sessionId);
  if (entities.length === 0) {
    db.updateSession(sessionId, { status: 'rolled_back' });
    return { success: true, deleted: 0, failed: 0, details: [] };
  }

  // Group by type
  const byType: Record<string, db.SessionEntity[]> = {};
  for (const e of entities) {
    (byType[e.entityType] ??= []).push(e);
  }

  const details: RollbackDetail[] = [];
  let deleted = 0;
  let failed = 0;

  // Delete in reverse dependency order
  for (const entityType of ROLLBACK_ORDER) {
    const group = byType[entityType];
    if (!group || group.length === 0) continue;

    const endpoint = DELETE_ENDPOINTS[entityType];
    if (!endpoint) {
      for (const e of group) {
        details.push({ entityType, entityId: e.entityId, entityName: e.entityName, success: false, error: `No delete endpoint for ${entityType}` });
        failed++;
      }
      continue;
    }

    for (const entity of group) {
      try {
        const resp = await client.delete(`${endpoint}/${entity.entityId}`);
        if (resp.success || resp.statusCode === 200 || resp.statusCode === 204) {
          db.removeEntity(sessionId, entityType, entity.entityId);
          details.push({ entityType, entityId: entity.entityId, entityName: entity.entityName, success: true });
          deleted++;
        } else {
          details.push({ entityType, entityId: entity.entityId, entityName: entity.entityName, success: false, error: resp.error || `Status ${resp.statusCode}` });
          failed++;
        }
      } catch (err) {
        details.push({ entityType, entityId: entity.entityId, entityName: entity.entityName, success: false, error: err instanceof Error ? err.message : String(err) });
        failed++;
      }
    }
  }

  const status = failed === 0 ? 'rolled_back' : 'partially_rolled_back';
  db.updateSession(sessionId, { status });

  return { success: failed === 0, deleted, failed, details };
}
