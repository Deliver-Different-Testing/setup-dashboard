/**
 * DFRNT TMS API Type Definitions
 * Copied from dfrnt-mcp-server with minor adaptations
 */

export interface Environment {
  name: string;
  baseUrl: string;
  hubUrl: string;
  hubLoginUrl: string;
  dispatchUrl: string;
  apiUrl: string;
  description: string;
}

export const ENVIRONMENTS: Record<string, Environment> = {
  'medical-staging': {
    name: 'Medical Staging',
    baseUrl: 'https://adminmanager.medical.staging.deliverdifferent.com',
    hubUrl: 'https://hub.medical.staging.deliverdifferent.com',
    hubLoginUrl: 'https://hub.medical.staging.deliverdifferent.com/Account/login',
    dispatchUrl: 'https://despatch.medical.staging.deliverdifferent.com',
    apiUrl: 'https://api.medical.staging.deliverdifferent.com',
    description: 'Medical courier staging environment'
  },
  'medical-prod': {
    name: 'Medical Production',
    baseUrl: 'https://adminmanager.medical.deliverdifferent.com',
    hubUrl: 'https://hub.medical.deliverdifferent.com',
    hubLoginUrl: 'https://hub.medical.deliverdifferent.com/Account/login',
    dispatchUrl: 'https://despatch.medical.deliverdifferent.com',
    apiUrl: 'https://api.medical.deliverdifferent.com',
    description: 'Medical courier production environment'
  },
  'otg-staging': {
    name: 'OTG Staging',
    baseUrl: 'https://adminmanager.otgcargo.staging.deliverdifferent.com',
    hubUrl: 'https://hub.otgcargo.staging.deliverdifferent.com',
    hubLoginUrl: 'https://hub.otgcargo.staging.deliverdifferent.com/Account/login',
    dispatchUrl: 'https://despatch.otgcargo.staging.deliverdifferent.com',
    apiUrl: 'https://api.otgcargo.staging.deliverdifferent.com',
    description: 'OTG Cargo staging environment'
  },
  'otg-prod': {
    name: 'OTG Production',
    baseUrl: 'https://adminmanager.otgcargo.deliverdifferent.com',
    hubUrl: 'https://hub.otgcargo.deliverdifferent.com',
    hubLoginUrl: 'https://hub.otgcargo.deliverdifferent.com/Account/login',
    dispatchUrl: 'https://despatch.otgcargo.deliverdifferent.com',
    apiUrl: 'https://api.otgcargo.deliverdifferent.com',
    description: 'OTG Cargo production environment'
  },
  'mpf-staging': {
    name: 'MPF Staging',
    baseUrl: 'https://adminmanager.mpf.staging.deliverdifferent.com',
    hubUrl: 'https://hub.mpf.staging.deliverdifferent.com',
    hubLoginUrl: 'https://hub.mpf.staging.deliverdifferent.com/Account/Login',
    dispatchUrl: 'https://despatch.mpf.staging.deliverdifferent.com',
    apiUrl: 'https://api.mpf.staging.deliverdifferent.com',
    description: 'MPF staging environment'
  },
  'mpf-prod': {
    name: 'MPF Production',
    baseUrl: 'https://adminmanager.mpf.deliverdifferent.com',
    hubUrl: 'https://hub.mpf.deliverdifferent.com',
    hubLoginUrl: 'https://hub.mpf.deliverdifferent.com/Account/Login',
    dispatchUrl: 'https://despatch.mpf.deliverdifferent.com',
    apiUrl: 'https://api.mpf.deliverdifferent.com',
    description: 'MPF production environment'
  },
  'am-staging': {
    name: 'AM Staging',
    baseUrl: 'https://adminmanager.am.staging.deliverdifferent.com',
    hubUrl: 'https://hub.am.staging.deliverdifferent.com',
    hubLoginUrl: 'https://hub.am.staging.deliverdifferent.com/Account/login',
    dispatchUrl: 'https://despatch.am.staging.deliverdifferent.com',
    apiUrl: 'https://api.am.staging.deliverdifferent.com',
    description: 'AM dedicated test staging environment'
  },
  'crossroads-staging': {
    name: 'Crossroads Courier Staging',
    baseUrl: 'https://adminmanager.crossroadscourier.staging.deliverdifferent.com',
    hubUrl: 'https://hub.crossroadscourier.staging.deliverdifferent.com',
    hubLoginUrl: 'https://hub.crossroadscourier.staging.deliverdifferent.com/Account/Login',
    dispatchUrl: 'https://despatch.crossroadscourier.staging.deliverdifferent.com',
    apiUrl: 'https://api.crossroadscourier.staging.deliverdifferent.com',
    description: 'Crossroads Courier staging environment'
  },
  'dfrnt-staging': {
    name: 'DFRNT Staging',
    baseUrl: 'https://adminmanager.dfrnt.staging.deliverdifferent.com',
    hubUrl: 'https://hub.dfrnt.staging.deliverdifferent.com',
    hubLoginUrl: 'https://hub.dfrnt.staging.deliverdifferent.com/Account/Login',
    dispatchUrl: 'https://despatch.dfrnt.staging.deliverdifferent.com',
    apiUrl: 'https://api.dfrnt.staging.deliverdifferent.com',
    description: 'DFRNT staging environment'
  }
};

export function getEnvironment(envKey: string): Environment | undefined {
  return ENVIRONMENTS[envKey];
}

export function listEnvironments(): string[] {
  return Object.keys(ENVIRONMENTS);
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface BulkResult {
  total: number;
  success: number;
  failed: number;
  results: Array<{
    item: unknown;
    success: boolean;
    id?: number;
    error?: string;
  }>;
}

/** Standard read-only fields that cause 500 if sent back to the API */
export const READ_ONLY_FIELDS = [
  'created', 'createdBy', 'lastModified', 'lastModifiedBy',
  'messageId', 'success', 'messages', 'data',
  'startDate', 'endDate', 'hasVersionHistory'
];

/**
 * Helper to extract array from API response that may be wrapped.
 * API returns either direct array or { propertyName: [...] }
 */
export function extractArray<T>(data: unknown, ...possibleKeys: string[]): T[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  for (const key of possibleKeys) {
    if (key in obj && Array.isArray(obj[key])) return obj[key] as T[];
  }
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}
