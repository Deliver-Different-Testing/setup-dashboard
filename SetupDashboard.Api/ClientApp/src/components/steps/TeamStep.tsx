import { useState } from 'react'
import { useStore } from '../../store'
import type { PersonRow, RoleRow, TeamStep as Team } from '../../lib/api'
import { StepFrame } from '../StepFrame'
import { SmartImport } from '../SmartImport'
import { useDraft } from '../useDraft'
import { Btn, Card, Check, Pick, RemoveBtn, Text } from '../ui'
import { patchAt, removeAt, useLookup } from '../../lib/helpers'

interface Tile { featureKey: string; displayName: string; condition?: string | null }

const newRole = (): RoleRow => ({ tiles: [] })
const newPerson = (): PersonRow => ({ inviteConfirmed: false })

export function TeamStep() {
  const reload = useStore(s => s.reload)
  const { draft, setDraft, dirty, markSaved } = useDraft<Team>(s => s.team)
  const tiles = useLookup<Tile[]>('tiles')
  const [importing, setImporting] = useState(false)

  const setRoles = (roles: RoleRow[]) => setDraft(d => ({ ...d, roles }))
  const setPeople = (people: PersonRow[]) => setDraft(d => ({ ...d, people }))
  const roleOptions = draft.roles.filter(r => r.name?.trim()).map(r => ({ value: r.name!.trim(), label: r.name!.trim() }))

  return (
    <StepFrame step="team" title="Team, roles and access" sendsTo="Settings" draft={draft} dirty={dirty} onSaved={markSaved}
      intro={<>
        Roles are created in Settings tagged <b>Tenant Staff</b> and start with every tile off; the tiles ticked here are switched on in
        Access Control. People are added to the tenant's own client file with their role - Settings creates their login and
        <b> emails them a sign-in invite</b>. No staff file is created.
      </>}>
      <Card title="Roles" right={<Btn kind="ghost" onClick={() => setRoles([...draft.roles, newRole()])}>+ Role</Btn>}>
        {draft.roles.length === 0 && <p className="text-xs text-dimmed">Usually a tenant admin and an operations role.</p>}
        <div className="space-y-4">
          {draft.roles.map((r, i) => (
            <div key={i} className="border border-line rounded-xl p-3">
              <div className="flex gap-3 items-end">
                <div className="flex-1"><Text label="Role name" required value={r.name} onChange={v => setRoles(patchAt(draft.roles, i, { name: v }))} placeholder="e.g. Tenant Admin" /></div>
                <div className="flex-1"><Text label="Description" value={r.description} onChange={v => setRoles(patchAt(draft.roles, i, { description: v }))} /></div>
                <RemoveBtn onClick={() => setRoles(removeAt(draft.roles, i))} />
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-dimmed">Tiles this role can open</span>
                {tiles.loading && <p className="text-xs text-dimmed">Loading tiles from Access Control…</p>}
                {tiles.error && <p className="text-xs text-danger">{tiles.error}</p>}
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  {(tiles.data ?? []).map(t => {
                    const on = r.tiles.includes(t.featureKey)
                    return (
                      <Check key={t.featureKey} checked={on}
                        label={<>{t.displayName}{t.condition && <span className="text-dimmed"> ({t.condition})</span>}</>}
                        onChange={v => setRoles(patchAt(draft.roles, i, { tiles: v ? [...r.tiles, t.featureKey] : r.tiles.filter(x => x !== t.featureKey) }))} />
                    )
                  })}
                </div>
                <p className="text-[11px] text-dimmed mt-1">
                  Role actions (View Financial Data, Manage Users, Edit Settings…) follow their tile. DFRNT switches any off in Settings &gt; Roles.
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="People" right={<div className="flex gap-2">
        <Btn kind="ghost" disabled={dirty} title={dirty ? 'Save first' : ''} onClick={() => setImporting(true)}>Import file</Btn>
        <Btn kind="ghost" onClick={() => setPeople([...draft.people, newPerson()])}>+ Person</Btn>
      </div>}>
        {draft.people.length === 0 && <p className="text-xs text-dimmed">Staff who will sign in to DFRNT.</p>}
        <div className="space-y-3">
          {draft.people.map((p, i) => (
            <div key={i} className="grid grid-cols-6 gap-2 items-end border-t border-line pt-3">
              <Text label="Email" required type="email" value={p.email} onChange={v => setPeople(patchAt(draft.people, i, { email: v }))} />
              <Text label="First name" required value={p.firstName} onChange={v => setPeople(patchAt(draft.people, i, { firstName: v }))} />
              <Text label="Last name" value={p.lastName} onChange={v => setPeople(patchAt(draft.people, i, { lastName: v }))} />
              <Text label="Job title" value={p.jobTitle} onChange={v => setPeople(patchAt(draft.people, i, { jobTitle: v }))} />
              <Pick label="Role" required value={p.roleName} options={roleOptions} onChange={v => setPeople(patchAt(draft.people, i, { roleName: v }))} />
              <div className="flex items-center gap-2">
                <Text label="Mobile" value={p.mobile} onChange={v => setPeople(patchAt(draft.people, i, { mobile: v }))} />
                <RemoveBtn onClick={() => setPeople(removeAt(draft.people, i))} />
              </div>
              <div className="col-span-6">
                <Check warn checked={p.inviteConfirmed} onChange={v => setPeople(patchAt(draft.people, i, { inviteConfirmed: v }))}
                  label={<>Send {p.email || 'them'} a sign-in invite now. <span className="text-dimmed">Adding a person always emails them; they aren't sent until this is ticked.</span></>} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {importing && <SmartImport entityType="team" onClose={() => setImporting(false)} onComplete={() => { setImporting(false); markSaved(); reload() }} />}
    </StepFrame>
  )
}
