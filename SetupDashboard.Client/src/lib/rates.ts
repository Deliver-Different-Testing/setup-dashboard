import type { DistanceRateRow, FuelSurchargeRow, VehicleSizeRow, ZoneGroupRow, ZoneRateRow } from './api'

// Rates-step rules. The needs functions mirror RatesPusher.Validate on the API, so a row shows
// what Settings will reject before it is sent rather than after.

const blank = (v: string | undefined) => !v?.trim()
const list = (needs: [boolean, string][]) => needs.filter(([missing]) => missing).map(([, label]) => label)

export const vehicleNeeds = (v: VehicleSizeRow) => list([[blank(v.name), 'name']])

export const fuelNeeds = (f: FuelSurchargeRow) => list([[f.ratePercent == null, 'fuel %'], [blank(f.start), 'start date']])

export const zoneRateNeeds = (r: ZoneRateRow) => list([
  [blank(r.name), 'name'],
  [blank(r.fromZone), 'from zone'],
  [blank(r.toZone), 'to zone'],
  [r.speedId == null, 'speed'],
  [r.vehicleSizeNames.length === 0, 'at least one vehicle size'],
  [r.chargeRate == null, 'customer charge'],
  [r.driverRate == null, 'driver rate'],
])

export const distanceRateNeeds = (r: DistanceRateRow) => list([
  [blank(r.name), 'name'],
  [r.speedId == null, 'speed'],
  [r.vehicleSizeNames.length === 0, 'at least one vehicle size'],
  [r.baseCharge == null, 'base charge'],
  [r.baseChargeDriver == null, 'base charge (driver)'],
  [r.perDistanceUnit == null, 'per distance unit'],
  [r.perDistanceUnitDriver == null, 'per distance unit (driver)'],
  [r.distanceIncluded == null, 'distance included'],
])

const key = (v: string) => v.trim().toLowerCase()

/**
 * The names a rate can use for its zones. A name in more than one group is given as
 * "Group / Zone", the form the server needs to tell them apart.
 */
export function zoneOptions(groups: ZoneGroupRow[], existing: string[]): string[] {
  const named = groups.flatMap(g => g.zones.filter(z => !blank(z.name)).map(z => ({ group: g.name?.trim() ?? '', zone: z.name!.trim() })))
  const count = new Map<string, number>()
  for (const n of named) count.set(key(n.zone), (count.get(key(n.zone)) ?? 0) + 1)
  const out: string[] = []
  const seen = new Set<string>()
  const add = (v: string) => { if (!seen.has(key(v))) { seen.add(key(v)); out.push(v) } }
  for (const n of named) add(count.get(key(n.zone))! > 1 ? `${n.group} / ${n.zone}` : n.zone)
  for (const e of existing) if (!blank(e)) add(e.trim())
  return out
}

export type MatrixScope = { speedId?: number; vehicle?: string; clientCode?: string }

/**
 * Zone-to-zone rates laid out from × to for one speed, vehicle and customer. A rate with no
 * customer codes applies to every customer. A cell with more than one rate is a duplicate.
 */
export function rateMatrix(rates: ZoneRateRow[], zones: string[], scope: MatrixScope) {
  const axis = new Map(zones.map(z => [key(z), z]))
  // A rate may name a zone with or without its group; use whichever the axis has.
  const place = (name: string | undefined) => {
    if (blank(name)) return undefined
    const exact = axis.get(key(name!))
    if (exact) return exact
    const bare = name!.split(' / ').pop()!
    return axis.get(key(bare))
  }
  const cells = new Map<string, number[]>()
  rates.forEach((r, i) => {
    if (r.speedId !== scope.speedId) return
    if (!scope.vehicle || !r.vehicleSizeNames.some(v => key(v) === key(scope.vehicle!))) return
    const forCustomer = scope.clientCode
      ? r.clientCodes.some(c => key(c) === key(scope.clientCode!))
      : r.clientCodes.length === 0
    if (!forCustomer) return
    const from = place(r.fromZone), to = place(r.toZone)
    if (!from || !to) return
    const k = `${from}\n${to}`
    cells.set(k, [...(cells.get(k) ?? []), i])
  })
  return { get: (from: string, to: string) => cells.get(`${from}\n${to}`) ?? [] }
}
