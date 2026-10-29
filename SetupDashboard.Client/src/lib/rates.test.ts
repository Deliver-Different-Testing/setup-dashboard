import { describe, expect, it } from 'vitest'
import type { DistanceRateRow, ZoneGroupRow, ZoneRateRow } from './api'
import { distanceRateNeeds, fuelNeeds, rateMatrix, vehicleNeeds, zoneOptions, zoneRateNeeds } from './rates'

const lane = (p: Partial<ZoneRateRow> = {}): ZoneRateRow => ({
  name: 'CBD to North', fromZone: 'CBD', toZone: 'North', speedId: 1, vehicleSizeNames: ['Van'],
  chargeRate: 12, driverRate: 8, clientCodes: [], ...p,
})

describe('zoneRateNeeds', () => {
  it('is empty for a rate Settings will accept', () => {
    expect(zoneRateNeeds(lane())).toEqual([])
  })

  it('names every missing field in the order the server checks them', () => {
    expect(zoneRateNeeds({ vehicleSizeNames: [], clientCodes: [] })).toEqual([
      'name', 'from zone', 'to zone', 'speed', 'at least one vehicle size', 'customer charge', 'driver rate',
    ])
  })

  it('accepts a zero charge', () => {
    expect(zoneRateNeeds(lane({ chargeRate: 0, driverRate: 0 }))).toEqual([])
  })

  it('treats whitespace as empty', () => {
    expect(zoneRateNeeds(lane({ name: '  ' }))).toEqual(['name'])
  })
})

describe('distanceRateNeeds', () => {
  it('names every missing field in the order the server checks them', () => {
    const r: DistanceRateRow = { vehicleSizeNames: [], depotIds: [], clientCodes: [] }
    expect(distanceRateNeeds(r)).toEqual([
      'name', 'speed', 'at least one vehicle size', 'base charge', 'base charge (driver)',
      'per distance unit', 'per distance unit (driver)', 'distance included',
    ])
  })
})

describe('fuelNeeds and vehicleNeeds', () => {
  it('needs a fuel % and start date', () => {
    expect(fuelNeeds({})).toEqual(['fuel %', 'start date'])
    expect(fuelNeeds({ ratePercent: 0, start: '2026-11-01' })).toEqual([])
  })

  it('needs a vehicle name', () => {
    expect(vehicleNeeds({})).toEqual(['name'])
    expect(vehicleNeeds({ name: 'Van' })).toEqual([])
  })
})

describe('zoneOptions', () => {
  const groups: ZoneGroupRow[] = [
    { name: 'Auckland', zones: [{ name: 'CBD', zips: [] }, { name: 'North', zips: [] }] },
    { name: 'Wellington', zones: [{ name: 'CBD', zips: [] }, { name: '', zips: [] }] },
  ]

  it('names a zone in more than one group with its group', () => {
    expect(zoneOptions(groups, [])).toEqual(['Auckland / CBD', 'North', 'Wellington / CBD'])
  })

  it('adds zones already in Settings without repeating ones in the draft', () => {
    expect(zoneOptions([groups[0]], ['north', 'Airport'])).toEqual(['CBD', 'North', 'Airport'])
  })
})

describe('rateMatrix', () => {
  const zones = ['CBD', 'North']
  const scope = { speedId: 1, vehicle: 'Van', clientCode: undefined as string | undefined }

  it('places each rate in its from and to cell', () => {
    const m = rateMatrix([lane(), lane({ fromZone: 'North', toZone: 'CBD' })], zones, scope)
    expect(m.get('CBD', 'North')).toEqual([0])
    expect(m.get('North', 'CBD')).toEqual([1])
    expect(m.get('CBD', 'CBD')).toEqual([])
  })

  it('only counts rates for the chosen speed and vehicle', () => {
    const rates = [lane({ speedId: 2 }), lane({ vehicleSizeNames: ['Truck'] }), lane({ vehicleSizeNames: ['Truck', 'van'] })]
    expect(rateMatrix(rates, zones, scope).get('CBD', 'North')).toEqual([2])
  })

  it('treats a rate with no customers as applying to every customer', () => {
    const rates = [lane(), lane({ clientCodes: ['ACME'] })]
    expect(rateMatrix(rates, zones, scope).get('CBD', 'North')).toEqual([0])
    expect(rateMatrix(rates, zones, { ...scope, clientCode: 'acme' }).get('CBD', 'North')).toEqual([1])
  })

  it('shows every rate in a cell so duplicates are visible', () => {
    expect(rateMatrix([lane(), lane()], zones, scope).get('CBD', 'North')).toEqual([0, 1])
  })

  it('matches zone names whatever their case or group prefix', () => {
    const m = rateMatrix([lane({ fromZone: 'cbd', toZone: 'Auckland / North' })], zones, scope)
    expect(m.get('CBD', 'North')).toEqual([0])
  })

  it('keeps a group prefix when the axis needs it', () => {
    const m = rateMatrix([lane({ fromZone: 'Auckland / CBD' })], ['Auckland / CBD', 'Wellington / CBD', 'North'], scope)
    expect(m.get('Auckland / CBD', 'North')).toEqual([0])
    expect(m.get('Wellington / CBD', 'North')).toEqual([])
  })
})
