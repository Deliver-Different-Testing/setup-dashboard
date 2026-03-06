/**
 * Setup Session Orchestrator
 *
 * Tracks setup wizard progress in-memory. Each session stores:
 * - environment, current step, completed steps, entity IDs created per step
 */

import { v4 as uuidv4 } from 'uuid';

export interface SetupSession {
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

const sessions = new Map<string, SetupSession>();

export function createSession(environment: string): SetupSession {
  const session: SetupSession = {
    id: uuidv4(),
    environment,
    createdAt: new Date().toISOString(),
    currentStep: 0,
    completedSteps: [],
    entityIds: {
      clients: [],
      couriers: [],
      agents: [],
      zoneIds: [],
      breakGroupIds: [],
      automationRuleIds: [],
      teamUserIds: []
    }
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): SetupSession | undefined {
  return sessions.get(id);
}

export function updateSession(id: string, updates: Partial<SetupSession>): SetupSession | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  Object.assign(session, updates);
  sessions.set(id, session);
  return session;
}

export function completeStep(id: string, step: number): SetupSession | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  if (!session.completedSteps.includes(step)) {
    session.completedSteps.push(step);
    session.completedSteps.sort((a, b) => a - b);
  }
  session.currentStep = Math.max(session.currentStep, step + 1);
  sessions.set(id, session);
  return session;
}
