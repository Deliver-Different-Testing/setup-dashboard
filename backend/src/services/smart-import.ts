/**
 * Smart Import Engine
 * 
 * Auto-detects competitor TMS CSV/Excel formats, maps columns to DF system fields,
 * validates data, and transforms rows for bulk import.
 * 
 * Patterns reused from bulkimport app:
 * - Template mapping (TemplateMappingDto.cs): UrgentField ↔ ImportField
 * - Field localization (FieldMappingUtility.cs): NZ vs US field names
 * - Validation (homeControl.js mapColumns()): required fields, data validation
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FieldMapping {
  csvColumn: string;
  dfField: string;
  confidence: number;
  transform?: string;
}

export interface CompetitorDetection {
  system: string;
  confidence: number;
  entityType: 'clients' | 'contacts' | 'drivers' | 'zones' | 'rates';
  suggestedMappings: FieldMapping[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  flaggedRows: number[];
}

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

// ─── Competitor Signatures ──────────────────────────────────────────────────

const COMPETITOR_SIGNATURES: Record<string, { headers: string[]; entityPatterns: Record<string, string[]> }> = {
  'CXT Software': {
    headers: ['AccountName', 'AccountCode', 'DriverCode', 'LicensePlate', 'ServiceLevel', 'RateSheet'],
    entityPatterns: {
      clients: ['AccountName', 'AccountCode', 'BillingEmail', 'BillingType'],
      drivers: ['DriverName', 'DriverCode', 'CellPhone', 'VehicleType', 'LicensePlate'],
      rates: ['RateName', 'RateSheet', 'ServiceLevel', 'BaseRate', 'PerMileRate'],
      zones: ['ZoneName', 'ZipCode', 'ZoneNumber', 'Sector'],
    },
  },
  'Key Software': {
    headers: ['Account_Name', 'Account_Number', 'Driver_Number', 'Acct_No', 'Driver_Name'],
    entityPatterns: {
      clients: ['Account_Name', 'Account_Number', 'Phone_Number', 'Email_Address', 'Billing_Type'],
      drivers: ['Driver_Name', 'Driver_Number', 'Cell_Phone', 'Vehicle_Type'],
      rates: ['Rate_Name', 'Base_Rate', 'Per_Mile', 'Service_Type'],
      zones: ['Zone_Name', 'Zip_Code', 'Zone_Number'],
    },
  },
  'Datatrac': {
    headers: ['ACCT_ID', 'CUST_NAME', 'DRV_ID', 'DRV_NAME', 'RATE_CODE'],
    entityPatterns: {
      clients: ['ACCT_ID', 'CUST_NAME', 'PHONE', 'EMAIL', 'BILL_TYPE'],
      drivers: ['DRV_ID', 'DRV_NAME', 'CELL', 'VEH_TYPE'],
      rates: ['RATE_CODE', 'BASE_AMT', 'MILE_RATE', 'SVC_TYPE'],
      zones: ['ZONE_ID', 'ZONE_NAME', 'ZIP'],
    },
  },
  'Crown': {
    headers: ['ClientCode', 'ClientName', 'DriverId', 'VehicleRego'],
    entityPatterns: {
      clients: ['ClientCode', 'ClientName', 'Phone', 'Email'],
      drivers: ['DriverId', 'DriverName', 'Mobile', 'VehicleRego', 'VehicleType'],
      rates: ['RateCode', 'BaseRate', 'KmRate', 'ServiceType'],
      zones: ['ZoneName', 'Postcode', 'Suburb'],
    },
  },
  'e-Courier': {
    headers: ['customer_id', 'customer_name', 'driver_id', 'driver_name'],
    entityPatterns: {
      clients: ['customer_id', 'customer_name', 'phone', 'email', 'billing_method'],
      drivers: ['driver_id', 'driver_name', 'cell_phone', 'vehicle_type'],
      rates: ['rate_name', 'base_charge', 'per_mile', 'service_level'],
      zones: ['zone_name', 'zip_code', 'zone_id'],
    },
  },
};

// ─── DF System Fields (target fields) ───────────────────────────────────────
// Reused from FieldMappingUtility.GetImportFieldNames()

const DF_FIELDS: Record<string, string[]> = {
  clients: ['name', 'code', 'legalName', 'phone', 'email', 'active', 'city', 'state', 'zipCode', 'address', 'billingType', 'contactFirstName', 'contactLastName', 'contactPhone', 'contactEmail'],
  contacts: ['clientName', 'firstName', 'lastName', 'email', 'phone', 'role', 'isPrimary', 'title', 'department'],
  drivers: ['name', 'code', 'firstName', 'surName', 'personalMobile', 'urgentMobile', 'courierType', 'active', 'internal', 'vehicleRegoNo', 'email'],
  rates: ['name', 'clientCode', 'serviceType', 'vehicleType', 'startDistance', 'endDistance', 'baseCharge', 'perDistanceUnit', 'distanceIncluded', 'minWeight', 'maxWeight', 'weightRate'],
  zones: ['name', 'zip', 'zoneNumber', 'location'],
};

// NZ localization aliases (FieldMappingUtility pattern)
const NZ_FIELD_MAP: Record<string, string> = {
  city: 'suburb',
  state: 'region',
  zipCode: 'postCode',
};

const US_FIELD_MAP: Record<string, string> = {
  suburb: 'city',
  region: 'state',
  postCode: 'zipCode',
};

// ─── Column-to-field mapping dictionary (all competitors + generic) ─────────

const COLUMN_TO_FIELD: Record<string, { field: string; entity: string; transform?: string }> = {
  // CXT Software
  accountname: { field: 'name', entity: 'clients' },
  accountcode: { field: 'code', entity: 'clients' },
  billingemail: { field: 'email', entity: 'clients' },
  billingtype: { field: 'billingType', entity: 'clients' },
  drivername: { field: 'name', entity: 'drivers' },
  drivercode: { field: 'code', entity: 'drivers' },
  cellphone: { field: 'personalMobile', entity: 'drivers' },
  vehicletype: { field: 'courierType', entity: 'drivers' },
  licenseplate: { field: 'vehicleRegoNo', entity: 'drivers' },
  ratename: { field: 'name', entity: 'rates' },
  ratesheet: { field: 'name', entity: 'rates' },
  servicelevel: { field: 'serviceType', entity: 'rates' },
  baserate: { field: 'baseCharge', entity: 'rates' },
  permilerate: { field: 'perDistanceUnit', entity: 'rates' },
  zonename: { field: 'name', entity: 'zones' },
  zipcode: { field: 'zip', entity: 'zones' },
  zonenumber: { field: 'zoneNumber', entity: 'zones' },
  sector: { field: 'location', entity: 'zones' },

  // Key Software
  account_name: { field: 'name', entity: 'clients' },
  account_number: { field: 'code', entity: 'clients' },
  acct_no: { field: 'code', entity: 'clients' },
  phone_number: { field: 'phone', entity: 'clients' },
  email_address: { field: 'email', entity: 'clients' },
  billing_type: { field: 'billingType', entity: 'clients' },
  driver_name: { field: 'name', entity: 'drivers' },
  driver_number: { field: 'code', entity: 'drivers' },
  cell_phone: { field: 'personalMobile', entity: 'drivers' },
  vehicle_type: { field: 'courierType', entity: 'drivers' },
  rate_name: { field: 'name', entity: 'rates' },
  base_rate: { field: 'baseCharge', entity: 'rates' },
  per_mile: { field: 'perDistanceUnit', entity: 'rates' },
  service_type: { field: 'serviceType', entity: 'rates' },
  zone_name: { field: 'name', entity: 'zones' },
  zip_code: { field: 'zip', entity: 'zones' },
  zone_number: { field: 'zoneNumber', entity: 'zones' },

  // Datatrac
  acct_id: { field: 'code', entity: 'clients' },
  cust_name: { field: 'name', entity: 'clients' },
  bill_type: { field: 'billingType', entity: 'clients' },
  drv_id: { field: 'code', entity: 'drivers' },
  drv_name: { field: 'name', entity: 'drivers' },
  veh_type: { field: 'courierType', entity: 'drivers' },
  rate_code: { field: 'name', entity: 'rates' },
  base_amt: { field: 'baseCharge', entity: 'rates' },
  mile_rate: { field: 'perDistanceUnit', entity: 'rates' },
  svc_type: { field: 'serviceType', entity: 'rates' },
  zone_id: { field: 'zoneNumber', entity: 'zones' },

  // Crown
  clientcode: { field: 'code', entity: 'clients' },
  clientname: { field: 'name', entity: 'clients' },
  driverid: { field: 'code', entity: 'drivers' },
  vehiclerego: { field: 'vehicleRegoNo', entity: 'drivers' },
  ratecode: { field: 'name', entity: 'rates' },
  kmrate: { field: 'perDistanceUnit', entity: 'rates', transform: 'kmToMiles' },
  postcode: { field: 'zipCode', entity: 'zones' },
  suburb: { field: 'city', entity: 'zones' },

  // e-Courier
  customer_id: { field: 'code', entity: 'clients' },
  customer_name: { field: 'name', entity: 'clients' },
  billing_method: { field: 'billingType', entity: 'clients' },
  driver_id: { field: 'code', entity: 'drivers' },
  base_charge: { field: 'baseCharge', entity: 'rates' },

  // Generic / common
  name: { field: 'name', entity: 'clients' },
  company: { field: 'name', entity: 'clients' },
  code: { field: 'code', entity: 'clients' },
  phone: { field: 'phone', entity: 'clients' },
  email: { field: 'email', entity: 'clients' },
  mobile: { field: 'personalMobile', entity: 'drivers' },
  address: { field: 'address', entity: 'clients' },
  city: { field: 'city', entity: 'clients' },
  state: { field: 'state', entity: 'clients' },
  zip: { field: 'zip', entity: 'zones' },
  contact: { field: 'contactFirstName', entity: 'clients' },
  contact_name: { field: 'contactFirstName', entity: 'clients', transform: 'splitName' },
  active: { field: 'active', entity: 'clients', transform: 'toBoolean' },
  cell: { field: 'personalMobile', entity: 'drivers' },
  firstname: { field: 'firstName', entity: 'drivers' },
  surname: { field: 'surName', entity: 'drivers' },
  lastname: { field: 'surName', entity: 'drivers' },
  last_name: { field: 'surName', entity: 'drivers' },
  first_name: { field: 'firstName', entity: 'drivers' },
  // Contact-specific aliases
  contact_first_name: { field: 'firstName', entity: 'contacts' },
  contact_last_name: { field: 'lastName', entity: 'contacts' },
  contact_email: { field: 'email', entity: 'contacts' },
  contact_phone: { field: 'phone', entity: 'contacts' },
  contact_role: { field: 'role', entity: 'contacts' },
  contact_title: { field: 'title', entity: 'contacts' },
  company: { field: 'clientName', entity: 'contacts' },
  company_name: { field: 'clientName', entity: 'contacts' },
  account_name_contact: { field: 'clientName', entity: 'contacts' },
  position: { field: 'role', entity: 'contacts' },
  department: { field: 'department', entity: 'contacts' },
  primary: { field: 'isPrimary', entity: 'contacts', transform: 'toBoolean' },
  is_primary: { field: 'isPrimary', entity: 'contacts', transform: 'toBoolean' },
  main_contact: { field: 'isPrimary', entity: 'contacts', transform: 'toBoolean' },
};

// ─── State abbreviation normalization ───────────────────────────────────────

const US_STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

// ─── Helper: Levenshtein distance ───────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

// ─── 1. detectCompetitor ────────────────────────────────────────────────────

export function detectCompetitor(headers: string[]): CompetitorDetection {
  const headerLower = headers.map(h => h.toLowerCase().trim());
  let bestSystem = 'Generic';
  let bestScore = 0;
  let bestEntityType: CompetitorDetection['entityType'] = 'clients';

  for (const [system, sig] of Object.entries(COMPETITOR_SIGNATURES)) {
    // Score: count how many signature headers match
    const sigLower = sig.headers.map(h => h.toLowerCase());
    const matches = sigLower.filter(s => headerLower.includes(s)).length;
    const score = matches / sigLower.length;

    if (score > bestScore) {
      bestScore = score;
      bestSystem = system;
    }
  }

  // Detect entity type from the best system's entity patterns
  if (bestSystem !== 'Generic') {
    const sig = COMPETITOR_SIGNATURES[bestSystem];
    let bestEntityScore = 0;
    for (const [entity, patterns] of Object.entries(sig.entityPatterns)) {
      const pLower = patterns.map(p => p.toLowerCase());
      const matches = pLower.filter(p => headerLower.includes(p)).length;
      const score = matches / pLower.length;
      if (score > bestEntityScore) {
        bestEntityScore = score;
        bestEntityType = entity as CompetitorDetection['entityType'];
      }
    }
  } else {
    // Generic entity detection from column names
    bestEntityType = detectEntityTypeGeneric(headerLower);
  }

  const confidence = bestSystem === 'Generic' ? 0.3 : Math.min(bestScore + 0.2, 1.0);

  // Build suggested mappings
  const suggestedMappings = buildFieldMappings(headers, { system: bestSystem, confidence, entityType: bestEntityType, suggestedMappings: [] }, false);

  return {
    system: bestSystem,
    confidence: Math.round(confidence * 100),
    entityType: bestEntityType,
    suggestedMappings,
  };
}

function detectEntityTypeGeneric(headersLower: string[]): CompetitorDetection['entityType'] {
  // Score each entity type by keyword presence
  const scores: Record<string, number> = { clients: 0, drivers: 0, rates: 0, zones: 0 };
  const keywords: Record<string, string[]> = {
    clients: ['account', 'client', 'customer', 'company', 'billing', 'invoice'],
    drivers: ['driver', 'courier', 'vehicle', 'license', 'rego', 'mobile'],
    rates: ['rate', 'charge', 'price', 'tariff', 'fee', 'distance', 'weight'],
    zones: ['zone', 'sector', 'area', 'region', 'postcode', 'suburb'],
  };
  for (const h of headersLower) {
    for (const [entity, kws] of Object.entries(keywords)) {
      if (kws.some(k => h.includes(k))) scores[entity]++;
    }
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return (best[1] > 0 ? best[0] : 'clients') as CompetitorDetection['entityType'];
}

// ─── 2. buildFieldMappings ──────────────────────────────────────────────────

export function buildFieldMappings(
  headers: string[],
  detection: CompetitorDetection,
  isNzTenant: boolean
): FieldMapping[] {
  const targetFields = DF_FIELDS[detection.entityType] || DF_FIELDS.clients;
  const localizedFields = isNzTenant
    ? targetFields.map(f => NZ_FIELD_MAP[f] || f)
    : targetFields;

  return headers.map(header => {
    const hLower = header.toLowerCase().replace(/[\s_-]+/g, '').trim();
    const hNorm = header.toLowerCase().replace(/[\s_-]+/g, '_').trim();

    // 1. Exact match in COLUMN_TO_FIELD dictionary
    const exactKey = Object.keys(COLUMN_TO_FIELD).find(
      k => k.replace(/[\s_-]+/g, '') === hLower || k === hNorm || k === header.toLowerCase()
    );
    if (exactKey) {
      const mapping = COLUMN_TO_FIELD[exactKey];
      const dfField = isNzTenant ? (NZ_FIELD_MAP[mapping.field] || mapping.field) : mapping.field;
      return { csvColumn: header, dfField, confidence: 95, transform: mapping.transform };
    }

    // 2. Fuzzy match against target DF fields
    let bestField = '';
    let bestDist = Infinity;
    for (const field of localizedFields) {
      const fNorm = field.toLowerCase().replace(/[\s_-]+/g, '');
      // Contains check
      if (hLower.includes(fNorm) || fNorm.includes(hLower)) {
        return { csvColumn: header, dfField: isNzTenant ? field : (US_FIELD_MAP[field] || field), confidence: 75 };
      }
      const dist = levenshtein(hLower, fNorm);
      if (dist < bestDist) {
        bestDist = dist;
        bestField = field;
      }
    }

    // If Levenshtein distance is small enough relative to string length
    const maxLen = Math.max(hLower.length, bestField.length);
    if (bestDist <= Math.ceil(maxLen * 0.35) && bestDist <= 3) {
      const dfField = isNzTenant ? bestField : (US_FIELD_MAP[bestField] || bestField);
      const conf = Math.round((1 - bestDist / maxLen) * 100);
      return { csvColumn: header, dfField, confidence: Math.max(conf, 40) };
    }

    // No match
    return { csvColumn: header, dfField: '', confidence: 0 };
  });
}

// ─── 3. validateImportData ──────────────────────────────────────────────────

const REQUIRED_FIELDS: Record<string, string[]> = {
  clients: ['name'],
  drivers: ['name'],
  rates: ['name'],
  zones: ['name'],
};

export function validateImportData(
  rows: Record<string, string>[],
  mappings: FieldMapping[],
  entityType: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const flaggedRows: number[] = [];

  // Check required fields are mapped
  const required = REQUIRED_FIELDS[entityType] || ['name'];
  const mappedFields = mappings.filter(m => m.dfField).map(m => m.dfField);
  for (const req of required) {
    if (!mappedFields.includes(req)) {
      errors.push(`Required field "${req}" is not mapped to any CSV column`);
    }
  }

  // Validate each row
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[\d\s\-()+.]{7,20}$/;

  rows.forEach((row, idx) => {
    let rowHasIssue = false;
    for (const mapping of mappings) {
      if (!mapping.dfField || !mapping.csvColumn) continue;
      const value = row[mapping.csvColumn]?.trim() || '';
      if (!value) continue;

      if (mapping.dfField === 'email' || mapping.dfField === 'contactEmail') {
        if (!emailRegex.test(value)) {
          warnings.push(`Row ${idx + 1}: Invalid email "${value}"`);
          rowHasIssue = true;
        }
      }

      if (['phone', 'personalMobile', 'urgentMobile', 'contactPhone'].includes(mapping.dfField)) {
        if (!phoneRegex.test(value)) {
          warnings.push(`Row ${idx + 1}: Invalid phone "${value}"`);
          rowHasIssue = true;
        }
      }

      if (mapping.dfField === 'state') {
        if (value.length > 2 && !US_STATES[value.toLowerCase()]) {
          warnings.push(`Row ${idx + 1}: Unknown state "${value}" — will attempt normalization`);
        }
      }
    }
    if (rowHasIssue) flaggedRows.push(idx);
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    flaggedRows,
  };
}

// ─── 4. transformRow ────────────────────────────────────────────────────────

export function transformRow(
  row: Record<string, string>,
  mappings: FieldMapping[],
  entityType: string,
  isNzTenant: boolean
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const mapping of mappings) {
    if (!mapping.dfField || !mapping.csvColumn) continue;
    let value: any = row[mapping.csvColumn]?.trim() || '';
    if (!value) continue;

    // Apply transforms
    switch (mapping.transform) {
      case 'toBoolean':
        value = ['yes', 'true', '1', 'active', 'y'].includes(value.toLowerCase());
        break;
      case 'splitName': {
        const parts = value.split(/\s+/);
        result['contactFirstName'] = parts[0] || '';
        result['contactLastName'] = parts.slice(1).join(' ') || '';
        continue; // skip normal assignment
      }
      case 'kmToMiles':
        value = (parseFloat(value) * 0.621371).toFixed(4);
        break;
      case 'kgToLbs':
        value = (parseFloat(value) * 2.20462).toFixed(2);
        break;
    }

    // State normalization
    if (mapping.dfField === 'state' && typeof value === 'string' && value.length > 2) {
      const abbr = US_STATES[value.toLowerCase()];
      if (abbr) value = abbr;
    }

    // NZ/US field localization
    let field = mapping.dfField;
    if (isNzTenant) {
      field = NZ_FIELD_MAP[field] || field;
    } else {
      field = US_FIELD_MAP[field] || field;
    }

    result[field] = value;
  }

  // Ensure active defaults to true if not set
  if (entityType === 'clients' || entityType === 'drivers') {
    if (result.active === undefined) result.active = true;
  }

  return result;
}

// ─── 5. parseImportFile ─────────────────────────────────────────────────────

export function parseImportFile(content: string | Buffer, filename: string): ParsedFile {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'xlsx' || ext === 'xls') {
    const workbook = XLSX.read(content, { type: Buffer.isBuffer(content) ? 'buffer' : 'string' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

    if (jsonData.length === 0) return { headers: [], rows: [] };

    const headers = Object.keys(jsonData[0]);
    const rows = jsonData.map(row => {
      const r: Record<string, string> = {};
      for (const key of headers) {
        r[key] = String(row[key] ?? '');
      }
      return r;
    });

    return { headers, rows };
  }

  // Default: CSV via PapaParse
  const text = Buffer.isBuffer(content) ? content.toString('utf-8') : content;
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  return {
    headers: result.meta.fields || [],
    rows: result.data,
  };
}

// ─── Export DF fields for frontend dropdowns ────────────────────────────────

export function getDfFields(entityType: string, isNzTenant: boolean): string[] {
  const fields = DF_FIELDS[entityType] || DF_FIELDS.clients;
  if (isNzTenant) {
    return fields.map(f => NZ_FIELD_MAP[f] || f);
  }
  return fields;
}
