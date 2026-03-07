/**
 * Setup Session Orchestrator
 *
 * SQLite-backed session management. Wraps database.ts for backward compatibility.
 */

import { v4 as uuidv4 } from 'uuid';
import * as db from './database.js';

// Re-export types
export type { SetupSession, SessionEntity, EntityInput } from './database.js';

// Legacy interface for backward compat with route handlers
export interface LegacySession {
  id: string;
  environment: string;
  createdAt: string;
  currentStep: number;
  completedSteps: number[];
  business?: {
    companyName: string;
    geography: string[];
    verticals: string[];
    currentSystem: string;
    deliveriesPerMonth: string;
  };
  entityIds: {
    clients: number[];
    couriers: number[];
    agents: number[];
    zoneGroupId?: number;
    zoneIds: number[];
    rateCardId?: number;
    breakGroupIds: number[];
    fuelSurchargeId?: number;
    automationRuleIds: number[];
    teamUserIds: number[];
  };
}

function sessionToLegacy(s: db.SetupSession): LegacySession {
  // Reconstruct entityIds from session_entities table
  const entities = db.getSessionEntities(s.id);
  const byType = (t: string) => entities.filter(e => e.entityType === t).map(e => e.entityId);
  const single = (t: string) => { const ids = byType(t); return ids.length > 0 ? ids[0] : undefined; };

  return {
    id: s.id,
    environment: s.environment,
    createdAt: s.createdAt,
    currentStep: s.currentStep,
    completedSteps: s.completedSteps,
    business: s.businessData as any,
    entityIds: {
      clients: byType('client'),
      couriers: byType('courier'),
      agents: byType('agent'),
      zoneGroupId: single('zone_group'),
      zoneIds: byType('zone'),
      rateCardId: single('rate_card'),
      breakGroupIds: byType('break_group'),
      fuelSurchargeId: single('fuel_surcharge'),
      automationRuleIds: byType('automation_rule'),
      teamUserIds: byType('user'),
    },
  };
}

export function createSession(environment: string): LegacySession {
  const session = db.createSession({
    id: uuidv4(),
    environment,
  });
  return sessionToLegacy(session);
}

export function getSession(id: string): LegacySession | undefined {
  const session = db.getSession(id);
  return session ? sessionToLegacy(session) : undefined;
}

export function updateSession(id: string, updates: Partial<LegacySession>): LegacySession | undefined {
  const existing = db.getSession(id);
  if (!existing) return undefined;

  const dbUpdates: Parameters<typeof db.updateSession>[1] = {};
  if (updates.business) dbUpdates.businessData = updates.business as any;
  if (updates.currentStep !== undefined) dbUpdates.currentStep = updates.currentStep;
  if (updates.completedSteps !== undefined) dbUpdates.completedSteps = updates.completedSteps;

  db.updateSession(id, dbUpdates);
  return getSession(id);
}

export function completeStep(id: string, step: number): LegacySession | undefined {
  const session = db.getSession(id);
  if (!session) return undefined;

  const completed = [...session.completedSteps];
  if (!completed.includes(step)) {
    completed.push(step);
    completed.sort((a, b) => a - b);
  }

  db.updateSession(id, {
    completedSteps: completed,
    currentStep: Math.max(session.currentStep, step + 1),
  });
  return getSession(id);
}
