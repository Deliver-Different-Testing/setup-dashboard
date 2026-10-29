// Rules for the Business profile step that don't need React: what each country calls its
// registration number, and whether a tenant's current system setting looks like someone else's.

export interface CountryRules { registrationLabel: string; businessTypes: string[]; hasState: boolean; stateLabel: string }

const COUNTRIES: Record<string, CountryRules> = {
  'New Zealand': { registrationLabel: 'NZBN', businessTypes: ['Limited company', 'Sole trader', 'Partnership', 'Trust'], hasState: false, stateLabel: '' },
  'Australia': { registrationLabel: 'ABN', businessTypes: ['Pty Ltd', 'Sole trader', 'Partnership', 'Trust'], hasState: true, stateLabel: 'State of registration' },
  'United States': { registrationLabel: 'EIN', businessTypes: ['LLC', 'Corporation', 'S corporation', 'Sole proprietorship', 'Partnership'], hasState: true, stateLabel: 'State of incorporation' },
  'United Kingdom': { registrationLabel: 'Company number', businessTypes: ['Private limited company', 'Sole trader', 'Partnership', 'LLP'], hasState: false, stateLabel: '' },
  'Canada': { registrationLabel: 'Business number', businessTypes: ['Corporation', 'Sole proprietorship', 'Partnership'], hasState: true, stateLabel: 'Province of incorporation' },
}

/** Unlisted countries keep every field, with neutral wording - we don't know what they need. */
const GENERIC: CountryRules = { registrationLabel: 'Registration number', businessTypes: [], hasState: true, stateLabel: 'State of incorporation' }

export const LISTED_COUNTRIES = Object.keys(COUNTRIES)

const find = (country?: string) => {
  const c = country?.trim().toLowerCase()
  return c ? LISTED_COUNTRIES.find(k => k.toLowerCase() === c) : undefined
}

export const isListedCountry = (country?: string) => find(country) !== undefined
export const listedCountryName = find
export const countryRules = (country?: string): CountryRules => COUNTRIES[find(country) ?? ''] ?? GENERIC

/** The word a tenant's own settings would contain: the first word of a name, skipping a leading "The". */
const keyWord = (name?: string) => name?.trim().toLowerCase().split(/\s+/).find(w => w !== 'the') || undefined

/**
 * Whether a system setting (address, admin email…) looks like this tenant's, judged against its
 * trading and legal names. 'unknown' when there's nothing to compare - no name yet, or no value.
 */
export function settingMatchesTenant(value: string | undefined, names: (string | undefined)[]): 'match' | 'mismatch' | 'unknown' {
  const keys = names.map(keyWord).filter((k): k is string => !!k)
  if (!value || keys.length === 0) return 'unknown'
  const v = value.toLowerCase()
  return keys.some(k => v.includes(k)) ? 'match' : 'mismatch'
}
