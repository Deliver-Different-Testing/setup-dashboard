import { describe, expect, it } from 'vitest'
import type { BusinessProfile, TenantSummary } from './api'
import { businessFlags, markEach, prefillBusiness, stripText, tenantHasData } from './alreadyInDfrnt'

const empty = (): TenantSummary => ({
  settings: {},
  counts: {
    team: 0, clients: 0, contacts: 0, couriers: 0, zones: 0, automations: 0, services: 0,
    rateCards: 0, zoneZips: 0, extraCharges: 0, partners: 0, roles: 0, depots: 0, tenantClientFile: false,
  },
  seedLooksDone: false,
})
const crisis = (): TenantSummary => {
  const s = empty()
  s.settings = { SystemName: 'Crisis Global Logistics', CountryCode: 'AU', Gstrate: '10', CompanyAddress: '1 Way' }
  Object.assign(s.counts, {
    team: 12, roles: 3, clients: 5, contacts: 21, couriers: 18, zones: 42, services: 4, rateCards: 1,
    zoneZips: 1180, extraCharges: 6, partners: 2, automations: 3, tenantClientFile: true,
  })
  return s
}
const profile = (p: Partial<BusinessProfile> = {}): BusinessProfile => ({ geography: [], verticals: [], primaryContact: {}, ...p })

describe('stripText', () => {
  it('describes what each step already has', () => {
    const s = crisis()
    expect(stripText('business', s)).toBe('Tenant client file exists. Company name: Crisis Global Logistics. Country: AU.')
    expect(stripText('team', s)).toBe("12 staff on the tenant's client file, 3 roles.")
    expect(stripText('clients', s)).toBe('5 clients, 9 contacts.')
    expect(stripText('rates', s)).toBe('1 rate card, 4 services, 42 zones, 1,180 postcodes on zones, 6 extra charges.')
    expect(stripText('couriers', s)).toBe('18 couriers.')
    expect(stripText('partners', s)).toBe('2 partners.')
    expect(stripText('automations', s)).toBe('3 active automation rules.')
  })

  it('shows nothing for an empty tenant or a step it cannot read', () => {
    for (const k of ['business', 'team', 'clients', 'rates', 'couriers', 'partners', 'automations', 'schedules', 'training'] as const)
      expect(stripText(k, empty())).toBeNull()
    expect(stripText('schedules', crisis())).toBeNull()
  })

  it('leaves out roles when Settings did not answer, and the seed default system name', () => {
    const s = crisis()
    s.counts.roles = null
    s.settings.SystemName = 'Despatch Manager'
    expect(stripText('team', s)).toBe("12 staff on the tenant's client file.")
    expect(stripText('business', s)).toBe('Tenant client file exists. Country: AU.')
  })

  it('uses singulars', () => {
    const s = empty()
    s.counts.couriers = 1
    s.counts.automations = 1
    expect(stripText('couriers', s)).toBe('1 courier.')
    expect(stripText('automations', s)).toBe('1 active automation rule.')
  })
})

describe('businessFlags', () => {
  it('flags what the seed leaves wrong', () => {
    expect(businessFlags({ SystemName: 'Despatch Manager', CountryCode: '', Gstrate: '0' })).toEqual([
      "System Name is still 'Despatch Manager'.", 'CountryCode is blank.', 'GST rate is 0.',
    ])
    expect(businessFlags(crisis().settings)).toEqual([])
  })
})

describe('prefillBusiness', () => {
  it('fills an empty profile from System Settings', () => {
    expect(prefillBusiness(profile(), crisis().settings)).toEqual({ companyName: 'Crisis Global Logistics', country: 'Australia' })
  })

  it('never overwrites what was entered, and skips the seed default name', () => {
    expect(prefillBusiness(profile({ companyName: 'Crisis' }), crisis().settings)).toBeNull()
    expect(prefillBusiness(profile(), { SystemName: 'Despatch Manager', CountryCode: 'NZ' })).toEqual({ country: 'New Zealand' })
    expect(prefillBusiness(profile(), { SystemName: 'Despatch Manager' })).toBeNull()
  })
})

describe('tenantHasData', () => {
  it('is true once the tenant has anything a step would show', () => {
    expect(tenantHasData(empty())).toBe(false)
    expect(tenantHasData(crisis())).toBe(true)
    const s = empty()
    s.counts.tenantClientFile = true
    expect(tenantHasData(s)).toBe(true)
  })

  it('ignores services, which every tenant starts with', () => {
    const s = empty()
    s.counts.services = 4
    expect(tenantHasData(s)).toBe(false)
  })
})

describe('markEach', () => {
  it('marks steps one after another and reports the ones that failed', async () => {
    const order: string[] = []
    const result = await markEach(['business', 'team', 'rates'], async step => {
      order.push(step)
      if (step === 'team') throw new Error('A send is running on this session.')
      return step
    })
    expect(order).toEqual(['business', 'team', 'rates'])
    expect(result.last).toBe('rates')
    expect(result.failed).toEqual([{ step: 'team', message: 'A send is running on this session.' }])
  })
})
