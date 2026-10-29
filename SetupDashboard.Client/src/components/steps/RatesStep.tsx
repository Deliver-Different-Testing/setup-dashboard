import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Grid, Group, MultiSelect, Paper, SegmentedControl, Stack, Table, Text as MText, UnstyledButton, VisuallyHidden } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { useStore } from '../../store'
import type { DistanceRateRow, RatesStep as Rates, ZoneRateRow } from '../../lib/api'
import { StepFrame } from '../StepFrame'
import { SmartImport } from '../SmartImport'
import { useDraft } from '../useDraft'
import { Btn, Card, CollapseRow, Num, Pick, RemoveBtn, Suggest, Tags, Text } from '../ui'
import { asOptions, patchAt, removeAt, useLookup } from '../../lib/helpers'
import { distanceRateNeeds, fuelNeeds, rateMatrix, vehicleNeeds, zoneOptions, zoneRateNeeds } from '../../lib/rates'
import css from './RatesStep.module.css'

const Col = Grid.Col
const TOP = { borderTop: '1px solid var(--dd-outline-variant)' }

type Opt = { value: number | string; label: string }
type Section = 'vehicles' | 'zones' | 'fuel' | 'zone-rates' | 'distance-rates'

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
const money = (n?: number) => (n == null ? 'no price' : `$${n.toFixed(2)}`)
const customers = (codes: string[]) => (codes.length === 0 ? 'every customer' : codes.join(', '))
/** Inserts a copy after row i, so a rate that differs only by vehicle or speed is quick to add. */
const duplicateAt = <T extends { name?: string }>(list: T[], i: number): T[] =>
  [...list.slice(0, i + 1), { ...list[i], name: list[i].name ? `${list[i].name} (copy)` : undefined }, ...list.slice(i + 1)]

const allCustomersNote = (codes: string[]) => codes.length === 0
  ? <MText fz={11} c="var(--mantine-color-orange-text)" mt={4}>Applies to every customer</MText>
  : null

