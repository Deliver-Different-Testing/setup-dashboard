import { useState } from 'react'
import { useStore } from '../../store'
import type { DistanceRateRow, RatesStep as Rates, ZoneRateRow } from '../../lib/api'
import { StepFrame } from '../StepFrame'
import { SmartImport } from '../SmartImport'
import { useDraft } from '../useDraft'
import { Btn, Card, Num, Pick, RemoveBtn, Text } from '../ui'
import { asOptions, csv, patchAt, removeAt, useLookup } from '../../lib/helpers'

const allCustomers = (codes: string[]) => codes.length === 0
  ? <span className="text-[11px] text-amber-700">Applies to every customer</span>
  : <span className="text-[11px] text-gray-400">{codes.length} customer{codes.length === 1 ? '' : 's'}</span>

export function RatesStep() {
  const reload = useStore(s => s.reload)
  const { draft, setDraft, dirty, markSaved } = useDraft<Rates>(s => s.rates)
  const speeds = useLookup('speeds')
  const depots = useLookup('depots')
  const existingVehicles = useLookup('vehicle-sizes')
  const existingZones = useLookup('zone-names')
  const [importing, setImporting] = useState<'zones' | 'rates' | null>(null)

  const set = (p: Partial<Rates>) => setDraft(d => ({ ...d, ...p }))
  const zoneNames = [...new Set([...draft.zoneGroups.flatMap(g => g.zones.map(z => z.name ?? '')), ...(existingZones.data ?? []).map(z => z.name)].filter(Boolean))]
  const vehicleNames = [...new Set([...draft.vehicleSizes.map(v => v.name ?? ''), ...(existingVehicles.data ?? []).map(v => v.name)].filter(Boolean))]
  const zoneOpts = zoneNames.map(n => ({ value: n, label: n }))

  return (
    <StepFrame step="rates" title="Rates and zones" sendsTo="Settings" draft={draft} dirty={dirty} onSaved={markSaved}
      intro={<>
        Written to Settings &gt; Rates &amp; Pricing in order: vehicle sizes, zone groups and zones, fuel surcharges, then rates.
        A rate with no customer codes is created for <b>every customer</b> - that's Settings' rule, so it's shown on each rate.
        Rate cards and spreadsheet imports are DF Admin only in Settings (see the checklist).
      </>}>
      <Card title="Vehicle sizes" right={<Btn kind="ghost" onClick={() => set({ vehicleSizes: [...draft.vehicleSizes, {}] })}>+ Vehicle size</Btn>}>
        {existingVehicles.data && existingVehicles.data.length > 0 && <p className="text-[11px] text-gray-400 mb-2">Already in Settings: {existingVehicles.data.map(v => v.name).join(', ')}</p>}
        {draft.vehicleSizes.map((v, i) => (
          <div key={i} className="grid grid-cols-6 gap-2 items-end mb-2">
            <div className="col-span-2"><Text label="Name" required value={v.name} onChange={x => set({ vehicleSizes: patchAt(draft.vehicleSizes, i, { name: x }) })} /></div>
            <Num label="Weight capacity" value={v.weightCapacity} onChange={x => set({ vehicleSizes: patchAt(draft.vehicleSizes, i, { weightCapacity: x }) })} />
            <Num label="Pallets" value={v.palletCapacity} step="1" onChange={x => set({ vehicleSizes: patchAt(draft.vehicleSizes, i, { palletCapacity: x }) })} />
            <Num label="Fuel %" hint="percent" value={v.fuelPercent} onChange={x => set({ vehicleSizes: patchAt(draft.vehicleSizes, i, { fuelPercent: x }) })} />
            <RemoveBtn onClick={() => set({ vehicleSizes: removeAt(draft.vehicleSizes, i) })} />
          </div>
        ))}
      </Card>

      <Card title="Zone groups and zones" right={<div className="flex gap-2">
        <Btn kind="ghost" disabled={dirty} title={dirty ? 'Save first' : ''} onClick={() => setImporting('zones')}>Import zips</Btn>
        <Btn kind="ghost" onClick={() => set({ zoneGroups: [...draft.zoneGroups, { zones: [] }] })}>+ Zone group</Btn>
      </div>}>
        {draft.zoneGroups.map((g, i) => (
          <div key={i} className="border border-gray-100 rounded-xl p-3 mb-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1"><Text label="Zone group" required value={g.name} onChange={x => set({ zoneGroups: patchAt(draft.zoneGroups, i, { name: x }) })} /></div>
              <Btn kind="ghost" onClick={() => set({ zoneGroups: patchAt(draft.zoneGroups, i, { zones: [...g.zones, { zips: [] }] }) })}>+ Zone</Btn>
              <RemoveBtn onClick={() => set({ zoneGroups: removeAt(draft.zoneGroups, i) })} />
            </div>
            {g.zones.map((z, j) => (
              <div key={j} className="grid grid-cols-6 gap-2 items-end mt-2">
                <Text label="Zone" required value={z.name} onChange={x => set({ zoneGroups: patchAt(draft.zoneGroups, i, { zones: patchAt(g.zones, j, { name: x }) }) })} />
                <div className="col-span-4"><Text label="Zips / post codes" hint={`comma separated · ${z.zips.length}`} value={z.zips.join(', ')}
                  onChange={x => set({ zoneGroups: patchAt(draft.zoneGroups, i, { zones: patchAt(g.zones, j, { zips: csv(x) }) }) })} /></div>
                <RemoveBtn onClick={() => set({ zoneGroups: patchAt(draft.zoneGroups, i, { zones: removeAt(g.zones, j) }) })} />
              </div>
            ))}
          </div>
        ))}
      </Card>

      <Card title="Fuel surcharges" right={<Btn kind="ghost" onClick={() => set({ fuelSurcharges: [...draft.fuelSurcharges, {}] })}>+ Fuel surcharge</Btn>}>
        {draft.fuelSurcharges.map((f, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 items-end mb-2">
            <Text label="Name" value={f.name} onChange={x => set({ fuelSurcharges: patchAt(draft.fuelSurcharges, i, { name: x }) })} />
            <Num label="Fuel %" required hint="percent" value={f.ratePercent} onChange={x => set({ fuelSurcharges: patchAt(draft.fuelSurcharges, i, { ratePercent: x }) })} />
            <Text label="Starts" required type="date" value={f.start?.slice(0, 10)} onChange={x => set({ fuelSurcharges: patchAt(draft.fuelSurcharges, i, { start: x }) })} />
            <Text label="Customer code" hint="blank = general" value={f.clientCode} onChange={x => set({ fuelSurcharges: patchAt(draft.fuelSurcharges, i, { clientCode: x }) })} />
            <RemoveBtn onClick={() => set({ fuelSurcharges: removeAt(draft.fuelSurcharges, i) })} />
          </div>
        ))}
      </Card>

      <Card title="Zone-to-zone rates" right={<div className="flex gap-2">
        <Btn kind="ghost" disabled={dirty} title={dirty ? 'Save first' : ''} onClick={() => setImporting('rates')}>Import rates</Btn>
        <Btn kind="ghost" onClick={() => set({ zoneRates: [...draft.zoneRates, { vehicleSizeNames: [], clientCodes: [] }] })}>+ Zone rate</Btn>
      </div>}>
        {draft.zoneRates.map((r, i) => (
          <ZoneRate key={i} r={r} zones={zoneOpts} vehicles={vehicleNames} speeds={asOptions(speeds.data)}
            onChange={p => set({ zoneRates: patchAt(draft.zoneRates, i, p) })} onRemove={() => set({ zoneRates: removeAt(draft.zoneRates, i) })} />
        ))}
      </Card>

      <Card title="Distance rates" right={<Btn kind="ghost" onClick={() => set({ distanceRates: [...draft.distanceRates, { vehicleSizeNames: [], depotIds: [], clientCodes: [] }] })}>+ Distance rate</Btn>}>
        {draft.distanceRates.map((r, i) => (
          <DistanceRate key={i} r={r} vehicles={vehicleNames} speeds={asOptions(speeds.data)} depots={depots.data ?? []}
            onChange={p => set({ distanceRates: patchAt(draft.distanceRates, i, p) })} onRemove={() => set({ distanceRates: removeAt(draft.distanceRates, i) })} />
        ))}
      </Card>

      {importing && <SmartImport entityType={importing} onClose={() => setImporting(null)} onComplete={() => { setImporting(null); markSaved(); reload() }} />}
    </StepFrame>
  )
}

