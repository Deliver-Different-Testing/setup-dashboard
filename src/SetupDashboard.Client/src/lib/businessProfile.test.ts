import { describe, expect, it } from 'vitest'
import { countryRules, isListedCountry, settingMatchesTenant } from './businessProfile'

describe('countryRules', () => {
  it('names the registration number the way each country does', () => {
    expect(countryRules('New Zealand').registrationLabel).toBe('NZBN')
    expect(countryRules('Australia').registrationLabel).toBe('ABN')
    expect(countryRules('United States').registrationLabel).toBe('EIN')
  })

  it('asks for a state of incorporation only where companies incorporate by state', () => {
    expect(countryRules('United States').hasState).toBe(true)
    expect(countryRules('Australia').hasState).toBe(true)
    expect(countryRules('New Zealand').hasState).toBe(false)
  })

  it('falls back to generic wording, with the state field shown, for unlisted or blank countries', () => {
    const r = countryRules('Fiji')
    expect(r.registrationLabel).toBe('Registration number')
    expect(r.businessTypes).toEqual([])
    expect(r.hasState).toBe(true)
    expect(countryRules(undefined).registrationLabel).toBe('Registration number')
  })

  it('matches a stored country regardless of case and padding', () => {
    expect(countryRules(' united states ').registrationLabel).toBe('EIN')
    expect(isListedCountry('new zealand')).toBe(true)
    expect(isListedCountry('Fiji')).toBe(false)
    expect(isListedCountry(undefined)).toBe(false)
  })
})

describe('settingMatchesTenant', () => {
  it('cannot judge until a trading or legal name is entered', () => {
    expect(settingMatchesTenant('12 Other St', [undefined, ''])).toBe('unknown')
  })

  it('treats an empty setting as nothing to flag', () => {
    expect(settingMatchesTenant(undefined, ['Urgent Couriers'])).toBe('unknown')
  })

  it('matches on the first word of the trading name, ignoring case', () => {
    expect(settingMatchesTenant('admin@urgent.co.nz', ['Urgent Couriers'])).toBe('match')
    expect(settingMatchesTenant('ops@acme.com', ['Urgent Couriers'])).toBe('mismatch')
  })

  it('skips a leading "The" so it does not match every sentence', () => {
    expect(settingMatchesTenant('The other company, 1 Main St', ['The Parcel People'])).toBe('mismatch')
    expect(settingMatchesTenant('Parcel People HQ', ['The Parcel People'])).toBe('match')
  })

  it('accepts a match on the legal name when the trading name differs', () => {
    expect(settingMatchesTenant('billing@ucl.co.nz', ['Urgent Couriers', 'UCL Holdings Ltd'])).toBe('match')
  })
})