export function RatesStep() {
  const reload = useStore(s => s.reload)
  const clients = useStore(s => s.session?.clients)
  const clientCodes = (clients ?? []).map(c => c.code?.trim() ?? '').filter(Boolean)
  const { draft, setDraft, dirty, markSaved } = useDraft<Rates>(s => s.rates)
  const speeds = useLookup('speeds')
  const depots = useLookup('depots')
  const existingVehicles = useLookup('vehicle-sizes')
  const existingZones = useLookup('zone-names')
  const reduceMotion = useReducedMotion()

  const zoneNames = zoneOptions(draft.zoneGroups, (existingZones.data ?? []).map(z => z.name))
  const vehicleNames = [...new Set([...draft.vehicleSizes.map(v => v.name?.trim() ?? ''), ...(existingVehicles.data ?? []).map(v => v.name)].filter(Boolean))]
  const speedOpts = asOptions(speeds.data)
  const speedName = (id?: number) => speedOpts.find(o => o.value === id)?.label ?? 'no speed'

  const [importing, setImporting] = useState<'zones' | 'rates' | null>(null)
  const [view, setView] = useState<'matrix' | 'list'>(() => (zoneNames.length >= 2 ? 'matrix' : 'list'))
  const [openZoneRates, setOpenZoneRates] = useState<Set<number>>(new Set())
  const [openDistance, setOpenDistance] = useState<Set<number>>(new Set())
  const [undo, setUndo] = useState<{ section: Section; message: string; prev: Rates } | null>(null)

  // Scroll to a row once it has rendered open; set from click handlers only.
  const scrollTo = useRef<string | null>(null)
  useEffect(() => {
    if (!scrollTo.current) return
    document.getElementById(scrollTo.current)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    scrollTo.current = null
  })

  const set = (p: Partial<Rates>) => setDraft(d => ({ ...d, ...p }))
  /** A removal the user may want back: remember the step before it and offer Undo. */
  const undoable = (section: Section, message: string, p: Partial<Rates>) => {
    setUndo({ section, message, prev: draft })
    set(p)
    setOpenZoneRates(new Set())
    setOpenDistance(new Set())
  }
  const toggle = (setOpen: typeof setOpenZoneRates, i: number) =>
    setOpen(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })

  const showZoneRates = (indexes: number[]) => {
    setView('list')
    setOpenZoneRates(new Set(indexes))
    scrollTo.current = `zone-rate-${indexes[0]}`
  }
  const addZoneRate = (row: Partial<ZoneRateRow> = {}) => {
    set({ zoneRates: [...draft.zoneRates, { vehicleSizeNames: [], clientCodes: [], ...row }] })
    showZoneRates([draft.zoneRates.length])
  }
  const addDistanceRate = () => {
    set({ distanceRates: [...draft.distanceRates, { vehicleSizeNames: [], depotIds: [], clientCodes: [] }] })
    setOpenDistance(new Set([draft.distanceRates.length]))
    scrollTo.current = `distance-rate-${draft.distanceRates.length}`
  }

  const undoNote = (section: Section) => undo?.section === section && (
    <Alert variant="light" color="gray" mb="sm" withCloseButton onClose={() => setUndo(null)} closeButtonLabel="Dismiss">
      <Group justify="space-between" gap={8}>
        <MText size="sm">{undo.message}</MText>
        <Btn kind="ghost" onClick={() => { setDraft(undo.prev); setUndo(null) }}>Undo</Btn>
      </Group>
    </Alert>
  )

  const needs = {
    vehicles: draft.vehicleSizes.filter(v => vehicleNeeds(v).length).length,
    fuel: draft.fuelSurcharges.filter(f => fuelNeeds(f).length).length,
    zoneRates: draft.zoneRates.map(zoneRateNeeds),
    distanceRates: draft.distanceRates.map(distanceRateNeeds),
  }
  const zoneCount = draft.zoneGroups.reduce((n, g) => n + g.zones.length, 0)
  const importHint = dirty && <MText fz="xs" c="dimmed">Save your changes to import</MText>

  return (
    <StepFrame step="rates" title="Rates and zones" sendsTo="Settings" draft={draft} dirty={dirty} onSaved={() => { markSaved(); setUndo(null) }}
      intro={<>
        Sent to Settings &gt; Rates &amp; Pricing in this order: vehicle sizes, zone groups and zones, fuel surcharges, then rates.
        A rate with no customer codes applies to <b>every customer</b>. That's Settings' rule, so each rate shows it.
        Rate cards and spreadsheet imports are DF Admin only in Settings (see the checklist).
      </>}>
      <Paper p="sm">
        <Group gap="lg" wrap="wrap" component="nav" aria-label="Rates sections">
          <Jump to="vehicles" label="Vehicle sizes" count={draft.vehicleSizes.length} toFill={needs.vehicles} />
          <Jump to="zones" label="Zones" count={zoneCount} detail={draft.zoneGroups.length ? `in ${plural(draft.zoneGroups.length, 'group')}` : undefined} />
          <Jump to="fuel" label="Fuel surcharges" count={draft.fuelSurcharges.length} toFill={needs.fuel} />
          <Jump to="zone-rates" label="Zone rates" count={draft.zoneRates.length} toFill={needs.zoneRates.filter(n => n.length).length} />
          <Jump to="distance-rates" label="Distance rates" count={draft.distanceRates.length} toFill={needs.distanceRates.filter(n => n.length).length} />
        </Group>
      </Paper>

      <Card id="rates-vehicles" title="Vehicle sizes" right={<Btn kind="ghost" onClick={() => set({ vehicleSizes: [...draft.vehicleSizes, {}] })}>Add vehicle size</Btn>}>
        {existingVehicles.data && existingVehicles.data.length > 0 && <MText fz="xs" c="dimmed" mb={8}>Already in Settings: {existingVehicles.data.map(v => v.name).join(', ')}</MText>}
        {draft.vehicleSizes.length === 0 && <MText size="sm" c="dimmed">No new vehicle sizes. Add one for each vehicle you price differently, such as Car, Van or Truck.</MText>}
        {draft.vehicleSizes.map((v, i) => (
          <Grid key={i} columns={12} gutter={8} align="flex-end" mt={i > 0 ? 8 : 0} overflow="visible">
            <Col span={{ base: 10, sm: 4 }}><Text label="Name" required value={v.name} onChange={x => set({ vehicleSizes: patchAt(draft.vehicleSizes, i, { name: x }) })} /></Col>
            <Col span={{ base: 2, sm: 1 }} order={{ sm: 5 }}><Group justify="flex-end"><RemoveBtn onClick={() => set({ vehicleSizes: removeAt(draft.vehicleSizes, i) })} /></Group></Col>
            <Col span={{ base: 4, sm: 2 }} order={{ sm: 2 }}><Num label="Max weight" value={v.weightCapacity} onChange={x => set({ vehicleSizes: patchAt(draft.vehicleSizes, i, { weightCapacity: x }) })} /></Col>
            <Col span={{ base: 4, sm: 2 }} order={{ sm: 3 }}><Num label="Pallets" value={v.palletCapacity} step="1" onChange={x => set({ vehicleSizes: patchAt(draft.vehicleSizes, i, { palletCapacity: x }) })} /></Col>
            <Col span={{ base: 4, sm: 3 }} order={{ sm: 4 }}><Num label="Fuel %" value={v.fuelPercent} onChange={x => set({ vehicleSizes: patchAt(draft.vehicleSizes, i, { fuelPercent: x }) })} /></Col>
          </Grid>
        ))}
      </Card>

      <Card id="rates-zones" title="Zone groups and zones" right={<Stack gap={4} align="flex-end">
        <Group gap={8}>
          <Btn kind="ghost" disabled={dirty} onClick={() => setImporting('zones')}>Import zips</Btn>
          <Btn kind="ghost" onClick={() => set({ zoneGroups: [...draft.zoneGroups, { zones: [{ zips: [] }] }] })}>Add zone group</Btn>
        </Group>
        {importHint}
      </Stack>}>
        {undoNote('zones')}
        {draft.zoneGroups.length === 0 && <MText size="sm" c="dimmed">No zones yet. Add a zone group, such as a city, then its zones and their zips. Or import a zips spreadsheet.</MText>}
        <Stack gap="sm">
          {draft.zoneGroups.map((g, i) => {
            const zips = g.zones.reduce((n, z) => n + z.zips.length, 0)
            return (
              <Paper key={i} withBorder p="sm" radius="md" shadow="none" bg="var(--dd-surface)">
                <Group gap={8} align="flex-end" wrap="nowrap">
                  <Box style={{ flex: 1 }}><Text label="Zone group" required hint={`${plural(g.zones.length, 'zone')}, ${plural(zips, 'zip')}`}
                    value={g.name} onChange={x => set({ zoneGroups: patchAt(draft.zoneGroups, i, { name: x }) })} /></Box>
                  <Btn kind="ghost" onClick={() => set({ zoneGroups: patchAt(draft.zoneGroups, i, { zones: [...g.zones, { zips: [] }] }) })}>Add zone</Btn>
                  <RemoveBtn onClick={() => undoable('zones', `Removed zone group ${g.name || i + 1}.`, { zoneGroups: removeAt(draft.zoneGroups, i) })} />
                </Group>
                {g.zones.map((z, j) => {
                  const qualified = z.name && zoneNames.includes(`${g.name?.trim() ?? ''} / ${z.name.trim()}`)
                  return (
                    <Grid key={j} columns={12} gutter={8} align="flex-end" mt={8} pt={8} style={TOP} overflow="visible">
                      <Col span={{ base: 10, sm: 3 }}><Text label="Zone" required value={z.name}
                        hint={qualified ? `In another group too; rates use "${g.name} / ${z.name}"` : undefined}
                        onChange={x => set({ zoneGroups: patchAt(draft.zoneGroups, i, { zones: patchAt(g.zones, j, { name: x }) }) })} /></Col>
                      <Col span={{ base: 2, sm: 1 }} order={{ sm: 3 }} pb={6}><Group justify="flex-end"><RemoveBtn onClick={() => set({ zoneGroups: patchAt(draft.zoneGroups, i, { zones: removeAt(g.zones, j) }) })} /></Group></Col>
                      <Col span={{ base: 12, sm: 8 }} order={{ sm: 2 }}><Tags label={`Zips / post codes (${z.zips.length})`} value={z.zips} placeholder="Type or paste, separated by commas"
                        onChange={x => set({ zoneGroups: patchAt(draft.zoneGroups, i, { zones: patchAt(g.zones, j, { zips: x }) }) })} /></Col>
                    </Grid>
                  )
                })}
              </Paper>
            )
          })}
        </Stack>
      </Card>

      <Card id="rates-fuel" title="Fuel surcharges" right={<Btn kind="ghost" onClick={() => set({ fuelSurcharges: [...draft.fuelSurcharges, {}] })}>Add fuel surcharge</Btn>}>
        {draft.fuelSurcharges.length === 0 && <MText size="sm" c="dimmed">No fuel surcharges. Add one to apply a fuel % from a start date, to every customer or one.</MText>}
        {draft.fuelSurcharges.map((f, i) => (
          <Grid key={i} columns={12} gutter={8} align="flex-end" mt={i > 0 ? 8 : 0} pt={i > 0 ? 8 : 0} style={i > 0 ? TOP : undefined} overflow="visible">
            <Col span={{ base: 10, sm: 3 }}><Text label="Name" value={f.name} onChange={x => set({ fuelSurcharges: patchAt(draft.fuelSurcharges, i, { name: x }) })} /></Col>
            <Col span={{ base: 2, sm: 1 }} order={{ sm: 5 }}><Group justify="flex-end"><RemoveBtn onClick={() => set({ fuelSurcharges: removeAt(draft.fuelSurcharges, i) })} /></Group></Col>
            <Col span={{ base: 6, sm: 2 }} order={{ sm: 2 }}><Num label="Fuel %" required value={f.ratePercent} onChange={x => set({ fuelSurcharges: patchAt(draft.fuelSurcharges, i, { ratePercent: x }) })} /></Col>
            <Col span={{ base: 6, sm: 3 }} order={{ sm: 3 }}><Text label="Starts" required type="date" value={f.start?.slice(0, 10)} onChange={x => set({ fuelSurcharges: patchAt(draft.fuelSurcharges, i, { start: x }) })} /></Col>
            <Col span={{ base: 12, sm: 3 }} order={{ sm: 4 }}><Suggest label="Customer code" placeholder="Every customer" value={f.clientCode} options={clientCodes}
              onChange={x => set({ fuelSurcharges: patchAt(draft.fuelSurcharges, i, { clientCode: x }) })} /></Col>
          </Grid>
        ))}
      </Card>

      <Card id="rates-zone-rates" title="Zone-to-zone rates" right={<Stack gap={4} align="flex-end">
        <Group gap={8}>
          <SegmentedControl size="xs" value={view} onChange={v => setView(v as 'matrix' | 'list')} aria-label="Show zone rates as"
            data={[{ value: 'matrix', label: 'Matrix' }, { value: 'list', label: `List ${draft.zoneRates.length}` }]} />
          <Btn kind="ghost" disabled={dirty} onClick={() => setImporting('rates')}>Import rates</Btn>
          <Btn kind="ghost" onClick={() => addZoneRate()}>Add zone rate</Btn>
        </Group>
        {importHint}
      </Stack>}>
        {undoNote('zone-rates')}
        {view === 'matrix'
          ? <RateMatrix rates={draft.zoneRates} needs={needs.zoneRates} zones={zoneNames} speeds={speedOpts} vehicles={vehicleNames} customers={clientCodes}
              onAdd={addZoneRate} onOpen={showZoneRates} />
          : <>
            {draft.zoneRates.length === 0 && <MText size="sm" c="dimmed">No zone rates yet. Add one, import a rate sheet, or price lanes from the matrix.</MText>}
            {draft.zoneRates.map((r, i) => (
              <CollapseRow key={i} id={`zone-rate-${i}`} first={i === 0} open={openZoneRates.has(i)} onToggle={() => toggle(setOpenZoneRates, i)}
                missing={needs.zoneRates[i]} title={r.name || 'New zone rate'}
                detail={[`${r.fromZone} to ${r.toZone}`, speedName(r.speedId), r.vehicleSizeNames.join(' and '),
                  `charge ${money(r.chargeRate)} / driver ${money(r.driverRate)}`, customers(r.clientCodes)].join(', ')}>
                <ZoneRate r={r} zones={zoneNames} vehicles={vehicleNames} speeds={speedOpts} customers={clientCodes}
                  onChange={p => set({ zoneRates: patchAt(draft.zoneRates, i, p) })}
                  onDuplicate={() => { set({ zoneRates: duplicateAt(draft.zoneRates, i) }); showZoneRates([i + 1]) }}
                  onRemove={() => undoable('zone-rates', `Removed zone rate ${r.name || i + 1}.`, { zoneRates: removeAt(draft.zoneRates, i) })} />
              </CollapseRow>
            ))}
          </>}
      </Card>

      <Card id="rates-distance-rates" title="Distance rates" right={<Btn kind="ghost" onClick={addDistanceRate}>Add distance rate</Btn>}>
        {undoNote('distance-rates')}
        {draft.distanceRates.length === 0 && <MText size="sm" c="dimmed">No distance rates. Add one to charge a base price plus a rate per distance unit.</MText>}
        {draft.distanceRates.map((r, i) => (
          <CollapseRow key={i} id={`distance-rate-${i}`} first={i === 0} open={openDistance.has(i)} onToggle={() => toggle(setOpenDistance, i)}
            missing={needs.distanceRates[i]} title={r.name || 'New distance rate'}
            detail={[speedName(r.speedId), r.vehicleSizeNames.join(' and '),
              `base ${money(r.baseCharge)} + ${money(r.perDistanceUnit)} per unit after ${r.distanceIncluded}`, customers(r.clientCodes)].join(', ')}>
            <DistanceRate r={r} vehicles={vehicleNames} speeds={speedOpts} depots={depots.data ?? []} customers={clientCodes}
              onChange={p => set({ distanceRates: patchAt(draft.distanceRates, i, p) })}
              onDuplicate={() => { set({ distanceRates: duplicateAt(draft.distanceRates, i) }); setOpenDistance(new Set([i + 1])); scrollTo.current = `distance-rate-${i + 1}` }}
              onRemove={() => undoable('distance-rates', `Removed distance rate ${r.name || i + 1}.`, { distanceRates: removeAt(draft.distanceRates, i) })} />
          </CollapseRow>
        ))}
      </Card>

      {importing && <SmartImport entityType={importing} onClose={() => setImporting(null)} onComplete={() => { setImporting(null); markSaved(); reload() }} />}
    </StepFrame>
  )
}

