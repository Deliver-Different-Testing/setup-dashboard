import type { PersonRow, RoleRow, TeamStep } from './api'

export interface Tile { featureKey: string; displayName: string; condition?: string | null }

/** The Settings tile. Manage Users follows it, so a tenant with nobody on it can't run its own users. */
export const ADMIN_TILE = 'hub-tile-configurator'

const key = (name: string | undefined) => name?.trim() ?? ''

/** People hold their role by name, so the people on a role move with it when it's renamed. */
export function renameRole(team: TeamStep, i: number, name: string | undefined): TeamStep {
  const from = key(team.roles[i]?.name)
  const to = key(name)
  return {
    roles: team.roles.map((r, j) => (j === i ? { ...r, name } : r)),
    people: from && to ? team.people.map(p => (key(p.roleName) === from ? { ...p, roleName: to } : p)) : team.people,
  }
}

/** Removing a role unassigns its people rather than leaving them on a role that no longer exists. */
export function removeRole(team: TeamStep, i: number): TeamStep {
  const gone = key(team.roles[i]?.name)
  return {
    roles: team.roles.filter((_, j) => j !== i),
    people: gone ? team.people.map(p => (key(p.roleName) === gone ? { ...p, roleName: undefined } : p)) : team.people,
  }
}

export const peopleOn = (people: PersonRow[], role: RoleRow) =>
  key(role.name) ? people.filter(p => key(p.roleName) === key(role.name)) : []

export function setTile(role: RoleRow, featureKey: string, on: boolean): RoleRow {
  const has = role.tiles.includes(featureKey)
  if (on === has) return role
  return { ...role, tiles: on ? [...role.tiles, featureKey] : role.tiles.filter(t => t !== featureKey) }
}

export function starterRole(kind: 'admin' | 'blank', tiles: Tile[]): RoleRow {
  return kind === 'admin'
    ? { name: 'Tenant Admin', description: 'Runs the account: settings, users and every tile', tiles: tiles.map(t => t.featureKey) }
    : { tiles: [] }
}

/** Things worth fixing before sending. They never block saving: setup often spans several sessions. */
export function teamWarnings(team: TeamStep): string[] {
  const out = team.roles
    .filter(r => key(r.name) && r.tiles.length === 0)
    .map(r => `${key(r.name)} opens no tiles, so people on it will see an empty Hub.`)
  const admins = team.roles.filter(r => r.tiles.includes(ADMIN_TILE))
  if (team.people.length > 0 && !team.people.some(p => admins.some(r => key(r.name) && key(r.name) === key(p.roleName))))
    out.push('Nobody here can open Settings, so nobody at the tenant will be able to manage users.')
  return out
}
