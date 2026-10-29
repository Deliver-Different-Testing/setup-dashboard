import { describe, expect, it } from 'vitest'
import type { ClientRow } from './api'
import { applyToAll, clientMatches, clientNeeds } from './clients'

const ready = (): ClientRow => ({
  code: 'ACME', name: 'Acme Ltd', address: '1 Queen St', suburb: 'CBD', city: 'Auckland',
  invoiceScheduleId: 1, paymentTermId: 2, inviteConfirmed: true,
  primaryContact: { firstName: 'Ana', email: 'ana@acme.co', createSignIn: false },
  contacts: [{ surname: 'Lee', email: 'lee@acme.co', createSignIn: false }],
})

describe('clientNeeds', () => {
  it('is empty for a customer Settings will accept', () => {
    expect(clientNeeds(ready(), false)).toEqual([])
  })

  it('names every missing required field in the order Settings checks them', () => {
    const c: ClientRow = { inviteConfirmed: false, primaryContact: { createSignIn: false }, contacts: [] }
    expect(clientNeeds(c, false)).toEqual([
      'client code', 'name', 'street address', 'suburb', 'city', 'invoice schedule', 'payment term',
      'primary contact first name', 'primary contact email', 'invite tick',
    ])
  })

  it('uses city and state for a US tenant', () => {
    const c = { ...ready(), suburb: undefined, city: '  ' }
    expect(clientNeeds(c, true)).toEqual(['city', 'state'])
  })

  it('treats whitespace as empty', () => {
    expect(clientNeeds({ ...ready(), code: '   ' }, false)).toEqual(['client code'])
  })

  it('needs a first name or surname and an email on each other contact', () => {
    const c = { ...ready(), contacts: [{ createSignIn: false }, { firstName: 'Bo', createSignIn: false }] }
    expect(clientNeeds(c, false)).toEqual(['contact 1 first name or surname', 'contact 1 email', 'contact 2 email'])
  })
})

describe('applyToAll', () => {
  const rows = (): ClientRow[] => [{ ...ready(), paymentTermId: undefined }, ready()]

  it('fills only blank values by default and counts what changed', () => {
    const { rows: next, changed } = applyToAll(rows(), { paymentTermId: 9 }, 'blanks')
    expect(next.map(r => r.paymentTermId)).toEqual([9, 2])
    expect(changed).toBe(1)
  })

  it('overwrites every row when asked', () => {
    const { rows: next, changed } = applyToAll(rows(), { paymentTermId: 9 }, 'all')
    expect(next.map(r => r.paymentTermId)).toEqual([9, 9])
    expect(changed).toBe(2)
  })

  it('leaves a value the user did not choose alone, even when replacing all', () => {
    const { rows: next, changed } = applyToAll(rows(), { invoiceScheduleId: undefined, paymentTermId: 9 }, 'all')
    expect(next.map(r => r.invoiceScheduleId)).toEqual([1, 1])
    expect(changed).toBe(2)
  })

  it('treats an unticked invite as blank', () => {
    const r = [{ ...ready(), inviteConfirmed: false }, ready()]
    const { rows: next, changed } = applyToAll(r, { inviteConfirmed: true }, 'blanks')
    expect(next.every(x => x.inviteConfirmed)).toBe(true)
    expect(changed).toBe(1)
  })
})

describe('clientMatches', () => {
  it('finds a customer by code, name or any contact email, ignoring case', () => {
    expect(clientMatches(ready(), 'acme')).toBe(true)
    expect(clientMatches(ready(), 'LEE@')).toBe(true)
    expect(clientMatches(ready(), 'ana@acme')).toBe(true)
    expect(clientMatches(ready(), 'zebra')).toBe(false)
  })

  it('matches everything for an empty search', () => {
    expect(clientMatches(ready(), '  ')).toBe(true)
  })
})
