import type { DayWindowRow, ScheduleRow } from '../../lib/api'
import { StepFrame } from '../StepFrame'
import { useDraft } from '../useDraft'
import { Btn, Card, Pick, RemoveBtn, Text } from '../ui'
import { asOptions, csv, patchAt, removeAt, useLookup } from '../../lib/helpers'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const ORIGINS = [
  { value: 'depot', label: 'Depot (pickup at a depot)' },
  { value: 'client', label: "Client address (pickup at the customer's address)" },
  { value: 'direct', label: 'Direct (no pickup leg)' },
]

export function SchedulesStep() {
  const { draft, setDraft, dirty, markSaved } = useDraft<ScheduleRow[]>(s => s.schedules)
  // Depots (tblBulkRegion) and speeds (tucJobType) are the same tables Routed Ops reads.
  const depots = useLookup('depots')
  const speeds = useLookup('speeds')
  const depotOpts = asOptions(depots.data)
  const patch = (i: number, p: Partial<ScheduleRow>) => setDraft(d => patchAt(d, i, p))

  return (
    <StepFrame step="schedules" title="Schedules" sendsTo="Routed Operations" draft={draft} dirty={dirty} onSaved={markSaved}
      intro={<>
        Created in Routed Operations &gt; Schedules (NEW). Each needs a destination depot and at least one day window. A schedule with no
        customer codes is the <b>default for every customer</b>; client-address schedules can't be the default, so they need customers and
        an origin depot. Depots themselves are created by DFRNT for now.
      </>}>
      <Card title={`Schedules (${draft.length})`} right={<Btn kind="ghost" onClick={() => setDraft(d => [...d, { dayWindows: [], clientCodes: [] }])}>+ Schedule</Btn>}>
        {depots.data && depots.data.length === 0 && <p className="text-xs text-warn mb-2">This tenant has no depots yet - schedules can't be created until DFRNT adds them.</p>}
        <div className="space-y-4">
          {draft.map((s, i) => (
            <div key={i} className="border border-line rounded-xl p-3">
              <div className="grid grid-cols-6 gap-2 items-end">
                <div className="col-span-2"><Text label="Name" required value={s.name} onChange={v => patch(i, { name: v })} /></div>
                <Pick label="Destination depot" required value={s.regionId} options={depotOpts} loading={depots.loading} onChange={v => patch(i, { regionId: v })} />
                <div className="col-span-2"><Pick label="Origin" required value={s.originType} options={ORIGINS} onChange={v => patch(i, { originType: v })} /></div>
                <RemoveBtn onClick={() => setDraft(d => removeAt(d, i))} />
                {s.originType === 'depot' && <Pick label="Pickup depot" required value={s.pickupDepotId} options={depotOpts} onChange={v => patch(i, { pickupDepotId: v })} />}
                {s.originType === 'client' && <Pick label="Origin depot" required value={s.originRegionId} options={depotOpts} onChange={v => patch(i, { originRegionId: v })} />}
                <Pick label="Speed" value={s.speedId} options={asOptions(speeds.data)} loading={speeds.loading} onChange={v => patch(i, { speedId: v })} />
                <div className="col-span-3"><Text label="Customer codes" hint={s.originType === 'client' ? 'required for client address' : 'blank = default for every customer'}
                  required={s.originType === 'client'} value={s.clientCodes.join(', ')} onChange={v => patch(i, { clientCodes: csv(v) })} /></div>
              </div>
              <DayWindows windows={s.dayWindows} onChange={w => patch(i, { dayWindows: w })} />
            </div>
          ))}
        </div>
      </Card>
    </StepFrame>
  )
}

function DayWindows({ windows, onChange }: { windows: DayWindowRow[]; onChange: (w: DayWindowRow[]) => void }) {
  const byDay = (d: number) => windows.find(w => w.dayOfWeek === d)
  const setDay = (d: number, p: Partial<DayWindowRow> | null) => {
    const rest = windows.filter(w => w.dayOfWeek !== d)
    onChange(p === null ? rest : [...rest, { ...(byDay(d) ?? { dayOfWeek: d }), ...p }].sort((a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0)))
  }
  return (
    <div className="mt-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-dimmed">Day windows<span className="text-danger ml-0.5">*</span></span>
      <div className="grid grid-cols-7 gap-2 mt-1">
        {DAYS.map((name, idx) => {
          const d = idx + 1
          const w = byDay(d)
          return (
            <div key={d} className={`rounded-lg border p-2 ${w ? 'border-brand/50 bg-brand/5' : 'border-line'}`}>
              <label className="flex items-center gap-1 text-xs font-semibold text-ink">
                <input type="checkbox" className="accent-brand" checked={!!w} onChange={e => setDay(d, e.target.checked ? {} : null)} />{name}
              </label>
              {w && (
                <div className="space-y-1 mt-1">
                  <input type="time" value={w.startTime ?? ''} onChange={e => setDay(d, { startTime: e.target.value || undefined })} className="w-full text-xs border rounded px-1 py-0.5" title="Start" />
                  <input type="time" value={w.endTime ?? ''} onChange={e => setDay(d, { endTime: e.target.value || undefined })} className="w-full text-xs border rounded px-1 py-0.5" title="End" />
                  <input type="time" value={w.cutoffTime ?? ''} onChange={e => setDay(d, { cutoffTime: e.target.value || undefined })} className="w-full text-xs border rounded px-1 py-0.5 text-dimmed" title="Booking cutoff (optional)" />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-dimmed mt-1">Start, end, and an optional booking cutoff per day.</p>
    </div>
  )
}