function Jump({ to, label, count, toFill = 0, detail }: { to: Section; label: string; count: number; toFill?: number; detail?: string }) {
  return (
    <UnstyledButton type="button" onClick={() => document.getElementById(`rates-${to}`)?.scrollIntoView({ block: 'start' })}>
      <MText size="sm" fw={500} span>{label} </MText>
      <MText size="sm" span c="dimmed">{count}{detail ? ` ${detail}` : ''}</MText>
      {toFill > 0 && <MText size="xs" span c="var(--mantine-color-orange-text)" ml={6}>{toFill} to fill</MText>}
    </UnstyledButton>
  )
}

/** Keeps a saved value selectable even if it isn't in the current list. */
const withCurrent = (names: string[], ...current: (string | undefined)[]) =>
  [...names, ...current.filter((c): c is string => !!c && !names.includes(c))].map(n => ({ value: n, label: n }))

function RateMatrix({ rates, needs, zones, speeds, vehicles, customers, onAdd, onOpen }: {
  rates: ZoneRateRow[]; needs: string[][]; zones: string[]; speeds: Opt[]; vehicles: string[]; customers: string[]
  onAdd: (row: Partial<ZoneRateRow>) => void; onOpen: (indexes: number[]) => void
}) {
  const [picked, setPicked] = useState<{ speedId?: number; vehicle?: string; clientCode?: string }>({})
  const speedId = picked.speedId ?? (speeds[0]?.value as number | undefined)
  const vehicle = picked.vehicle ?? vehicles[0]
  const { clientCode } = picked

  if (zones.length < 2) return <MText size="sm" c="dimmed">Add at least two zones above to price the lanes between them.</MText>
  if (vehicles.length === 0) return <MText size="sm" c="dimmed">Add a vehicle size above. Each rate is for one or more vehicle sizes.</MText>

  const m = rateMatrix(rates, zones, { speedId, vehicle, clientCode })
  return (
    <Stack gap="sm">
      <Grid columns={3} gutter={8} overflow="visible">
        <Col span={{ base: 3, sm: 1 }}><Pick label="Speed" value={speedId} options={speeds} required onChange={(v: number) => setPicked(p => ({ ...p, speedId: v }))} /></Col>
        <Col span={{ base: 3, sm: 1 }}><Pick label="Vehicle size" value={vehicle} options={vehicles.map(v => ({ value: v, label: v }))} required onChange={(v: string) => setPicked(p => ({ ...p, vehicle: v }))} /></Col>
        <Col span={{ base: 3, sm: 1 }}><Pick label="Customer" value={clientCode} placeholder="Every customer" options={customers.map(c => ({ value: c, label: c }))}
          onChange={(v: string | undefined) => setPicked(p => ({ ...p, clientCode: v }))} /></Col>
      </Grid>
      <MText fz="xs" c="dimmed">Rows are where the job starts, columns where it ends. Each cell shows the customer charge over the driver rate. Choose an empty cell to add that rate.</MText>
      <Table.ScrollContainer minWidth={0} type="native">
        <table className={css.matrix}>
          <thead>
            <tr>
              <th className={css.axis} scope="col"><VisuallyHidden>From zone</VisuallyHidden></th>
              {zones.map(z => <th key={z} className={css.head} scope="col">{z}</th>)}
            </tr>
          </thead>
          <tbody>
            {zones.map(from => (
              <tr key={from}>
                <th className={css.axis} scope="row">{from}</th>
                {zones.map(to => {
                  const hits = m.get(from, to)
                  const same = from === to ? css.same : ''
                  if (hits.length === 0) return (
                    <td key={to}><UnstyledButton type="button" className={`${css.cell} ${css.empty} ${same}`} aria-label={`Add rate from ${from} to ${to}`}
                      onClick={() => onAdd({ fromZone: from, toZone: to, speedId, vehicleSizeNames: vehicle ? [vehicle] : [], clientCodes: clientCode ? [clientCode] : [] })}>+</UnstyledButton></td>
                  )
                  if (hits.length > 1) return (
                    <td key={to}><UnstyledButton type="button" className={`${css.cell} ${css.conflict}`} aria-label={`${hits.length} rates from ${from} to ${to}, show them`}
                      onClick={() => onOpen(hits)}>{hits.length} rates</UnstyledButton></td>
                  )
                  const r = rates[hits[0]]
                  return (
                    <td key={to}><UnstyledButton type="button" className={`${css.cell} ${same} ${needs[hits[0]].length ? css.incomplete : ''}`}
                      aria-label={`${r.name || 'Rate'} from ${from} to ${to}: ${money(r.chargeRate)} charge, ${money(r.driverRate)} driver. Open it`}
                      onClick={() => onOpen(hits)}>
                      <span className={css.charge}>{money(r.chargeRate)}</span>
                      <span className={css.driver}>{money(r.driverRate)}</span>
                    </UnstyledButton></td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Table.ScrollContainer>
    </Stack>
  )
}

function RowActions({ onDuplicate, onRemove, what }: { onDuplicate: () => void; onRemove: () => void; what: string }) {
  return (
    <Group gap={8} justify="flex-end" mt="sm">
      <Btn kind="ghost" onClick={onDuplicate}>Duplicate {what}</Btn>
      <Btn kind="danger" onClick={onRemove}>Remove {what}</Btn>
    </Group>
  )
}

function ZoneRate({ r, zones, vehicles, speeds, customers, onChange, onDuplicate, onRemove }: {
  r: ZoneRateRow; zones: string[]; vehicles: string[]; speeds: Opt[]; customers: string[]
  onChange: (p: Partial<ZoneRateRow>) => void; onDuplicate: () => void; onRemove: () => void
}) {
  const zoneOpts = withCurrent(zones, r.fromZone, r.toZone)
  return (
    <>
      <Grid columns={24} gutter={8} align="flex-start" overflow="visible">
        <Col span={{ base: 24, md: 6 }}><Text label="Name" required value={r.name} onChange={x => onChange({ name: x })} /></Col>
        <Col span={{ base: 12, md: 4 }}><Pick label="From zone" required value={r.fromZone} options={zoneOpts} onChange={x => onChange({ fromZone: x })} /></Col>
        <Col span={{ base: 12, md: 4 }}><Pick label="To zone" required value={r.toZone} options={zoneOpts} onChange={x => onChange({ toZone: x })} /></Col>
        <Col span={{ base: 24, sm: 8, md: 4 }}><Pick label="Speed" required value={r.speedId} options={speeds} onChange={x => onChange({ speedId: x })} /></Col>
        <Col span={{ base: 12, sm: 8, md: 3 }}><Num label="Charge $" required value={r.chargeRate} onChange={x => onChange({ chargeRate: x })} /></Col>
        <Col span={{ base: 12, sm: 8, md: 3 }}><Num label="Driver $" required value={r.driverRate} onChange={x => onChange({ driverRate: x })} /></Col>
        <Col span={{ base: 24, md: 12 }}><Tags label="Vehicle sizes" required value={r.vehicleSizeNames} options={vehicles} onChange={x => onChange({ vehicleSizeNames: x })} /></Col>
        <Col span={{ base: 24, md: 12 }}><Tags label="Customer codes" placeholder="Leave empty for every customer" value={r.clientCodes} options={customers} onChange={x => onChange({ clientCodes: x })} />
          {allCustomersNote(r.clientCodes)}</Col>
      </Grid>
      <RowActions what="rate" onDuplicate={onDuplicate} onRemove={onRemove} />
    </>
  )
}

function DistanceRate({ r, vehicles, speeds, depots, customers, onChange, onDuplicate, onRemove }: {
  r: DistanceRateRow; vehicles: string[]; speeds: Opt[]; depots: { id: number; name: string }[]; customers: string[]
  onChange: (p: Partial<DistanceRateRow>) => void; onDuplicate: () => void; onRemove: () => void
}) {
  return (
    <>
      <Grid columns={12} gutter={8} align="flex-start" overflow="visible">
        <Col span={{ base: 12, md: 4 }}><Text label="Name" required value={r.name} onChange={x => onChange({ name: x })} /></Col>
        <Col span={{ base: 12, sm: 6, md: 4 }}><Pick label="Speed" required value={r.speedId} options={speeds} onChange={x => onChange({ speedId: x })} /></Col>
        <Col span={{ base: 12, sm: 6, md: 4 }}><Num label="Distance included" required value={r.distanceIncluded} onChange={x => onChange({ distanceIncluded: x })} /></Col>
        <Col span={{ base: 6, md: 3 }}><Num label="Base $" required value={r.baseCharge} onChange={x => onChange({ baseCharge: x })} /></Col>
        <Col span={{ base: 6, md: 3 }}><Num label="Base driver $" required value={r.baseChargeDriver} onChange={x => onChange({ baseChargeDriver: x })} /></Col>
        <Col span={{ base: 6, md: 3 }}><Num label="Per unit $" required value={r.perDistanceUnit} onChange={x => onChange({ perDistanceUnit: x })} /></Col>
        <Col span={{ base: 6, md: 3 }}><Num label="Per unit driver $" required value={r.perDistanceUnitDriver} onChange={x => onChange({ perDistanceUnitDriver: x })} /></Col>
        <Col span={{ base: 12, md: 6 }}><Tags label="Vehicle sizes" required value={r.vehicleSizeNames} options={vehicles} onChange={x => onChange({ vehicleSizeNames: x })} /></Col>
        <Col span={{ base: 12, md: 6 }}><Tags label="Customer codes" placeholder="Leave empty for every customer" value={r.clientCodes} options={customers} onChange={x => onChange({ clientCodes: x })} />
          {allCustomersNote(r.clientCodes)}</Col>
        <Col span={12}>
          <MultiSelect label="Depots" size="sm" data={depots.map(d => ({ value: String(d.id), label: d.name }))} value={r.depotIds.map(String)}
            disabled={depots.length === 0} placeholder={depots.length === 0 ? undefined : 'Choose depots'}
            description={depots.length === 0 ? 'No depots yet. DFRNT creates them (see the Business checklist).' : undefined}
            onChange={v => onChange({ depotIds: v.map(Number) })} />
        </Col>
      </Grid>
      <RowActions what="rate" onDuplicate={onDuplicate} onRemove={onRemove} />
    </>
  )
}