type Opt = { value: number | string; label: string }

function ZoneRate({ r, zones, vehicles, speeds, onChange, onRemove }: {
  r: ZoneRateRow; zones: Opt[]; vehicles: string[]; speeds: Opt[]; onChange: (p: Partial<ZoneRateRow>) => void; onRemove: () => void
}) {
  return (
    <div className="grid grid-cols-8 gap-2 items-end border-t border-gray-100 pt-2 mt-2">
      <div className="col-span-2"><Text label="Name" required value={r.name} onChange={x => onChange({ name: x })} /></div>
      <Pick label="From zone" required value={r.fromZone} options={zones} onChange={x => onChange({ fromZone: x })} />
      <Pick label="To zone" required value={r.toZone} options={zones} onChange={x => onChange({ toZone: x })} />
      <Pick label="Speed" required value={r.speedId} options={speeds} onChange={x => onChange({ speedId: x })} />
      <Num label="Charge $" required value={r.chargeRate} onChange={x => onChange({ chargeRate: x })} />
      <Num label="Driver $" required value={r.driverRate} onChange={x => onChange({ driverRate: x })} />
      <RemoveBtn onClick={onRemove} />
      <div className="col-span-4"><Text label="Vehicle sizes" required hint={vehicles.length ? `e.g. ${vehicles.slice(0, 3).join(', ')}` : 'comma separated'}
        value={r.vehicleSizeNames.join(', ')} onChange={x => onChange({ vehicleSizeNames: csv(x) })} /></div>
      <div className="col-span-4"><Text label="Customer codes" hint="comma separated · blank = every customer" value={r.clientCodes.join(', ')} onChange={x => onChange({ clientCodes: csv(x) })} />
        {allCustomers(r.clientCodes)}</div>
    </div>
  )
}

