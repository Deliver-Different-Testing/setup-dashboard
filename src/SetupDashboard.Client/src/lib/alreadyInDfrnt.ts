import type { BusinessProfile, StepKey, TenantSummary } from './api'

// "Already in DFRNT": what the tenant has before (or without) this dashboard, read from the tenant
// summary. These lines only suggest - a person marks a step done another way.

/** The seed leaves this until someone names the system. */
export const SEED_SYSTEM_NAME = 'Despatch Manager'

const COUNTRY_BY_CODE: Record<string, string> = {
  NZ: 'New Zealand', AU: 'Australia', US: 'United States', GB: 'United Kingdom', UK: 'United Kingdom', CA: 'Canada',
}

const n = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`
const sentence = (parts: string[]) => (parts.length ? `${parts.join(', ')}.` : null)
const systemName = (s: Record<string, string>) => {
  const name = s.SystemName?.trim()
  return name && name !== SEED_SYSTEM_NAME ? name : undefined
}

/** One line per step, or null when the tenant has nothing for it (or the dashboard can't read it). */
export function stripText(step: StepKey, summary: TenantSummary): string | null {
  const c = summary.counts
  switch (step) {
    case 'business': {
      const parts = [
        c.tenantClientFile ? 'Tenant client file exists.' : '',
        systemName(summary.settings) ? `Company name: ${systemName(summary.settings)}.` : '',
        summary.settings.CountryCode?.trim() ? `Country: ${summary.settings.CountryCode.trim()}.` : '',
      ].filter(Boolean)
      return parts.length ? parts.join(' ') : null
    }
    case 'team':
      if (c.team === 0 && !c.roles) return null
      return sentence([`${n(c.team, 'staff', 'staff')} on the tenant's client file`, ...(c.roles ? [n(c.roles, 'role')] : [])])
    case 'clients':
      // Contacts counts everyone's contacts; the tenant's own staff are taken off.
      return c.clients === 0 ? null : sentence([n(c.clients, 'client'), n(Math.max(0, c.contacts - c.team), 'contact')])
    case 'rates':
      if (c.rateCards + c.zones + c.zoneZips + c.extraCharges === 0) return null
      return sentence([
        n(c.rateCards, 'rate card'), n(c.services, 'service'), n(c.zones, 'zone'),
        n(c.zoneZips, 'postcode on zones', 'postcodes on zones'), n(c.extraCharges, 'extra charge'),
      ])
    case 'couriers':
      return c.couriers === 0 ? null : sentence([n(c.couriers, 'courier')])
    case 'partners':
      return c.partners === 0 ? null : sentence([n(c.partners, 'partner')])
    case 'automations':
      return c.automations === 0 ? null : sentence([n(c.automations, 'active automation rule')])
    default:
      return null
  }
}

/** System Settings the tenant seed leaves for a person, shown on the Business step so a wrong one stands out. */
export function businessFlags(s: Record<string, string>): string[] {
  const flags: string[] = []
  const name = s.SystemName?.trim()
  if (!name || name === SEED_SYSTEM_NAME) flags.push(name ? `System Name is still '${SEED_SYSTEM_NAME}'.` : 'System Name is blank.')
  if (!s.CountryCode?.trim()) flags.push('CountryCode is blank.')
  const gst = Number(s.Gstrate)
  if (!s.Gstrate?.trim() || !Number.isFinite(gst) || gst === 0) flags.push(s.Gstrate?.trim() ? 'GST rate is 0.' : 'GST rate is blank.')
  return flags
}

/** Draft values for an untouched Business profile, from System Settings. Never saved until the person saves. */
export function prefillBusiness(profile: BusinessProfile, s: Record<string, string>): Partial<BusinessProfile> | null {
  if (profile.companyName?.trim() || profile.country?.trim()) return null
  const fill: Partial<BusinessProfile> = {}
  const name = systemName(s)
  if (name) fill.companyName = name
  const code = s.CountryCode?.trim().toUpperCase()
  if (code) fill.country = COUNTRY_BY_CODE[code] ?? code
  return Object.keys(fill).length ? fill : null
}

/** Whether a new setup should open on "Where this tenant is up to". Services are left out: every tenant starts with some. */
export function tenantHasData(summary: TenantSummary): boolean {
  const c = summary.counts
  return c.tenantClientFile || [c.team, c.clients, c.couriers, c.zones, c.automations, c.rateCards, c.zoneZips, c.extraCharges, c.partners, c.roles ?? 0]
    .some(x => x > 0)
}

/**
 * Runs `run` for each step in turn (one send at a time, as the server expects) and keeps going past a
 * failure. `last` is the last successful result - the newest session.
 */
export async function markEach<T>(steps: StepKey[], run: (step: StepKey) => Promise<T>) {
  let last: T | undefined
  const failed: { step: StepKey; message: string }[] = []
  for (const step of steps) {
    try {
      last = await run(step)
    } catch (e: unknown) {
      failed.push({ step, message: e instanceof Error ? e.message : 'Could not mark it done.' })
    }
  }
  return { last, failed }
}
