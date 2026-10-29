import type { ClientRow } from './api'

// Customer-step rules. clientNeeds mirrors ClientsPusher.Validate on the API, so a row shows
// what Settings will reject before it is sent rather than after.

const blank = (v: string | undefined) => !v?.trim()

export function clientNeeds(c: ClientRow, usTenant: boolean): string[] {
  const p = c.primaryContact
  const needs: [boolean, string][] = [
    [blank(c.code), 'client code'],
    [blank(c.name), 'name'],
    [blank(c.address), 'street address'],
    [blank(c.suburb), usTenant ? 'city' : 'suburb'],
    [blank(c.city), usTenant ? 'state' : 'city'],
    [c.invoiceScheduleId == null, 'invoice schedule'],
    [c.paymentTermId == null, 'payment term'],
    [blank(p.firstName), 'primary contact first name'],
    [blank(p.email), 'primary contact email'],
    [!c.inviteConfirmed, 'invite tick'],
    ...c.contacts.flatMap((ct, j): [boolean, string][] => [
      [blank(ct.firstName) && blank(ct.surname), `contact ${j + 1} first name or surname`],
      [blank(ct.email), `contact ${j + 1} email`],
    ]),
  ]
  return needs.filter(([missing]) => missing).map(([, label]) => label)
}

export type ApplyMode = 'blanks' | 'all'
type Applicable = Partial<Pick<ClientRow, 'invoiceScheduleId' | 'paymentTermId' | 'inviteConfirmed'>>

/**
 * Sets values on every customer; 'blanks' leaves rows that already have one. An undefined value
 * means "not chosen" and never clears a row. `changed` counts rows that differ.
 */
export function applyToAll(rows: ClientRow[], patch: Applicable, mode: ApplyMode): { rows: ClientRow[]; changed: number } {
  const entries = (Object.entries(patch) as [keyof Applicable, never][]).filter(([, v]) => v != null)
  let changed = 0
  const next = rows.map(r => {
    const out = { ...r }
    for (const [k, v] of entries) {
      const isBlank = r[k] == null || r[k] === false
      if (mode === 'all' || isBlank) out[k] = v
    }
    if (entries.some(([k]) => out[k] !== r[k])) changed++
    return out
  })
  return { rows: next, changed }
}

export function clientMatches(c: ClientRow, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return [c.code, c.name, c.primaryContact.email, ...c.contacts.map(ct => ct.email)]
    .some(v => v?.toLowerCase().includes(q))
}
