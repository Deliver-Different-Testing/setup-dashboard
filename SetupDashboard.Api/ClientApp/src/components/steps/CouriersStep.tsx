import { useState } from 'react'
import { useStore } from '../../store'
import type { CourierRow, CouriersStep as Couriers } from '../../lib/api'
import { StepFrame } from '../StepFrame'
import { SmartImport } from '../SmartImport'
import { useDraft } from '../useDraft'
import { Btn, Card, Pick, RemoveBtn, Text } from '../ui'
import { asOptions, patchAt, removeAt, useLookup } from '../../lib/helpers'

const TYPES = [{ value: 2, label: 'Master' }, { value: 1, label: 'Independent' }, { value: 4, label: 'Gig' }]

export function CouriersStep() {
  const reload = useStore(s => s.reload)
  const { draft, setDraft, dirty, markSaved } = useDraft<Couriers>(s => s.couriers)
  const depots = useLookup('depots')
  const [importing, setImporting] = useState(false)
  const set = (p: Partial<Couriers>) => setDraft(d => ({ ...d, ...p }))
  const patchCourier = (i: number, p: Partial<CourierRow>) => set({ couriers: patchAt(draft.couriers, i, p) })

  return (
    <StepFrame step="couriers" title="Couriers and fleets" sendsTo="Settings" draft={draft} dirty={dirty} onSaved={markSaved}
      intro={<>
        Vehicle fleets and couriers are created in Settings &gt; Driver List. Each courier gets a driver-app login with the initial password
        you type here (Settings requires one). The password is sent once and then forgotten by this dashboard - it is never shown again.
        No email is sent to couriers.
      </>}>
      <Card title="Vehicle fleets" right={<Btn kind="ghost" onClick={() => set({ fleets: [...draft.fleets, {}] })}>+ Fleet</Btn>}>
        {draft.fleets.map((f, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 items-end mb-2">
            <div className="col-span-2"><Text label="Fleet name" required value={f.name} onChange={v => set({ fleets: patchAt(draft.fleets, i, { name: v }) })} /></div>
            <div className="col-span-2"><Pick label="Depot" value={f.depotId} options={asOptions(depots.data)} loading={depots.loading} onChange={v => set({ fleets: patchAt(draft.fleets, i, { depotId: v }) })} /></div>
            <RemoveBtn onClick={() => set({ fleets: removeAt(draft.fleets, i) })} />
          </div>
        ))}
      </Card>

      <Card title={`Couriers (${draft.couriers.length})`} right={<div className="flex gap-2">
        <Btn kind="ghost" disabled={dirty} title={dirty ? 'Save first' : ''} onClick={() => setImporting(true)}>Import file</Btn>
        <Btn kind="ghost" onClick={() => set({ couriers: [...draft.couriers, {}] })}>+ Courier</Btn>
      </div>}>
        <div className="space-y-2">
          {draft.couriers.map((c, i) => (
            <div key={i} className="grid grid-cols-8 gap-2 items-end border-t border-line pt-2">
              <Text label="First name" required value={c.firstName} onChange={v => patchCourier(i, { firstName: v })} />
              <Text label="Surname" required value={c.surName} onChange={v => patchCourier(i, { surName: v })} />
              <div className="col-span-2"><Text label="Email (app login)" required type="email" value={c.email} onChange={v => patchCourier(i, { email: v })} /></div>
              <Text label="Initial password" required={!c.hasInitialPassword} type="password" autoComplete="new-password"
                hint={c.hasInitialPassword ? 'set' : '8+'} value={c.initialPassword}
                onChange={v => patchCourier(i, { initialPassword: v })} />
              <Text label="Code" hint="blank = next number" value={c.code} onChange={v => patchCourier(i, { code: v })} />
              <Pick label="Type" value={c.courierTypeId} options={TYPES} placeholder="Master (default)" onChange={v => patchCourier(i, { courierTypeId: v })} />
              <RemoveBtn onClick={() => set({ couriers: removeAt(draft.couriers, i) })} />
              <Text label="Mobile" value={c.mobile} onChange={v => patchCourier(i, { mobile: v })} />
              <Text label="Vehicle" value={c.vehicleType} onChange={v => patchCourier(i, { vehicleType: v })} />
              <div className="col-span-2"><Pick label="Fleet" value={c.fleetName} options={draft.fleets.filter(f => f.name).map(f => ({ value: f.name!, label: f.name! }))}
                placeholder="Assign later in Driver List" onChange={v => patchCourier(i, { fleetName: v })} /></div>
            </div>
          ))}
        </div>
      </Card>
      {importing && <SmartImport entityType="drivers" onClose={() => setImporting(false)} onComplete={() => { setImporting(false); markSaved(); reload() }} />}
    </StepFrame>
  )
}
