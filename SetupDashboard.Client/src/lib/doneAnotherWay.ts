import type { Me, StepState } from './api'

// A step whose work was done outside the dashboard (Settings, Admin Manager, Claude) is marked
// done with a method and a note. Mirrors StepCatalog.CompleteElsewhere / ElsewhereProblem.

export const ALREADY_IN_DFRNT = 'Already in DFRNT'

export const METHODS = [
  'Directly in Settings / Admin Manager',
  'Loaded by Claude or the MCP',
  'By DFRNT before this dashboard',
  ALREADY_IN_DFRNT,
  'Not needed for this tenant',
  'Other',
] as const

export const NOTE_MIN = 3
export const NOTE_MAX = 500

export function noteProblem(note: string): string | null {
  const n = note.trim().length
  return n < NOTE_MIN || n > NOTE_MAX ? `Add a note of ${NOTE_MIN} to ${NOTE_MAX} characters saying how it was done.` : null
}

/** DF Admin, or tenant staff whose role has Edit Settings. The server checks again. */
export const canMarkElsewhere = (me: Me | null) => me?.isDfAdmin === true || me?.isTenantAdmin === true

export const isElsewhere = (st: StepState) => st.status === 'done' && st.completedHow === 'elsewhere'

export function doneLine(st: StepState, date: (iso: string) => string = d => new Date(d).toLocaleDateString()) {
  const by = st.completedBy ? ` by ${st.completedBy}` : ''
  const on = st.completedAt ? ` on ${date(st.completedAt)}` : ''
  if (!isElsewhere(st)) return `Marked as done${by}${on}.`
  const note = st.completedNote ? ` ${st.completedNote}` : ''
  return `Done another way${by}${on}: ${st.completedMethod ?? 'Other'}.${note}`
}
