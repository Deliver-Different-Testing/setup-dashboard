import { useState } from 'react'
import { Grid, Group, Stack } from '@mantine/core'
import { useStore } from '../../store'
import type { CourierRow, CouriersStep as Couriers } from '../../lib/api'
import { StepFrame } from '../StepFrame'
import { SmartImport } from '../SmartImport'
import { useDraft } from '../useDraft'
import { Btn, Card, Pick, RemoveBtn, Text } from '../ui'
import { asOptions, patchAt, removeAt, useLookup } from '../../lib/helpers'

const Col = Grid.Col
const TOP = { borderTop: '1px solid var(--dd-outline-variant)' }

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
          <Grid key={i} columns={5} gutter={8} align="flex-end" mb={8} overflow="visible">
            <Col span={2}><Text label="Fleet name" required value={f.name} onChange={v => set({ fleets: patchAt(draft.fleets, i, { name: v }) })} /></Col>
            <Col span={2}><Pick label="Depot" value={f.depotId} options={asOptions(depots.data)} loading={depots.loading} onChange={v => set({ fleets: patchAt(draft.fleets, i, { depotId: v }) })} /></Col>
            <Col span={1}><RemoveBtn onClick={() => set({ fleets: removeAt(draft.fleets, i) })} /></Col>
          </Grid>
        ))}
      </Card>

      <Card title={`Couriers (${draft.couriers.length})`} right={<Group gap={8}>
        <Btn kind="ghost" disabled={dirty} title={dirty ? 'Save first' : ''} onClick={() => setImporting(true)}>Import file</Btn>
        <Btn kind="ghost" onClick={() => set({ couriers: [...draft.couriers, {}] })}>+ Courier</Btn>
      </Group>}>
        <Stack gap={8}>
          {draft.couriers.map((c, i) => (
            <Grid key={i} columns={8} gutter={8} align="flex-end" pt={8} style={TOP} overflow="visible">
              <Col span={1}><Text label="First name" required value={c.firstName} onChange={v => patchCourier(i, { firstName: v })} /></Col>
              <Col span={1}><Text label="Surname" required value={c.surName} onChange={v => patchCourier(i, { surName: v })} /></Col>
              <Col span={2}><Text label="Email (app login)" required type="email" value={c.email} onChange={v => patchCourier(i, { email: v })} /></Col>
              <Col span={1}><Text label="Initial password" required={!c.hasInitialPassword} type="password" autoComplete="new-password"
                hint={c.hasInitialPassword ? 'set' : '8+'} value={c.initialPassword}
                onChange={v => patchCourier(i, { initialPassword: v })} /></Col>
              <Col span={1}><Text label="Code" hint="blank = next number" value={c.code} onChange={v => patchCourier(i, { code: v })} /></Col>
              <Col span={1}><Pick label="Type" value={c.courierTypeId} options={TYPES} placeholder="Master (default)" onChange={v => patchCourier(i, { courierTypeId: v })} /></Col>
              <Col span={1}><RemoveBtn onClick={() => set({ couriers: removeAt(draft.couriers, i) })} /></Col>
              <Col span={1}><Text label="Mobile" value={c.mobile} onChange={v => patchCourier(i, { mobile: v })} /></Col>
              <Col span={1}><Text label="Vehicle" value={c.vehicleType} onChange={v => patchCourier(i, { vehicleType: v })} /></Col>
              <Col span={2}><Pick label="Fleet" value={c.fleetName} options={draft.fleets.filter(f => f.name).map(f => ({ value: f.name!, label: f.name! }))}
                placeholder="Assign later in Driver List" onChange={v => patchCourier(i, { fleetName: v })} /></Col>
            </Grid>
          ))}
        </Stack>
      </Card>
      {importing && <SmartImport entityType="drivers" onClose={() => setImporting(false)} onComplete={() => { setImporting(false); markSaved(); reload() }} />}
    </StepFrame>
  )
}
