import { describe, expect, it } from 'vitest'
import type { Me, StepState } from './api'
import { ALREADY_IN_DFRNT, canMarkElsewhere, doneLine, isElsewhere, METHODS, noteProblem } from './doneAnotherWay'

const step = (over: Partial<StepState> = {}): StepState => ({
  key: 'rates', status: 'done', requests: [], rows: [], checklist: [], updatedAt: '2026-11-01T00:00:00Z',
  completedAt: '2026-11-01T03:00:00Z', completedBy: 'Steve', completedHow: 'dashboard', ...over,
})
const me = (over: Partial<Me> = {}): Me => ({ success: true, tenantId: '7', isDfAdmin: false, isTenantAdmin: false, isUsTenant: false, ...over })

describe('noteProblem', () => {
  it('needs 3 to 500 characters after trimming', () => {
    expect(noteProblem('')).not.toBeNull()
    expect(noteProblem('  ab  ')).not.toBeNull()
    expect(noteProblem('abc')).toBeNull()
    expect(noteProblem('x'.repeat(500))).toBeNull()
    expect(noteProblem('x'.repeat(501))).not.toBeNull()
  })
})

describe('METHODS', () => {
  it('offers Already in DFRNT and ends with Other', () => {
    expect(METHODS).toContain(ALREADY_IN_DFRNT)
    expect(METHODS[METHODS.length - 1]).toBe('Other')
  })
})

describe('canMarkElsewhere', () => {
  it('is DF Admin or a tenant admin only', () => {
    expect(canMarkElsewhere(me({ isDfAdmin: true }))).toBe(true)
    expect(canMarkElsewhere(me({ isTenantAdmin: true }))).toBe(true)
    expect(canMarkElsewhere(me())).toBe(false)
    expect(canMarkElsewhere(null)).toBe(false)
  })
})

describe('doneLine', () => {
  it('says who, when, how and the note for a step done another way', () => {
    const s = step({ completedHow: 'elsewhere', completedMethod: 'Loaded by Claude or the MCP', completedNote: 'RK1 loaded on prod.' })
    expect(isElsewhere(s)).toBe(true)
    expect(doneLine(s, d => d.slice(0, 10))).toBe('Done another way by Steve on 2026-11-01: Loaded by Claude or the MCP. RK1 loaded on prod.')
  })

  it('keeps the plain wording for a step done on the dashboard', () => {
    expect(isElsewhere(step())).toBe(false)
    expect(doneLine(step(), d => d.slice(0, 10))).toBe('Marked as done by Steve on 2026-11-01.')
  })

  it('treats sessions saved before the change as done on the dashboard', () => {
    expect(isElsewhere(step({ completedHow: undefined }))).toBe(false)
  })
})
