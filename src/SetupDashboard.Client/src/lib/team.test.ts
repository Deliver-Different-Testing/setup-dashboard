import { describe, expect, it } from 'vitest'
import type { TeamStep } from './api'
import { ADMIN_TILE, peopleOn, removeRole, renameRole, setTile, starterRole, teamWarnings } from './team'

const team = (): TeamStep => ({
  roles: [{ name: 'Ops', tiles: ['a'] }, { name: 'Admin', tiles: [ADMIN_TILE] }],
  people: [
    { email: 'x@a.co', roleName: 'Ops', inviteConfirmed: false },
    { email: 'y@a.co', roleName: ' Ops ', inviteConfirmed: false },
    { email: 'z@a.co', roleName: 'Admin', inviteConfirmed: true },
  ],
})

describe('renameRole', () => {
  it('moves the people on the role to its new name', () => {
    const t = renameRole(team(), 0, 'Operations')
    expect(t.roles[0].name).toBe('Operations')
    expect(t.people.map(p => p.roleName)).toEqual(['Operations', 'Operations', 'Admin'])
  })

  it('leaves people alone while the role has no name yet', () => {
    const t = renameRole({ roles: [{ tiles: [] }], people: [{ inviteConfirmed: false }] }, 0, 'New')
    expect(t.people[0].roleName).toBeUndefined()
  })

  it('does not move people when the name is cleared', () => {
    const t = renameRole(team(), 0, undefined)
    expect(t.people[0].roleName).toBe('Ops')
  })
})

describe('removeRole', () => {
  it('drops the role and unassigns its people', () => {
    const t = removeRole(team(), 0)
    expect(t.roles.map(r => r.name)).toEqual(['Admin'])
    expect(t.people.map(p => p.roleName)).toEqual([undefined, undefined, 'Admin'])
  })
})

describe('peopleOn', () => {
  it('counts people by trimmed role name', () => {
    expect(peopleOn(team().people, team().roles[0])).toHaveLength(2)
    expect(peopleOn(team().people, { tiles: [] })).toHaveLength(0)
  })
})

describe('setTile', () => {
  it('adds a tile once and removes it', () => {
    const r = { tiles: ['a'] }
    expect(setTile(r, 'b', true).tiles).toEqual(['a', 'b'])
    expect(setTile(r, 'a', true).tiles).toEqual(['a'])
    expect(setTile(r, 'a', false).tiles).toEqual([])
  })
})

describe('starterRole', () => {
  it('gives the tenant admin every tile, conditional ones included', () => {
    const tiles = [{ featureKey: 'a', displayName: 'A' }, { featureKey: 'b', displayName: 'B', condition: 'not open to Tenant yet' }]
    expect(starterRole('admin', tiles)).toEqual({ name: 'Tenant Admin', description: 'Runs the account: settings, users and every tile', tiles: ['a', 'b'] })
    expect(starterRole('blank', tiles)).toEqual({ tiles: [] })
  })
})

describe('teamWarnings', () => {
  it('names roles with no tiles', () => {
    const t: TeamStep = { roles: [{ name: 'Empty', tiles: [] }, { name: 'Admin', tiles: [ADMIN_TILE] }], people: [{ roleName: 'Admin', inviteConfirmed: true }] }
    expect(teamWarnings(t)).toEqual(['Empty opens no tiles, so people on it will see an empty Hub.'])
  })

  it('warns when people exist but none can open Settings', () => {
    const t: TeamStep = { roles: [{ name: 'Ops', tiles: ['a'] }], people: [{ roleName: 'Ops', inviteConfirmed: false }] }
    expect(teamWarnings(t)).toEqual(['Nobody here can open Settings, so nobody at the tenant will be able to manage users.'])
  })

  it('says nothing for an empty step', () => {
    expect(teamWarnings({ roles: [], people: [] })).toEqual([])
  })
})