function DistanceRate({ r, vehicles, speeds, depots, onChange, onRemove }: {
  r: DistanceRateRow; vehicles: string[]; speeds: Opt[]; depots: { id: number; name: string }[]; onChange: (p: Partial<DistanceRateRow>) => void; onRemove: () => void
}) {
  return (
    <div className="grid grid-cols-8 gap-2 items-end border-t border-gray-100 pt-2 mt-2">
      <div className="col-span-2"><Text label="Name" required value={r.name} onChange={x => onChange({ name: x })} /></div>
      <Pick label="Speed" required value={r.speedId} options={speeds} onChange={x => onChange({ speedId: x })} />
      <Num label="Base $" required value={r.baseCharge} onChange={x => onChange({ baseCharge: x })} />
      <Num label="Base driver $" required value={r.baseChargeDriver} onChange={x => onChange({ baseChargeDriver: x })} />
      <Num label="Per unit $" required value={r.perDistanceUnit} onChange={x => onChange({ perDistanceUnit: x })} />
      <Num label="Per unit driver $" required value={r.perDistanceUnitDriver} onChange={x => onChange({ perDistanceUnitDriver: x })} />
      <RemoveBtn onClick={onRemove} />
      <Num label="Distance included" required value={r.distanceIncluded} onChange={x => onChange({ distanceIncluded: x })} />
      <div className="col-span-3"><Text label="Vehicle sizes" required hint={vehicles.length ? `e.g. ${vehicles.slice(0, 3).join(', ')}` : 'comma separated'}
        value={r.vehicleSizeNames.join(', ')} onChange={x => onChange({ vehicleSizeNames: csv(x) })} /></div>
      <div className="col-span-4"><Text label="Customer codes" hint="blank = every customer" value={r.clientCodes.join(', ')} onChange={x => onChange({ clientCodes: csv(x) })} />
        {allCustomers(r.clientCodes)}</div>
      <div className="col-span-8 flex flex-wrap gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Depots</span>
        {depots.map(d => (
          <label key={d.id} className="text-xs flex items-center gap-1">
            <input type="checkbox" className="accent-cyan" checked={r.depotIds.includes(d.id)}
              onChange={e => onChange({ depotIds: e.target.checked ? [...r.depotIds, d.id] : r.depotIds.filter(x => x !== d.id) })} />{d.name}
          </label>
        ))}
        {depots.length === 0 && <span className="text-xs text-gray-400">No depots yet - DFRNT creates them (Business checklist).</span>}
      </div>
    </div>
  )
}
