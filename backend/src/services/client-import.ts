/**
 * Client Import Service
 *
 * CSV parsing + bulk client creation via /api/client
 */

import Papa from 'papaparse';
import { DfrntApiClient } from '../api-client.js';
import { BulkResult } from '../types/api.js';
import { ApiError } from '../middleware/error-handler.js';

export interface ClientInput {
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  billing?: string;
  code?: string;
  legalName?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

/** Column mapping from CSV headers to client fields */
const COLUMN_MAP: Record<string, keyof ClientInput> = {
  'name': 'name',
  'company': 'name',
  'company name': 'name',
  'client': 'name',
  'client name': 'name',
  'contact': 'contact',
  'contact name': 'contact',
  'phone': 'phone',
  'telephone': 'phone',
  'mobile': 'phone',
  'email': 'email',
  'email address': 'email',
  'billing': 'billing',
  'billing address': 'billing',
  'code': 'code',
  'client code': 'code',
  'legal name': 'legalName',
  'address': 'address',
  'street': 'address',
  'city': 'city',
  'state': 'state',
  'zip': 'zipCode',
  'zip code': 'zipCode',
  'zipcode': 'zipCode',
  'postal code': 'zipCode',
};

export function parseClientCsv(csvContent: string): ClientInput[] {
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim().toLowerCase()
  });

  if (result.errors.length > 0) {
    const errorMsgs = result.errors.slice(0, 5).map(e => e.message).join('; ');
    throw new ApiError(400, `CSV parsing errors: ${errorMsgs}`);
  }

  return (result.data as Record<string, string>[]).map(row => {
    const client: Partial<ClientInput> = {};
    for (const [csvCol, value] of Object.entries(row)) {
      const field = COLUMN_MAP[csvCol.toLowerCase()];
      if (field && value?.trim()) {
        (client as any)[field] = value.trim();
      }
    }
    if (!client.name) return null;
    return client as ClientInput;
  }).filter(Boolean) as ClientInput[];
}

export async function createClients(
  client: DfrntApiClient,
  clients: ClientInput[]
): Promise<BulkResult> {
  const items = clients.map(c => ({
    name: c.name,
    code: c.code || c.name.substring(0, 10).toUpperCase().replace(/\s+/g, ''),
    legalName: c.legalName || c.name,
    phone: c.phone || '',
    email: c.email || '',
    type: 'Standard',
    smsName: c.name.substring(0, 20),
    americanCity: c.city || 'Unknown',
    americanState: c.state || 'NY',
    americanZipCode: c.zipCode || '10001',
    addressStreetName: c.address || '123 Main St',
    displayAddress: c.address || c.name,
    referralSource: 1,
    dropOffReport: 'Standard',
    active: true
  }));

  return client.bulkCreate('/api/client', items, {
    delayMs: 100,
    retryAttempts: 2,
    onProgress: (done, total) => {
      if (done % 10 === 0 || done === total) {
        console.log(`[client-import] ${done}/${total} clients processed`);
      }
    }
  });
}
